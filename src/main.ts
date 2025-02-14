import { config } from "dotenv";
config();
import moment from "moment-timezone";

import { Excel } from "./excel";
import { Chat, Period } from "./dtos";
import { Collector } from "./bot";

class Server {
  bot: Collector | null;
  excel: Excel | null;

  timezone: string | null;
  report_day: string | null;
  report_time: string[] | null;
  hashtags: string[] | null;

  matrix_headers: string[] = [
    "Хештег",
    "Заголовок отчета",
    "Название чата, id",
  ];

  constructor() {
    if (process.env.TARGET_ID && process.env.BOT_TOKEN) {
      this.bot = new Collector(
        process.env.BOT_TOKEN,
        Number(process.env.TARGET_ID)
      );
    } else {
      this.bot = null;
    }

    this.excel = process.env.GOOGLE_SHEET_ID
      ? new Excel(process.env.GOOGLE_SHEET_ID)
      : null;

    this.timezone = process.env.TIMEZONE || null;

    this.report_day = process.env.REPORT_DAY || null;
    this.report_time = process.env.REPORT_TIME?.split(":") || null;

    this.hashtags = process.env.HASHTAGS?.split(",") || null;
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
    this.bot?.launch();
  }

  stop(code: string) {
    if (this.bot != null) {
      this.bot?.stop(code);
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
        for (const [id, chat] of Object.entries(this.bot!.chats)) {
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
    this.bot!.write_report(period, link);
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
