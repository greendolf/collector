import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";

const messages = [];
const chats = [];

const bot = new Telegraf("7121920352:AAGfq4Z7pp8BVVZ2h9D1KNEQirBjzRctkwI");

const target_id = "626925879";

bot.start((ctx) => {});

bot.on(message("new_chat_members"), async (ctx) => {
  if (
    ctx.message.new_chat_members.some((member) => member.id === bot.botInfo.id)
  ) {
    bot.telegram.sendMessage(
      target_id,
      `Меня добавили в новый чат: ${(await ctx.getChat()).id}`
    );
  }
});

bot.on("message", async (ctx) => {
  console.log(ctx.message);
  ctx.reply(`Бот заметил новое сообщение в чате ${(await ctx.getChat()).id}`);
});

bot.catch((err, ctx) => {});

bot.launch();

console.log("Бот запущен");
