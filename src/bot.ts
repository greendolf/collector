import { Telegraf } from "telegraf";
import { Chat, Message } from "./dtos";
import { message } from "telegraf/filters";
import { ChatFromGetChat } from "telegraf/typings/core/types/typegram";
import * as fs from "fs";
import * as path from "path";

export class Collector {
  bot: Telegraf;
  target_id: number;

  chats: Record<number, Chat> = {};

  file_path = path.join(__dirname, "../data.json");

  constructor(token: string, target_id: number) {
    this.bot = new Telegraf(token);
    this.target_id = target_id;
  }

  launch() {
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

  stop(code: string) {
    this.bot?.stop(code);
  }

  write_report(period: string, link: string) {
    if (this.target_id && this.bot) {
      this.bot.telegram.sendMessage(
        this.target_id,
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
