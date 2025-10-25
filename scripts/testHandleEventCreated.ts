import { handleEventCreated } from "../src/handlers/handleEventCreated";

(async () => {
  try {
    // Fake Pretix payload
    const fakePayload = {
      event: "spree-b251121", // "speedfr241022", // /speedat251024
    };

    await handleEventCreated(fakePayload);
    console.log("Successfully executed handleEventCreated");
  } catch (err) {
    console.error("Error running handleEventCreated:", err);
  }
})();