import "./config/env";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { asyncHandler, authenticate, corsOrigin, errorHandler, httpLogger, notFound } from "@fems/shared";
import { db } from "./config/db";
import { swaggerDocument } from "./config/swagger";
import { policeAlertRoutes } from "./routes/policeAlert.routes";

export const app = express();

app.use(helmet());
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(httpLogger);
app.get("/health", asyncHandler(async (_request, response) => {
  await db.query("SELECT 1");
  response.json({ service: "police-alert-service", status: "ok" });
}));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use("/reports/police", authenticate, policeAlertRoutes);
app.use("/police-alerts", authenticate, policeAlertRoutes);
app.use(notFound);
app.use(errorHandler);
