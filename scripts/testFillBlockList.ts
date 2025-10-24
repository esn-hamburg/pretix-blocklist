import { fillBlockList } from "../src/functions/fillBlockList";

(async () => {
  try {
    await fillBlockList();
    console.log("Successfully executed handleEventCreated");
  } catch (err) {
    console.error("Error running handleEventCreated:", err);
  }
})();