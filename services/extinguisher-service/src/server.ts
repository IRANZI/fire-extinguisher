import "./config/env";
import { logger } from "@fems/shared";
import { app } from "./app";
import { db } from "./config/db";

const port = Number(process.env.PORT ?? 4002);

const start = async () => {
  await db.query("SELECT 1");
  app.listen(port, () => logger.info({ port }, "extinguisher-service listening"));
};

start().catch((error) => {
  logger.fatal(error, "extinguisher-service failed to start");
  process.exit(1);
});
