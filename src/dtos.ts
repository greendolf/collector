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
  constructor(id: number) {
    this.id = id;
  }
}

export interface Period {
  startDate: Date;
  endDate: Date;
}
