import { handleApprovalRequested } from "../src/handlers/handleApprovalRequested";

(async () => {
  try {
    // Fake Pretix payload
    const fakePayload = {
      event: { slug: "test-webhooks" },
    };

    await handleApprovalRequested(fakePayload);
    console.log("Successfully executed handleApprovalRequested");
  } catch (err) {
    console.error("Error running handleEventCreated:", err);
  }
})();