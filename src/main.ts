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
  hashtags: string[];

  constructor() {
    this.hashtags = process.env.HASHTAGS!.split(",");
    this.collector.launch();
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

  stop(code: string) {
    this.collector.stop(code);
  }

  async form_report() {
    try {
      const period = this._get_period();
      const hashtags_not_found: Record<string, Chat[]> = {};
      for (const hashtag of this.hashtags) {
        hashtags_not_found[hashtag] = [];
        for (const [id, chat] of Object.entries(this.collector.chats)) {
          hashtags_not_found[hashtag].push(chat);
          for (const message of chat.messages) {
            console.log(
              `${period.startDate}, ${message.date}, ${period.endDate}`
            );
            if (
              message.date >= period.startDate &&
              message.date <= period.endDate &&
              message.text.includes(hashtag)
            ) {
              hashtags_not_found[hashtag].pop();
              break;
            } else {
              console.log(`${message.text} dont include ${hashtag}`);
            }
          }
        }
      }
      console.log(hashtags_not_found);
      let excel_data = [];
      for (const [hashtag, chats] of Object.entries(hashtags_not_found)) {
        if (chats.length == 0) continue;
        const links = Array.from(chats).map((it) => [it.title, it.id]);
        excel_data.push([
          hashtag,
          `Тут не было хештега ${hashtag}`,
          links.join("\n"),
        ]);
      }
      excel_data = [
        ["Хештег", "Заголовок отчета", "Тело отчета"],
        ...excel_data,
      ];
      const [spreadsheet_id, sheet_id] = (await this.excel.write_report(
        `${moment(period.startDate).format("DD-MM-YYYY")} - ${moment(
          period.endDate
        ).format("DD-MM-YYYY")}`,
        excel_data
      ))!;
      const link = `https://docs.google.com/spreadsheets/d/${spreadsheet_id}/edit#gid=${sheet_id}`;
      this.collector.write_report(
        `${moment(period.startDate).format("DD-MM-YYYY")} - ${moment(
          period.endDate
        ).format("DD-MM-YYYY")}`,
        link
      );
    } catch (e) {
      console.error(e);
    }
  }

  _get_period(): Period {
    const hour = this.report_time.split(":")[0];
    const minute = this.report_time.split(":")[1];
    const now = moment.tz(this.timezone);
    const endOfPeriod = now.clone();
    // .day(this.report_day)
    // .hour(Number(hour))
    // .minute(Number(minute));
    const startOfPeriod = now
      .clone()
      .day(this.report_day)
      .subtract(1, "week")
      .hour(Number(hour) - 1)
      .minute(Number(minute) - 1);
    return {
      startDate: new Date(startOfPeriod.toDate()),
      endDate: new Date(endOfPeriod.toDate()),
    };
  }
}

const server = new Server();

process.once("SIGINT", () => server.stop("SIGINT"));
process.once("SIGTERM", () => server.stop("SIGTERM"));
