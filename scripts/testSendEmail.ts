import { sendGmailEmail } from "../src/lib/email";

(async () => {
  try {
    const recipient = "lina.meyer@posteo.de";
    const subject = "Test Gmail API";
    const body = "Test successful! :)";
    await sendGmailEmail(recipient, subject, body);
    console.log("Successfully executed sendGmailEmail");
  } catch (err) {
    console.error("Error running sendGmailEmail:", err);
  }
})();