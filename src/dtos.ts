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
