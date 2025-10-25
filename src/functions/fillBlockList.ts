//import fetch from "node-fetch";
require("node-fetch");
import "dotenv/config";
import type { Config } from "@netlify/functions"
import { getSheetsClient, getSheetName } from "../lib/sheets";

type PretixEvent = {
  slug: string;
  name: { [lang: string]: string };
  date_from: string;
  date_to?: string | null;
};

type MissedMap = Record<
  string,
  { first: string; last: string }
>;

type PretixOrder = {
  status: string;
  email: string;
  positions: {
    checkins: any[];
    answers: { question_identifier: string; answer: string }[];
  }[];
};

type PretixOrderResponse = {
  results: PretixOrder[];
  next: string | null;
};

/**
 * Fetch all Pretix orders for an event and return the list of no-shows.
 */
async function getNoShows(eventSlug: string): Promise<MissedMap> {
  const pretixUrl = process.env.PRETIX_API_URL!;
  const pretixToken = process.env.PRETIX_TOKEN!;

  let ordersUrl : string | null = `${pretixUrl}organizers/esnhamburg/events/${eventSlug}/orders`;
  const missed: MissedMap = {};

  while (ordersUrl) {
    const response = await fetch(ordersUrl, {
      headers: {
        Authorization: `Token ${pretixToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch orders: ${response.statusText}`);
    }

    const json = (await response.json()) as PretixOrderResponse;

    for (const order of json.results) {
      if (order.status === "c") continue;

      const hasUnchecked = order.positions.some(
        (p: any) => Array.isArray(p.checkins) && p.checkins.length === 0
      );

      if (hasUnchecked) {
        const email = order.email;
        let firstName = "";
        let lastName = "";

        order.positions[0].answers.forEach((a: any) => {
          if (a.question_identifier === "RFRGMYPK") firstName = a.answer || "";
          if (a.question_identifier === "ZRV87CSB") lastName = a.answer || "";
        });

        missed[email] = { first: firstName, last: lastName };
        console.log(`${email} missed event ${eventSlug}`);
      }
    }

    ordersUrl = json.next;
  }

  return missed;
}

/**
 * Add no-shows to the blocklist sheet, creating or updating rows.
 */
async function addNoShowToList(
  missed: MissedMap,
  eventSlug: string,
  eventDetails: PretixEvent
) {
  const sheets = await getSheetsClient();
  const blockListSheetId = process.env.SHEET_ID_BLOCKLIST!;
  const sheetName = await getSheetName();

  const today = new Date().toISOString().split("T")[0];
  const eventName = eventDetails.name?.en || eventSlug;
  const eventDate = eventDetails.date_from.split("T")[0];

  const sheetData = await sheets.spreadsheets.values.get({
    spreadsheetId: blockListSheetId,
    range: `${sheetName}!A:Z`,
  });

  const data = sheetData.data.values || [];
  const emailCol = 0; // Column A (0-based index)

  for (const [email, info] of Object.entries(missed)) {
    const foundRowIndex = data.findIndex(
      (row) => row[emailCol]?.toLowerCase().trim() === email.toLowerCase()
    );

    if (foundRowIndex === -1) {
      // New participant
      const newRow = [
        email,
        info.first,
        info.last,
        eventSlug,
        eventName,
        eventDate,
        today,
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: blockListSheetId,
        range: `${sheetName}!A:K`,
        valueInputOption: "RAW",
        requestBody: { values: [newRow] },
      });
      console.log(`Added new no-show: ${email}`);
    } else {
      // Existing participant -> find next free event slot (every 4 columns after col D)
      const row = data[foundRowIndex];
      let insertCol = -1;
      for (let c = 3; c < data[3].length; c += 4) {
        if (!row[c]) {
          insertCol = c;
          break;
        }
      }

      if (insertCol === -1) {
        console.warn(`No free slot for ${email}`);
        continue;
      }

      const range = `${sheetName}!${String.fromCharCode(
        65 + insertCol
      )}${foundRowIndex + 1}:${String.fromCharCode(65 + insertCol + 3)}${
        foundRowIndex + 1
      }`;

      await sheets.spreadsheets.values.update({
        spreadsheetId: blockListSheetId,
        range,
        valueInputOption: "RAW",
        requestBody: {
          values: [[eventSlug, eventName, eventDate, today]],
        },
      });
      console.log(`Updated no-show record for ${email}`);
    }
  }
}

/**
 * Process all unchecked events in the "Info" sheet:
 * find their no-shows, add them to the blocklist,
 * and mark them as checked.
 */
export async function fillBlockList() {
  const sheets = await getSheetsClient();
  const infoSheetId = process.env.SHEET_ID_BLOCKLIST!;
  const sheetName = "Info";

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: infoSheetId,
    range: `${sheetName}!A:E`,
  });

  const rows = res.data.values || [];
  if (rows.length < 2) {
    console.log("No data rows found.");
    return;
  }


  for (let i = 6; i < rows.length; i++) {
    const [slug, , , endDate, checked] = rows[i];
    if (!slug) continue;
    if (checked?.toLowerCase() !== "no") continue;

    // Parse event end date
    const eventEnd = new Date(endDate);
    if (isNaN(eventEnd.getTime())) {
      console.warn(`Invalid end date for event ${slug}: ${endDate}`);
      continue;
    }

    const now = new Date();
    // Only process if the event has ended (end date before now)
    if (eventEnd > now) {
      console.log(`Event ${slug} has not ended yet (${endDate}), skipping.`);
      continue;
    }

    console.log(`Processing unchecked ended event: ${slug}`);

    // Fetch event details
    const pretixUrl = process.env.PRETIX_API_URL!;
    const pretixToken = process.env.PRETIX_TOKEN!;

    const eventResponse = await fetch(
      `${pretixUrl}organizers/esnhamburg/events/${slug}/`,
      {
        headers: {
          Authorization: `Token ${pretixToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!eventResponse.ok) {
      console.error(`Failed to fetch event ${slug}: ${eventResponse.statusText}`);
      continue;
    }

    const eventDetails = (await eventResponse.json()) as PretixEvent;

    // Get no-shows
    const missed = await getNoShows(slug);

    if (Object.keys(missed).length === 0) {
      console.log(`No no-shows for ${slug}`);
    } else {
      await addNoShowToList(missed, slug, eventDetails);
    }

    // Mark event as checked
    const rowNumber = i + 1; // 1-based for Sheets API
    await sheets.spreadsheets.values.update({
      spreadsheetId: infoSheetId,
      range: `${sheetName}!E${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [["yes"]] },
    });

    console.log(`Marked event ${slug} as checked.`);
  }

  console.log("Successfully executed fillBlockList");
}


/**
 * Scheduled Netlify Function
 */
export default async (req: Request) => {
  console.log("fillBlockList triggered via scheduled function");

  try {
    await fillBlockList();
    console.log("fillBlockList completed successfully");
  } catch (error) {
    console.error("fillBlockList failed:", error);
  }

  const { next_run } = await req.json()
  console.log("Next fillBlockList invocation at:", next_run)

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};


export const config: Config = {
  schedule: "0 9 * * *", // run daily at 09:00 UTC = 10:00 in winter, 11:00 in summer Berlin time
};