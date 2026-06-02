import "./config/env";
import { logger } from "@fems/shared";
import { app } from "./app";

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  logger.info({ port }, "api-gateway listening");
});
