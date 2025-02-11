import { config } from "dotenv";
config();
import moment from "moment-timezone";

import { Collector } from "./bot";
import { Excel } from "./excel";
import { Chat, Period } from "./dtos";

class Server {
  collector: Collector = new Collector(process.env.BOT_TOKEN!);
  excel: Excel = new Excel(process.env.GOOGLE_SHEET_ID!);
  report_time = process.env.REPORT_TIME!;
  report_day = process.env.REPORT_DAY!;
  timezone = process.env.TIMEZONE!;
  hashtags_not_found: Record<string, Set<Chat>> = {};

  constructor() {
    const hashtags = process.env.HASHTAGS!.split(",");
    for (const hashtag of hashtags)
      this.hashtags_not_found[hashtag] = new Set();
    console.log(this.hashtags_not_found);
    this.collector.launch();

    setInterval(async () => {
      const now = moment.tz(process.env.TIMEZONE!);
      console.log(now.format("HH:mm"));
      if (
        (now.format("HH:mm") === this.report_time &&
          now.day() === Number(process.env.REPORT_DAY)) ||
        true
      ) {
        console.log("form report");
        this.form_report();
      }
    }, 60000);
  }

  stop(code: string) {
    this.collector.stop(code);
  }

  form_report() {
    const period = this._get_period();
    console.log(
      `${period.startDate.toDateString()} - ${period.endDate.toDateString()}`
    );
    for (const [hashtag, chats] of Object.entries(this.hashtags_not_found)) {
      for (const [id, chat] of Object.entries(this.collector.chats)) {
        this.hashtags_not_found[hashtag].add(chat);
        for (const message of chat.messages) {
          if (
            message.date >= period.startDate &&
            message.date <= period.endDate &&
            message.text.includes(hashtag)
          ) {
            this.hashtags_not_found[hashtag].delete(chat);
            break;
          }
        }
      }
    }
    console.log(this.hashtags_not_found);
    const excel_data = [];
    for (const [hashtag, chats] of Object.entries(this.hashtags_not_found)) {
      if (chats.size == 0) continue;
      const links = Array.from(chats);
      excel_data.push([
        hashtag,
        `Тут не было хештега ${hashtag}`,
        links.join("\n"),
      ]);
    }
    this.excel.write_report(
      `${period.startDate.toDateString()} - ${period.endDate.toDateString()}`,
      [["Хештег", "Заголовок отчета", "Тело отчета"]]
    );
  }

  _get_period(): Period {
    const hour = this.report_time.split(":")[0];
    const minute = this.report_time.split(":")[1];
    const now = moment.tz(this.timezone);
    const startOfPeriod = now
      .clone()
      .day(this.report_day)
      .hour(Number(hour))
      .minute(Number(minute));
    const endOfPeriod = now
      .clone()
      .day(this.report_day)
      .add(1, "week")
      .hour(Number(hour) - 1)
      .minute(Number(minute) - 1);

    return {
      startDate: new Date(startOfPeriod.date()),
      endDate: new Date(endOfPeriod.date()),
    };
  }
}

const server = new Server();

process.once("SIGINT", () => server.stop("SIGINT"));
process.once("SIGTERM", () => server.stop("SIGTERM"));
