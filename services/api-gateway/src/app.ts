import "./config/env";
import axios from "axios";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { corsOrigin, httpLogger } from "@fems/shared";
import { serviceUrls } from "./config/services";
import { gatewayLimiter } from "./middlewares/rateLimit.middleware";
import { registerProxyRoutes } from "./routes/proxy.routes";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);
app.use(httpLogger);
app.use(gatewayLimiter);

app.get("/health", async (_request, response) => {
  const services = await Promise.allSettled([
    axios.get(`${serviceUrls.auth}/health`),
    axios.get(`${serviceUrls.extinguisher}/health`),
    axios.get(`${serviceUrls.notification}/health`),
    axios.get(`${serviceUrls.customer}/health`),
    axios.get(`${serviceUrls.policeAlert}/health`),
    axios.get(`${serviceUrls.report}/health`),
  ]);
  const status = services.map((result) =>
    result.status === "fulfilled" ? result.value.data : { status: "unavailable" },
  );
  response.status(services.every((result) => result.status === "fulfilled") ? 200 : 503).json({
    service: "api-gateway",
    services: status,
  });
});

app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup({
    openapi: "3.0.3",
    info: {
      title: "SafeHub API Gateway",
      version: "1.0.0",
      description:
        "Gateway entry point. Detailed Swagger documentation is available from each microservice.",
    },
    paths: {
      "/api/auth/*": { get: { summary: "Proxy to auth service", responses: { "200": { description: "See auth service docs" } } } },
      "/api/customers/*": { get: { summary: "Proxy to customer service", responses: { "200": { description: "See customer service docs" } } } },
      "/api/extinguishers/*": { get: { summary: "Proxy to extinguisher service", responses: { "200": { description: "See extinguisher service docs" } } } },
      "/api/reports/*": { get: { summary: "Proxy to report service", responses: { "200": { description: "See report service docs" } } } },
      "/api/police-alerts/*": { get: { summary: "Proxy to police alert service", responses: { "200": { description: "See police alert service docs" } } } },
      "/api/inventory/*": { get: { summary: "Compatibility proxy for existing clients", responses: { "200": { description: "See domain service docs" } } } },
      "/api/notification/*": { get: { summary: "Proxy to notification service", responses: { "200": { description: "See notification service docs" } } } },
    },
  }),
);

registerProxyRoutes(app);

app.use((_request, response) => response.status(404).json({ message: "Gateway route not found" }));
