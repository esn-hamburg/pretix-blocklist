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

/**
 * Checks if all items named "Regular Ticket" are free (default_price = "0.00")
 * for the given Pretix event.
 */
async function isEventFree(eventSlug: string): Promise<boolean> {
  const pretixUrl = process.env.PRETIX_API_URL!;
  const pretixToken = process.env.PRETIX_TOKEN!;
  const organizer = "esnhamburg";

  const response = await fetch(
    `${pretixUrl}organizers/${organizer}/events/${eventSlug}/items/`,
    {
      headers: {
        Authorization: `Token ${pretixToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    console.error(`Failed to fetch items for event ${eventSlug}: ${response.statusText}`);
    return false;
  }

  const data = await response.json();
  const items = data.results || [];

  // Filter items named "Regular Ticket"
  const regularTickets = items.filter(
    (item: any) => item.name?.en === "Regular Ticket" || item.name?.de === "Regular Ticket"
  );

  if (regularTickets.length === 0) {
    console.log(`No 'Regular Ticket' items found for event ${eventSlug}`);
    return false;
  }

  // Check if all Regular Tickets are free
  const isFree = regularTickets.every(
    (item: any) => parseFloat(item.default_price) === 0
  );

  if (isFree) {
    console.log(`Event ${eventSlug}: 'Regular Ticket' is free.`);
  }
  else {
      console.log(`Event ${eventSlug}: 'Regular Ticket' is not free.`);
  }


  return isFree;
}




export async function handleEventCreated(data: any) {
  const sheets = await getSheetsClient();

  const sheetId = process.env.SHEET_ID_BLOCKLIST!;
  const sheetName = "Info";

  const eventSlug = data.event;

  // Pretix API base URL + token from env vars
  const pretixUrl = process.env.PRETIX_API_URL!;
  const pretixToken = process.env.PRETIX_TOKEN!;


  const isFreeEvent = await isEventFree(eventSlug);
  if (!isFreeEvent) {
    console.log(`Event ${eventSlug} is not free, skipping.`);
    return;
  }

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