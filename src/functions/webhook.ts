import { Handler } from "@netlify/functions";
import { handleEventCreated } from "../handlers/handleEventCreated";
import { handleApprovalRequested } from "../handlers/handleApprovalRequested";


const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const data = JSON.parse(event.body || "{}");

    console.log("Webhook received:", data);

    switch (data.action) {
      case "pretix.event.added":
        await handleEventCreated(data);
        break;

      case "pretix.event.order.placed.require_approval":
        await handleApprovalRequested(data);
        break;

      default:
        console.log("Unhandled action:", data.action);
    }

    return { statusCode: 200, body: "ok" };
  } catch (err) {
    console.error("Error handling webhook:", err);
    return { statusCode: 500, body: "Error" };
  }
};

export { handler };
