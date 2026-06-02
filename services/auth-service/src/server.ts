import "./config/env";
import { logger } from "@fems/shared";
import { app } from "./app";
import { db } from "./config/db";
import { ensureBootstrapAdmin } from "./services/auth.service";

const port = Number(process.env.PORT ?? 4001);

const start = async () => {
  await db.query("SELECT 1");
  await ensureBootstrapAdmin();
  app.listen(port, () => logger.info({ port }, "auth-service listening"));
};

start().catch((error) => {
  logger.fatal(error, "auth-service failed to start");
  process.exit(1);
});
