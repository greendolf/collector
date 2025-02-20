import { Markup, Telegraf } from "telegraf";
import { Chat, Message, Settings } from "./dtos";
import { message } from "telegraf/filters";
import {
  CallbackQuery,
  ChatFromGetChat,
} from "telegraf/typings/core/types/typegram";
import * as fs from "fs";
import * as path from "path";
import moment from "moment";

enum Actions {
  put_time = "put_time",
  add_hashtag = "add_hashtag",
  delete_hashtag = "delete_hashtag",
}

const DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const PERIODS = ["1 week", "2 weeks", "3 weeks", "4 weeks"];

export class Collector {
  bot!: Telegraf;

  chats: Record<number, Chat> = {};

  settings!: Settings;

  action: Actions | null;

  file_path = path.join(__dirname, "../data.json");

  constructor() {
    this._read_chats();
    this.action = null;
    this.launch();
  }

  async launch() {
    await this.load_settings();
    this.bot = new Telegraf(this.settings.bot_token);
    
    this.bot.start((ctx) => {});

    this.bot.on(message("new_chat_members"), async (ctx) => {
      try {
        if (
          ctx.message.new_chat_members.some(
            (member) => member.id === this.bot!.botInfo!.id
          )
        ) {
          const chat: ChatFromGetChat & Partial<{ title: string }> =
            await ctx.getChat();
          this.chats[chat.id] = new Chat(chat.id, chat.title);
          if (this.settings.target_id) {
            this._message_to_target(
              `Меня добавили в новый чат: ${(await ctx.getChat()).id}`
            );
          }
          await this._save_chats();
        }
      } catch (e) {
        console.error(e);
      }
    });

    this.bot.on(message("left_chat_member"), async (ctx) => {
      console.log(ctx.update.message.left_chat_member);
      if (ctx.message.left_chat_member.id == ctx.botInfo.id) {
        const chat = await ctx.getChat();
        this._message_to_target(`Меня удалили из чата: ${chat.id}`);
        delete this.chats[chat.id];
      }
    });

    this.bot.command("settings", async (ctx) => {
      const chat = await ctx.getChat();

      if (chat.id == this.settings.target_id) {
        const hashtags = this.settings.hashtags.map(
          (it) => `${it.hashtag} (${it.header})`
        );
        const report_day = moment()
          .day(this.settings.report_day)
          .format("dddd");
        const report_time = this.settings.report_time.join(":");
        const period = this.settings.period.join(" ");
        ctx.reply(
          `Какой параметр формирования отчетов вы хотите изменить?
          \nТекущий список хештегов:\n${hashtags.join("\n")}`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback(`День недели (${report_day})`, "day"),
              Markup.button.callback(`Время (${report_time})`, "time"),
            ],
            [
              Markup.button.callback(`Период (${period})`, "period"),
              Markup.button.callback("Список хештегов", "hashtags"),
            ],
          ])
        );
      }
    });

    this.bot.action("day", (ctx) => {
      ctx.editMessageText(
        `Выберите день недели:`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback(`Понедельник`, "monday"),
            Markup.button.callback(`Вторник`, "tuesday"),
            Markup.button.callback(`Среда`, "wednesday"),
            Markup.button.callback(`Четверг`, "thursday"),
          ],
          [
            Markup.button.callback(`Пятница`, "friday"),
            Markup.button.callback(`Суббота`, "saturday"),
            Markup.button.callback(`Воскресенье`, "sunday"),
            Markup.button.callback(`Вернуться`, "back"),
          ],
        ])
      );
    });

    this.bot.action(DAYS, (ctx) => {
      const callback_query: CallbackQuery & Partial<{ data: string }> =
        ctx.update.callback_query;
      const day_name = callback_query.data;
      const day_number = moment().day(day_name!).day();
      this.settings.report_day = day_number;

      this.save_settings();
      ctx.editMessageText(
        "Настройки успешно применены",
        Markup.inlineKeyboard([
          Markup.button.callback("Вернуться к настройкам", "back"),
        ])
      );
    });

    this.bot.action("time", (ctx) => {
      this.action = Actions.put_time;
      ctx.editMessageText(
        `Введите время в формате HH:MM (24-х часовой формат)`,
        Markup.inlineKeyboard([
          Markup.button.callback("Вернуться к настройкам", "back"),
        ])
      );
    });
    this.bot.action("period", (ctx) => {
      ctx.editMessageText(
        `Выберите период составления отчёта:`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback(`1 неделя`, "1 week"),
            Markup.button.callback(`2 недели`, "2 weeks"),
            Markup.button.callback(`3 недели`, "3 weeks"),
            Markup.button.callback(`Вернуться`, "back"),
          ],
        ])
      );
    });

    this.bot.action(PERIODS, (ctx) => {
      const callback_query: CallbackQuery & Partial<{ data: string }> =
        ctx.update.callback_query;
      const period = callback_query.data;

      this.settings.period = period!.split(" ");

      this.save_settings();
      ctx.editMessageText(
        "Настройки успешно применены",
        Markup.inlineKeyboard([
          Markup.button.callback("Вернуться к настройкам", "back"),
        ])
      );
    });

    this.bot.action("hashtags", (ctx) => {
      const hashtags = this.settings.hashtags.map(
        (it) => `${it.hashtag} (${it.header})`
      );
      ctx.editMessageText(
        `Выберите действие?
          \nТекущий список хештегов:\n${hashtags.join("\n")}`,
        Markup.inlineKeyboard([
          Markup.button.callback("Добавить хештег", "add_hashtag"),
          Markup.button.callback("Удалить хештег", "delete_hashtag"),
          Markup.button.callback("Вернуться", "back"),
        ])
      );
    });

    this.bot.action("add_hashtag", (ctx) => {
      this.action = Actions.add_hashtag;
      const hashtags = this.settings.hashtags.map(
        (it) => `${it.hashtag} (${it.header})`
      );
      ctx.editMessageText(
        `Введите хештег в формате\n"#<хештег> <заголовок хештега>"\nПример: #митрепорт Тут не было митрепорта\nТекущий список хештегов:\n
        ${hashtags.join("\n")}`,
        Markup.inlineKeyboard([Markup.button.callback("Вернуться", "back")])
      );
    });

    this.bot.action("delete_hashtag", (ctx) => {
      this.action = Actions.delete_hashtag;
      const hashtags = this.settings.hashtags.map(
        (it) => `${it.hashtag} (${it.header})`
      );
      ctx.editMessageText(
        `Введите хештег (с решёткой), который хотите удалить.\nДоступные варианты:\n${hashtags.join(
          "\n"
        )}`,
        Markup.inlineKeyboard([Markup.button.callback("Вернуться", "back")])
      );
    });

    this.bot.action("back", (ctx) => {
      const hashtags = this.settings.hashtags.map(
        (it) => `${it.hashtag} (${it.header})`
      );
      const report_day = moment().day(this.settings.report_day).format("dddd");
      const report_time = this.settings.report_time.join(":");
      const period = this.settings.period.join(" ");

      ctx.editMessageText(
        `Какой параметр формирования отчетов вы хотите изменить?
          \nТекущий список хештегов:\n${hashtags.join("\n")}`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback(`День недели (${report_day})`, "day"),
            Markup.button.callback(`Время (${report_time})`, "time"),
          ],
          [
            Markup.button.callback(`Период (${period})`, "period"),
            Markup.button.callback("Список хештегов", "hashtags"),
          ],
        ])
      );
    });

    this.bot.on(message("text"), async (ctx) => {
      const chat: ChatFromGetChat & Partial<{ title: string }> =
        await ctx.getChat();
      if (chat.id.toString().startsWith("-")) {
        console.log(
          `Бот заметил новое сообщение в чате ${(await ctx.getChat()).id}`
        );
        const message = new Message(
          ctx.message.message_id,
          new Date(ctx.message.date * 1000),
          ctx.message.text
        );

        if (chat.id in this.chats) {
          this.chats[chat.id].messages.push(message);
        } else {
          this.chats[chat.id] = new Chat(chat.id, chat.title);
          this.chats[chat.id].messages.push(message);
        }
        await this._save_chats();
      } else if (chat.id == this.settings.target_id) {
        switch (this.action) {
          case Actions.put_time: {
            const new_time = ctx.message.text.split(":");
            this.settings.report_time = new_time;
            this.save_settings();
            this.action = null;
            break;
          }
          case Actions.add_hashtag: {
            try {
              const info = ctx.message.text;
              const [hashtag, ...header_parts] = info.split(" ");
              const new_hashtag = {
                hashtag,
                header: header_parts.join(" "),
              };
              this.settings.hashtags.push(new_hashtag);
              this.save_settings();
            } finally {
              this.action = null;
            }
            break;
          }
          case Actions.delete_hashtag: {
            try {
              const removal_hashtag = ctx.message.text;
              const filtered = this.settings.hashtags.filter(
                (it) => it.hashtag != removal_hashtag
              );
              this.settings.hashtags = filtered;
              this.save_settings();
            } finally {
              this.action = null;
            }
            break;
          }
          default: {
            ctx.reply(
              "Ошибка",
              Markup.inlineKeyboard([
                Markup.button.callback("Вернуться к настройкам", "back"),
              ])
            );
            return;
          }
        }
        ctx.reply(
          "Настройки успешно применены",
          Markup.inlineKeyboard([
            Markup.button.callback("Вернуться к настройкам", "back"),
          ])
        );
      }
    });

    this.bot.catch((ctx) => {
      console.log(ctx);
    });

    this.bot.launch();
  }

  stop(code: string) {
    this.bot?.stop(code);
  }

  async load_settings() {
    const settings = await import("../settings.json");
    this.settings = new Settings(settings);
  }

  async save_settings() {
    try {
      const jsonData = JSON.stringify(this.settings, null, 2);
      fs.writeFileSync(
        path.join(__dirname, "../settings.json"),
        jsonData,
        "utf-8"
      );
      console.log("Настройки сохранены");
    } catch (e) {
      console.log(e);
    }
  }

  _message_to_target(message: string) {
    this.bot!.telegram.sendMessage(this.settings.target_id, message);
  }

  write_report(period: string, link: string) {
    if (this.settings.target_id && this.bot) {
      this.bot.telegram.sendMessage(
        this.settings.target_id,
        `Отчёт за период ${period}\n${link}`
      );
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
}
