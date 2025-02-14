import { config } from "dotenv";
config();
import moment from "moment-timezone";

import { Excel } from "./excel";
import { Chat, Message, Period } from "./dtos";
import { Telegraf } from "telegraf";
import * as fs from "fs";
import * as path from "path";
import { message } from "telegraf/filters";
import { ChatFromGetChat } from "telegraf/typings/core/types/typegram";

class Server {
  bot: Telegraf | null;
  excel: Excel | null;

  timezone: string | null;
  target_id: number | null;
  report_day: string | null;
  report_time: string[] | null;
  hashtags: string[] | null;

  chats: Record<number, Chat> = {};
  file_path = path.join(__dirname, "../data.json");
  matrix_headers: string[] = [
    "Хештег",
    "Заголовок отчета",
    "Название чата, id",
  ];

  constructor() {
    this.bot = process.env.BOT_TOKEN
      ? new Telegraf(process.env.BOT_TOKEN)
      : null;
    this.excel = process.env.GOOGLE_SHEET_ID
      ? new Excel(process.env.GOOGLE_SHEET_ID)
      : null;

    this.timezone = process.env.TIMEZONE || null;
    this.target_id = process.env.TARGET_ID
      ? Number(process.env.TARGET_ID)
      : null;

    this.report_day = process.env.REPORT_DAY || null;
    this.report_time = process.env.REPORT_TIME?.split(":") || null;

    this.hashtags = process.env.HASHTAGS?.split(",") || null;
    this._read_chats();
    this.form_report();
    // setInterval(async () => {
    //   const now = moment.tz(process.env.TIMEZONE!);
    //   console.log(now.format("HH:mm"));
    //   if (
    //     (now.format("HH:mm") === this.report_time &&
    //       now.day() === Number(process.env.REPORT_DAY)) ||
    //     true
    //   ) {
    //     console.log("form report");
    //     this.form_report();
    //   }
    // }, 60000);
  }

  async launch() {
    if (this.bot != null) {
      this.bot.start((ctx) => {});
      this.bot.on(message("new_chat_members"), async (ctx) => {
        try {
          if (
            ctx.message!.new_chat_members.some(
              (member) => member.id === this.bot!.botInfo!.id
            )
          ) {
            const chat: ChatFromGetChat & Partial<{ title: string }> =
              await ctx.getChat();
            this.chats[chat.id] = new Chat(chat.id, chat.title);
            if (this.target_id) {
              this.bot!.telegram.sendMessage(
                this.target_id,
                `Меня добавили в новый чат: ${(await ctx.getChat()).id}`
              );
            }
            await this._save_chats();
          }
        } catch (e) {
          console.error(e);
        }
      });
      this.bot.on(message("text"), async (ctx) => {
        console.log(
          `Бот заметил новое сообщение в чате ${(await ctx.getChat()).id}`
        );
        const message = new Message(
          ctx.message.message_id,
          new Date(ctx.message.date * 1000),
          ctx.message.text
        );
        const chat: ChatFromGetChat & Partial<{ title: string }> =
          await ctx.getChat();
        if (chat.id in this.chats) {
          this.chats[chat.id].messages.push(message);
        } else {
          this.chats[chat.id] = new Chat(chat.id, chat.title);
          this.chats[chat.id].messages.push(message);
        }
        await this._save_chats();
      });
      this.bot.catch((ctx) => {});
      this.bot.launch();
    }
  }

  stop(code: string) {
    if (this.bot != null) {
      this.bot.stop(code);
    }
  }

  async _save_chats() {
    try {
      const data = JSON.stringify(
        Array.from(Object.values(this.chats)),
        null,
        2
      );
      fs.writeFileSync(this.file_path, data, "utf-8");
      console.log("Чаты сохранены в файл");
    } catch (e) {
      console.error("Ошибка при сохранении чатов:", e);
    }
  }

  _read_chats() {
    try {
      if (!fs.existsSync(this.file_path)) {
        console.error("Файл не существует.");
        return null;
      }

      const data = fs.readFileSync(this.file_path, "utf-8");
      const chats = JSON.parse(data) as Chat[];
      this.chats = {};
      chats.forEach((chat) => {
        this.chats[chat.id] = chat;
        this.chats[chat.id].messages.forEach(
          (msg) => (msg.date = new Date(msg.date))
        );
      });
      console.log("Чаты успешно загружены из файла.");
    } catch (e) {
      console.error("Ошибка при чтении чатов:", e);
      return null;
    }
  }

  async form_report() {
    try {
      const period = this._get_period(
        this.timezone!,
        this.report_day!,
        this.report_time!
      );

      const hashtags_not_found: Record<string, Chat[]> = {};

      this.hashtags?.forEach((hashtag) => {
        hashtags_not_found[hashtag] = [];
        for (const [id, chat] of Object.entries(this.chats)) {
          hashtags_not_found[hashtag].push(chat);
          for (const message of chat.messages) {
            if (
              message.date >= period.startDate &&
              message.date <= period.endDate &&
              message.text.includes(hashtag)
            ) {
              hashtags_not_found[hashtag].pop();
              break;
            }
          }
        }
      });
      let matrix_report = [];
      for (const [hashtag, chats] of Object.entries(hashtags_not_found)) {
        if (chats.length == 0) continue;
        const chat_info = Array.from(chats).map((it) => [it.title, it.id]);
        matrix_report.push([
          hashtag,
          `Тут не было хештега ${hashtag}`,
          chat_info.join("\n"),
        ]);
      }
      matrix_report = [this.matrix_headers, ...matrix_report];

      if (this.excel) {
        const sheet_id = await this.excel.create_new_sheet(period.formatted);
        await this.excel.write_data(period.formatted, matrix_report);
        if (sheet_id) {
          const link = this.excel.get_sheet_link(sheet_id);
          this._write_report(period.formatted, link);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  _write_report(period: string, link: string) {
    if (this.target_id && this.bot) {
      this.bot.telegram.sendMessage(
        this.target_id,
        `Отчёт за период ${period}\n${link}`
      );
    }
  }

  _get_period(
    timezone: string,
    report_day: string,
    report_time: string[]
  ): Period {
    const hour = report_time[0];
    const minute = report_time[1];
    const now = moment.tz(timezone);
    const endOfPeriod = now
      .clone()
      .day(report_day)
      .hour(Number(hour))
      .minute(Number(minute));
    const startOfPeriod = endOfPeriod
      .subtract(1, "week")
      .subtract(1, "hour")
      .subtract(1, "minute");
    return {
      startDate: new Date(startOfPeriod.toDate()),
      endDate: new Date(endOfPeriod.toDate()),
      formatted: `${moment(startOfPeriod).format("DD-MM-YYYY")} - ${moment(
        endOfPeriod
      ).format("DD-MM-YYYY")}`,
    };
  }
}

const server = new Server();

process.once("SIGINT", () => server.stop("SIGINT"));
process.once("SIGTERM", () => server.stop("SIGTERM"));
