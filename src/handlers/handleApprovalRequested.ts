import fetch from "node-fetch";
import { getSheetsClient, getSheetName } from "../lib/sheets";
import "dotenv/config";


/**
 * Handles approval requests for a given Pretix event.
 * Fetches the blocklist from Google Sheets and validates all pending orders.
 */
export async function handleApprovalRequested(data: any) {
  const blocklist = await getBlockList();
  const eventSlug = data.event;
  await validatePendingOrders(eventSlug, blocklist);
}

/**
 * Fetches pending Pretix orders and automatically approves or denies them
 * based on whether the user’s email is on the blocklist.
 */
async function validatePendingOrders(eventSlug: string, blocklist: Set<string>) {
  const pretixUrl = process.env.PRETIX_API_URL!;
  const pretixToken = process.env.PRETIX_TOKEN!;

  console.log("Pretix token (partial):", pretixToken?.slice(0, 6));

  let pageUrl: string | null = `${pretixUrl}/organizers/esnhamburg/events/${eventSlug}/orders/?status=n`;

  console.log("Page URL:", pageUrl);

  while (pageUrl) {
    const response = await fetch(pageUrl, {
      headers: {
        Authorization: `Token ${pretixToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch pending orders: ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as {
      results: {
        code: string;
        status: string;
        email: string | null;
      }[];
      next: string | null;
    };

    for (const order of json.results) {
      // Skip cancelled orders
      if (order.status === "c") continue;

      const email = order.email ? order.email.toLowerCase().trim() : "";

      if (blocklist.has(email)) {
        console.log(`Disapproving (blocklisted): ${email} (${order.code})`);
        await disapproveOrder(eventSlug, order.code);
      } else {
        console.log(`Approving: ${email} (${order.code})`);
        await approveOrder(eventSlug, order.code);
      }
    }

    pageUrl = json.next;
  }
}

/**
 * Loads the blocklist from the Google Sheet.
 * Returns emails that have two missed events (i.e. data in column H or later).
 */
async function getBlockList(): Promise<Set<string>> {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.SHEET_ID_BLOCKLIST!;
  const sheetName = await getSheetName();

  const range = `${sheetName}!A5:Z`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = res.data.values || [];
  const blocklist = new Set<string>();

  for (const row of rows) {
    const email = row[0];
    if (!email) continue;

    const normalized = email.toLowerCase().trim();

    const secondEventCols = row.slice(7);

    // Check if there's any non-empty cell in H or beyond -> second missed event
    const hasSecondEvent = secondEventCols.some(cell => cell && cell.toString().trim() !== "");

    if (hasSecondEvent) {
      blocklist.add(normalized);
    }
  }

  console.log(`Blocklist contains ${blocklist.size} users with 2+ missed events.`);
  return blocklist;
}


/**
 * Approves a Pretix order
 */
async function approveOrder(eventSlug: string, orderCode: string) {
  const pretixUrl = process.env.PRETIX_API_URL!;
  const pretixToken = process.env.PRETIX_TOKEN!;
  const approveUrl = `${pretixUrl}/organizers/esnhamburg/events/${eventSlug}/orders/${orderCode}/approve/`;

  const response = await fetch(approveUrl, {
    method: "POST",
    headers: {
      Authorization: `Token ${pretixToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  console.log(`Approve response (${orderCode}): ${response.status}`);
}

/**
 * Denies a Pretix order
 */
async function disapproveOrder(eventSlug: string, orderCode: string) {
  const pretixUrl = process.env.PRETIX_API_URL!;
  const pretixToken = process.env.PRETIX_TOKEN!;
  const denyUrl = `${pretixUrl}/organizers/esnhamburg/events/${eventSlug}/orders/${orderCode}/deny/`;

  const response = await fetch(denyUrl, {
    method: "POST",
    headers: {
      Authorization: `Token ${pretixToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  console.log(`Disapprove response (${orderCode}): ${response.status}`);
}
