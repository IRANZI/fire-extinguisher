import "./config/env";
import { logger } from "@fems/shared";
import { app } from "./app";
import { db } from "./config/db";

const port = Number(process.env.PORT ?? 4005);

db.query("SELECT 1")
  .then(() => app.listen(port, () => logger.info({ port }, "police-alert-service listening")))
  .catch((error) => {
    logger.fatal(error, "police-alert-service failed to start");
    process.exit(1);
  });
