import { config } from 'dotenv';
config();
import { Telegraf } from "telegraf";
import { google } from "googleapis";
import moment from "moment-timezone";

// Настройки
const BOT_TOKEN = process.env.BOT_TOKEN;
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

const TIMEZONE = "Asia/Krasnoyarsk";
const REPORT_TIME = "11:30:00";
const HASHTAGS = ["#митрепорт", "#еженедельныйотчет"]; // Хештеги для поиска

const chatIds = ["-4659754498", "-4654529351"]; // Список ID чатов для проверки
const userId = "626925879"; // ID пользователя, которому отправлять отчет

// Создание экземпляра бота
const bot = new Telegraf(BOT_TOKEN);

// Авторизация в Google Sheets API
const auth = new google.auth.GoogleAuth({
  keyFile: "./auth.json", // Путь к JSON файлу с учетными данными сервисного аккаунта
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

// База данных для хранения сообщений
const chatMessages = {};

// Функция для получения периода отчета
function getReportPeriod() {
  const hour = REPORT_TIME.split(':')[0]
  const minute = REPORT_TIME.split(':')[1]
  const second = REPORT_TIME.split(':')[2]
  const now = moment.tz(TIMEZONE);
  const startOfWeek = now.clone().startOf("week").hour(hour).minute(minute).second(second);
  const endOfWeek = now
    .clone()
    .startOf("week")
    .add(1, "week")
    .hour(hour - 1)
    .minute(minute - 1)
    .second(second - 1);

  return {
    startDate: startOfWeek.format("YYYY-MM-DD HH:mm:ss"),
    endDate: endOfWeek.format("YYYY-MM-DD HH:mm:ss"),
  };
}

// Обработчик новых сообщений
bot.on("text", (ctx) => {
  const chatId = ctx.chat.id;
  const messageDate = moment.tz(ctx.message.date * 1000, TIMEZONE); // Преобразуем дату в момент времени
  const messageText = ctx.message.text || "";

  if (!chatMessages[chatId]) {
    chatMessages[chatId] = [];
  }

  // Сохраняем сообщение в базу данных
  chatMessages[chatId].push({
    date: messageDate.format("YYYY-MM-DD HH:mm:ss"),
    text: messageText,
  });
});

// Функция для проверки сообщений в чатах
function checkChatsForHashtags(chatIds, period) {
  const reports = {};

  for (const hashtag of HASHTAGS) {
    reports[hashtag] = [];
  }

  for (const chatId of chatIds) {
    const messages = chatMessages[chatId] || [];
    let hasHashtag = false;

    for (const message of messages) {
      const messageDate = moment.tz(message.date, TIMEZONE);
      if (messageDate.isBetween(period.startDate, period.endDate)) {
        for (const hashtag of HASHTAGS) {
          if (message.text.includes(hashtag)) {
            hasHashtag = true;
            break;
          }
        }
      }
    }

    if (!hasHashtag) {
      for (const hashtag of HASHTAGS) {
        reports[hashtag].push(chatId);
      }
    }
  }

  return reports;
}

// Функция для отправки отчета
async function sendReports(chatIds, userId) {
  const period = getReportPeriod();
  const reports = checkChatsForHashtags(chatIds, period);

  for (const [hashtag, chats] of Object.entries(reports)) {
    if (chats.length > 0) {
      const reportMessage = `Отчет за период ${period.startDate} - ${
        period.endDate
      }:\n\nНе найдено сообщений с хештегом ${hashtag} в следующих чатах:\n${chats.join(
        "\n"
      )}`;
      await bot.telegram.sendMessage(userId, reportMessage);

      // Запись в Google Sheets
      const sheetName = `${moment(period.startDate).format(
        "DD.MM.YY HH:mm"
      )} - ${moment(period.endDate).format("DD.MM.YY HH:mm")}`;
      const values = chats.map((chat) => [chat]);

      sheets.spreadsheets.values.append({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `${sheetName}!A1`,
        valueInputOption: "RAW",
        resource: { values },
      });
    }
  }
}

bot.start((ctx) => {
  ctx.reply("Бот запущен.");
});

// Проверка времени для отправки отчета
setInterval(async () => {
  const now = moment.tz(TIMEZONE);
  console.log(now.format("HH:mm:ss"))
  if (now.format("HH:mm:ss") === REPORT_TIME && now.day() === 1) {
    await sendReports(chatIds, userId);
  }
}, 60000); // Проверка каждую минуту

// Запуск бота
bot.launch();

// Обработка завершения работы
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
