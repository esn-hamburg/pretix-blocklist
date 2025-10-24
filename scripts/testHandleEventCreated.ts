import { handleEventCreated } from "../src/handlers/handleEventCreated";

(async () => {
  try {
    // Fake Pretix payload
    const fakePayload = {
      event: { slug: "speedfr241022" },
    };

    await handleEventCreated(fakePayload);
    console.log("Successfully executed handleEventCreated");
  } catch (err) {
    console.error("Error running handleEventCreated:", err);
  }
})();