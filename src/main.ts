import moment from "moment-timezone";

import { Excel } from "./excel";
import { Chat, Period, Settings } from "./dtos";
import { Collector } from "./bot";
import importFresh from "import-fresh";
import path from "path";

class Server {
  bot!: Collector;
  excel!: Excel;

  settings!: Settings;

  matrix_headers: string[] = [
    "Хештег",
    "Заголовок отчета",
    "Название чата, id",
  ];

  constructor() {
    this.init();
  }

  async init() {
    await this.load_settings();

    this.bot = new Collector();

    this.excel = new Excel(this.settings.google_sheet_id);

    setInterval(async () => {
      const now = moment.tz(this.settings.timezone);
      await this.load_settings();
      console.log(
        `${now.format("HH:mm")}, ${this.settings.report_time.join(":")}`
      );
      if (
        now.format("HH:mm") === this.settings.report_time.join(":") &&
        now.day() === this.settings.report_day
      ) {
        this.form_report();
      }
    }, 60000);
  }

  async load_settings() {
    const file_path = path.join(__dirname, "../settings.json");
    const settings = importFresh(file_path) as Settings;
    this.settings = settings;
    return settings;
  }

  stop(code: string) {
    if (this.bot != null) {
      this.bot?.stop(code);
    }
  }

  async form_report() {
    try {
      const period = this._get_period(
        this.settings.timezone!,
        this.settings.report_day,
        this.settings.report_time,
        this.settings.period
      );

      const hashtags_not_found: Record<string, Chat[]> = {};

      this.settings.hashtags.forEach((hashtag) => {
        hashtags_not_found[hashtag.hashtag] = [];
        for (const [id, chat] of Object.entries(this.bot!.chats)) {
          hashtags_not_found[hashtag.hashtag].push(chat);
          for (const message of chat.messages) {
            if (
              message.date >= period.startDate &&
              message.date <= period.endDate &&
              message.text.includes(hashtag.hashtag)
            ) {
              hashtags_not_found[hashtag.hashtag].pop();
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
    report_day: number,
    report_time: string[],
    period: string[]
  ): Period {
    const hour = report_time[0];
    const minute = report_time[1];
    const now = moment.tz(timezone);
    const endOfPeriod = now.clone();
    const startOfPeriod = endOfPeriod
      .clone()
      .subtract(Number(period[0]), "week")
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
