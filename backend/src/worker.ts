import { config } from "./config";
import { startNotificationWorker, stopNotificationWorker } from "./notification-worker";

console.log(`[notification-worker] process booting, env=${config.nodeEnv}`);
startNotificationWorker();

function shutdown(): void {
  stopNotificationWorker();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
