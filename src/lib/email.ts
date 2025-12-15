import { google } from "googleapis";
import "dotenv/config";

export async function sendGmailEmail(to: string, subject: string, body: string) {
  const creds = JSON.parse(process.env.GOOGLE_JSON_KEY!);

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/gmail.send"]
  });

  const gmail = google.gmail({ version: "v1", auth });

  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\n");

  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "pretix-blocklist@pretix-blocklist.iam.gserviceaccount.com", // if you’ve delegated, replace with the actual user email ""lina.meyer@esnhamburg.de
    requestBody: {
      raw: encodedMessage,
    },
  });

  console.log(`📧 Email sent to ${to}`);
}
