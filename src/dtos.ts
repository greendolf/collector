export class Message {
  id: number;
  date: Date;
  text: string;
  constructor(id: number, date: Date, text: string) {
    this.id = id;
    this.date = date;
    this.text = text;
  }
}

export class Chat {
  id: number;
  messages: Message[] = [];
  title?: string;
  constructor(id: number, title?: string) {
    this.id = id;
    this.title = title;
  }
}

export interface Period {
  startDate: Date;
  endDate: Date;
  formatted: string;
}

export class Settings {
  bot_token: string;
  google_sheet_id: string;
  target_id: number;
  timezone: string;
  report_day: number;
  report_time: string[];
  period: string[];
  hashtags: {
    hashtag: string;
    header: string;
  }[];
  constructor({
    bot_token,
    google_sheet_id,
    target_id,
    timezone,
    report_day,
    report_time,
    period,
    hashtags,
  }: Settings) {
    this.bot_token = bot_token;
    this.google_sheet_id = google_sheet_id;
    this.target_id = target_id;
    this.timezone = timezone;
    this.report_day = report_day;
    this.report_time = report_time;
    this.period = period;
    this.hashtags = hashtags;
  }
}
