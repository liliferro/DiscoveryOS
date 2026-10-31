import { processJobStep } from "../lib/job-runner.ts";
let running = false;
console.log("Discovery OS · worker local · informes predefinidos simulados");
setInterval(async () => {
  if (running) return;
  running = true;
  try {
    await processJobStep();
  } catch {
    console.error("WORKER_STORAGE_ERROR");
  } finally {
    running = false;
  }
}, 750);
