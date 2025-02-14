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

  async write_data(sheet: string, data: string[][]) {
    try {
      const writeResponse = await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.sheets_id,
        range: `${sheet}!A1`, // диапазон ячеек
        valueInputOption: "RAW",
        requestBody: {
          values: data, // Данные для записи
        },
      });

      const sheetId = await this.get_sheet_id(sheet);

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.sheets_id,
        requestBody: {
          requests: [
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId,
                  dimension: "COLUMNS",
                  startIndex: 0,
                  endIndex: data[0].length,
                },
              },
            },
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId,
                  dimension: "ROWS",
                  startIndex: 0,
                  endIndex: data.length,
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

  async create_new_sheet(name: string) {
    try {
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

      await this.sheets.spreadsheets.batchUpdate(request);

      return this.get_sheet_id(name);
    } catch (e) {
      console.error(e);
    }
  }

  async get_sheet_id(name: string) {
    const response = await this.sheets.spreadsheets.get({
      spreadsheetId: this.sheets_id,
      fields: "sheets(properties(sheetId,title))",
    });

    const sheetId = response.data.sheets?.find(
      (s) => s.properties?.title === name
    )!.properties!.sheetId;

    return sheetId;
  }

  get_sheet_link(sheet_id: number) {
    return `https://docs.google.com/spreadsheets/d/${this.sheets_id}/edit#gid=${sheet_id}`;
  }
}
