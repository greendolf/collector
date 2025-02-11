import { Telegraf } from "telegraf";
import { config } from "dotenv";
import { message } from "telegraf/filters";
import { Chat, Message } from "./dtos";
import * as fs from "fs";
import * as path from "path";
import { ChatFromGetChat } from "telegraf/typings/core/types/typegram";
config();

export class Collector {
  bot: Telegraf;
  chats: Record<number, Chat> = {};
  file_path = path.join(__dirname, "data.json");
  target_id: number = Number(process.env.TARGET_ID!);
  constructor(readonly token: string) {
    this.bot = new Telegraf(process.env.BOT_TOKEN!);
    this._read_chats();
  }

  async launch() {
    this.bot.start((ctx) => {});
    this.bot.on(message("new_chat_members"), async (ctx) => {
      try {
        if (
          ctx.message!.new_chat_members.some(
            (member) => member.id === this.bot.botInfo!.id
          )
        ) {
          const chat: ChatFromGetChat & Partial<{ title: string }> =
            await ctx.getChat();
          this.chats[chat.id] = new Chat(chat.id, chat.title!);
          console.log(this.chats);
          this.bot.telegram.sendMessage(
            this.target_id,
            `Меня добавили в новый чат: ${(await ctx.getChat()).id}`
          );
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
      console.log(ctx.message.date);
      console.log(new Date(ctx.message.date));
      const message = new Message(
        ctx.message?.message_id!,
        new Date(ctx.message.date * 1000),
        ctx.message!.text
      );
      const chat = await ctx.getChat();
      this.chats[chat.id].messages.push(message);
      await this._save_chats();
    });
    this.bot.catch((ctx) => {});
    this.bot.launch();
  }

  stop(code: string) {
    this.bot.stop(code);
  }

  write_report(period: string, link: string) {
    this.bot.telegram.sendMessage(this.target_id, `Отчёт за период ${period}\n${link}`);
  }

  async _save_chats() {
    try {
      const data = JSON.stringify(
        Array.from(Object.values(this.chats)),
        null,
        2
      ); // Преобразуем объект в строку
      console.log(data);
      fs.writeFileSync(this.file_path, data, "utf-8"); // Записываем строку в файл
      console.log("Чаты сохранены в файл");
    } catch (error) {
      console.error("Ошибка при сохранении чатов:", error);
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
      console.log(chats);
      if (chats.length > 0) {
        this.chats = {};
        for (const chat of chats) {
          this.chats[chat.id] = chat;
          for (const message of this.chats[chat.id].messages) {
            message.date = new Date(message.date);
          }
        }
        console.log("Чаты успешно загружены из файла.");
      }
    } catch (error) {
      console.error("Ошибка при чтении чатов:", error);
      return null;
    }
  }
}
