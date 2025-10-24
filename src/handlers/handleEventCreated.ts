import { getSheetsClient } from "../lib/sheets";
require("node-fetch");
//import fetch from "node-fetch";
import "dotenv/config";

type PretixEvent = {
  slug: string;
  name: { [lang: string]: string };
  date_from: string;
  date_to?: string | null;
};

export async function handleEventCreated(data: any) {
  const sheets = await getSheetsClient();

  const sheetId = process.env.SHEET_ID_BLOCKLIST!;
  const sheetName = "Info";

  const eventSlug = data.event;

  // Pretix API base URL + token from env vars
  const pretixUrl = process.env.PRETIX_API_URL!;
  const pretixToken = process.env.PRETIX_TOKEN!;

  // Fetch event details
  const response = await fetch(
    `${pretixUrl}/organizers/esnhamburg/events/${eventSlug}/`,
    {
      headers: {
        Authorization: `Token ${pretixToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch event: ${response.statusText}`);
  }

  const eventDetails = (await response.json()) as PretixEvent;


  // Check if slug already exists in the sheet
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${sheetName}!A:A`,
  });

  const existingSlugs =
    existing.data.values?.flat().map((s) => s.toString().trim()) || [];

  if (existingSlugs.includes(eventDetails.slug)) {
    console.log(`Slug "${eventDetails.slug}" already exists. Not adding it to the list.`);
    return; 
  }


  // Determine end time
  const startTime = new Date(eventDetails.date_from);
  let endTime: string;
  if (eventDetails.date_to) {
    endTime = eventDetails.date_to;
  } else {
    endTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }

  // Row values: [Slug, Name, Start, End, Checked?]
  const values = [[
    eventDetails.slug,
    eventDetails.name?.en || eventDetails.name?.de || eventDetails.slug,
    eventDetails.date_from,
    endTime,
    "no"
  ]];

  // Append to Info sheet
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${sheetName}!A:E`,
    valueInputOption: "RAW",
    requestBody: { values },
  });
}