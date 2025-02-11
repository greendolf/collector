import { google, sheets_v4 } from "googleapis";

export class Excel {
  readonly sheets_id: string;
  readonly sheets: sheets_v4.Sheets;

  constructor(sheet_id: string) {
    this.sheets_id = sheet_id;

    const auth = new google.auth.GoogleAuth({
      keyFile: `${process.cwd()}/auth.json`,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    this.sheets = google.sheets({ version: "v4", auth });
  }

  async write_report(period: string, data: string[][]) {
    try {
      const new_sheet = await this._create_new_sheet(period);
      if (!new_sheet) throw "error";

      const writeResponse = await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.sheets_id,
        range: `${period}!A1`, // диапазон ячеек
        valueInputOption: "RAW",
        requestBody: {
          values: data, // Данные для записи
        },
      });

      console.log(writeResponse.data);

      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.sheets_id,
        fields: "sheets(properties(sheetId,title))",
      });

      const sheet = response.data.sheets?.find(
        (s) => s.properties?.title === period
      )!.properties!.sheetId;

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.sheets_id,
        requestBody: {
          requests: [
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId: sheet, // ID листа (обычно 0 для первого листа)
                  dimension: "COLUMNS",
                  startIndex: 0, // Начальный индекс столбца
                  endIndex: data[0].length, // Конечный индекс столбца
                },
              },
            },
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId: sheet, // ID листа (обычно 0 для первого листа)
                  dimension: "ROWS",
                  startIndex: 0, // Начальный индекс столбца
                  endIndex: data.length, // Конечный индекс столбца
                },
              },
            },
          ],
        },
      });
      return [this.sheets_id, sheet];
    } catch (e) {
      console.error(e);
    }
  }

  async _create_new_sheet(name: string) {
    const request = {
      spreadsheetId: this.sheets_id,
      resource: {
        requests: [
          {
            addSheet: {
              properties: {
                title: name,
              },
            },
          },
        ],
      },
    };

    return this.sheets.spreadsheets.batchUpdate(request);
  }
}
