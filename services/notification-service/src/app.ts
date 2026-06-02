import "./config/env";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { asyncHandler, corsOrigin, errorHandler, httpLogger, notFound } from "@fems/shared";
import { db } from "./config/db";
import { swaggerDocument } from "./config/swagger";
import { notificationRoutes } from "./routes/notification.routes";

export const app = express();

app.use(helmet());
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(httpLogger);
app.get("/health", asyncHandler(async (_request, response) => {
  await db.query("SELECT 1");
  response.json({ service: "notification-service", status: "ok" });
}));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use(notificationRoutes);
app.use(notFound);
app.use(errorHandler);
