import { google } from "googleapis";
import { Handler } from "@netlify/functions";

const handler: Handler = async () => {
  const creds = JSON.parse(process.env.GOOGLE_JSON_KEY!);

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  const sheets = google.sheets({ version: "v4", auth });

  const spreadsheetId = process.env.SHEET_ID_LOGS; // from URL of your sheet

  // Example: append one row
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Sheet1!A200", 
    valueInputOption: "RAW",
    requestBody: {
      values: [["hello", "world", new Date().toISOString()]]
    }
  });

  return {
    statusCode: 200,
    body: "Row added"
  };
};

export { handler };