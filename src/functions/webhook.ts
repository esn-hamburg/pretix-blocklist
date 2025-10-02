import { Handler } from "@netlify/functions";

const handler: Handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const action = body.action;

    switch (action) {
      case "event.created":
        console.log("New event created:", body.event);
        // TODO: create a scheduled function trigger here
        break;

      case "order.approval_requested":
        console.log("Approval requested for order:", body.code);
        // TODO: check blacklist, then call Pretix API to approve/deny
        break;

      default:
        console.log("Unhandled action:", action);
    }

    return {
      statusCode: 200,
      body: "ok",
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "error" };
  }
};

export { handler };