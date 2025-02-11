import { Context, Telegraf } from "telegraf";
import { config } from "dotenv";
import { message } from "telegraf/filters";
import { Update } from "@telegraf/types";
import { Chat, Message } from "./dtos";
import * as fs from 'fs';
import * as path from 'path';
config();

export class Collector {
  bot: Telegraf;
  chats: Record<number, Chat> = {};
  constructor(readonly token: string) {
    this.bot = new Telegraf(process.env.BOT_TOKEN!);
  }

  launch() {
    this.bot.start(this._start);
    this.bot.on(message("new_chat_members"), async (ctx) => {
      console.log(typeof ctx.message);
      if (
        ctx.message!.new_chat_members.some(
          (member: { id: number }) => member.id === this.bot.botInfo!.id
        )
      ) {
        const chat = await ctx.getChat();
        this.chats[chat.id] = new Chat(chat.id);
        this.bot.telegram.sendMessage(
          process.env.TARGET_ID!,
          `Меня добавили в новый чат: ${(await ctx.getChat()).id}`
        );
      }
    });
    this.bot.on(message("text"), async (ctx) => {
      console.log(
        `Бот заметил новое сообщение в чате ${(await ctx.getChat()).id}`
      );
      console.log(ctx.message);
      const message = new Message(
        ctx.message?.message_id!,
        new Date(ctx.message!.date),
        ctx.message!.text
      );
      this.chats[(await ctx.getChat()).id].messages.push();
    });
    this.bot.catch(this._catch_errors);
    this.bot.launch();
  }

  stop(code: string) {
    this.bot.stop(code);
  }

  async _start(ctx: Context) {}

  // async _new_chat(ctx: any) {
  //   console.log(typeof ctx.message);
  //   if (
  //     ctx.message!.new_chat_members.some(
  //       (member: { id: number }) => member.id === this.bot.botInfo!.id
  //     )
  //   ) {
  //     this.chats.push(await ctx.getChat());
  //     this.bot.telegram.sendMessage(
  //       process.env.TARGET_ID!,
  //       `Меня добавили в новый чат: ${(await ctx.getChat()).id}`
  //     );
  //   }
  // }

  async _new_message(ctx: Context) {}

  async _catch_errors(err: any, ctx: Context<Update>) {}
}
