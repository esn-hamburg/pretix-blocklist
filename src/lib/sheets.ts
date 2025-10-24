import { google } from "googleapis";
import { JWT } from 'google-auth-library';
import "dotenv/config";


export async function getSheetsClient() {
  const creds = JSON.parse(process.env.GOOGLE_JSON_KEY!);

  const auth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

export async function getSheetName(): Promise<string> {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.SHEET_ID_BLOCKLIST!;
  const sheetName = "Info";

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!C2`,
  });

  const value = res.data.values?.[0]?.[0];

  if (!value || typeof value !== "string") {
    throw new Error(`Cell C2 in "${sheetName}" sheet is empty or invalid.`);
  }

  return value.trim();
}