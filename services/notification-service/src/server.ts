import "./config/env";
import cron from "node-cron";
import { logger } from "@fems/shared";
import { app } from "./app";
import { db } from "./config/db";
import { runScan } from "./services/notification.service";

const port = Number(process.env.PORT ?? 4003);

const start = async () => {
  await db.query("SELECT 1");
  const schedule = process.env.SCAN_CRON ?? "0 8 * * *";
  if (!cron.validate(schedule)) throw new Error(`Invalid SCAN_CRON expression: ${schedule}`);
  cron.schedule(schedule, () => {
    runScan().catch((error) => logger.error(error, "scheduled expiry scan failed"));
  });
  app.listen(port, () => logger.info({ port, schedule }, "notification-service listening"));
};

start().catch((error) => {
  logger.fatal(error, "notification-service failed to start");
  process.exit(1);
});
