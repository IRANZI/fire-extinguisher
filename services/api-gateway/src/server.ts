import "./env";
import axios from "axios";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createProxyMiddleware } from "http-proxy-middleware";
import swaggerUi from "swagger-ui-express";
import { httpLogger, logger } from "@fems/shared";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const authUrl = process.env.AUTH_SERVICE_URL ?? "http://localhost:4001";
const inventoryUrl = process.env.INVENTORY_SERVICE_URL ?? "http://localhost:4002";
const notificationUrl = process.env.NOTIFICATION_SERVICE_URL ?? "http://localhost:4003";

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL?.split(",") ?? ["http://localhost:5173"],
    credentials: true,
  }),
);
app.use(httpLogger);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 800,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);

app.get("/health", async (_request, response) => {
  const services = await Promise.allSettled([
    axios.get(`${authUrl}/health`),
    axios.get(`${inventoryUrl}/health`),
    axios.get(`${notificationUrl}/health`),
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
      "/api/inventory/*": { get: { summary: "Proxy to inventory service", responses: { "200": { description: "See inventory service docs" } } } },
      "/api/notification/*": { get: { summary: "Proxy to notification service", responses: { "200": { description: "See notification service docs" } } } },
    },
  }),
);

app.use(
  createProxyMiddleware({
    pathFilter: "/api/auth/**",
    target: authUrl,
    changeOrigin: true,
    pathRewrite: { "^/api": "" },
  }),
);
app.use(
  createProxyMiddleware({
    pathFilter: "/api/inventory/**",
    target: inventoryUrl,
    changeOrigin: true,
    pathRewrite: { "^/api/inventory": "" },
  }),
);
app.use(
  createProxyMiddleware({
    pathFilter: "/api/notification/**",
    target: notificationUrl,
    changeOrigin: true,
    pathRewrite: { "^/api/notification": "" },
  }),
);

app.use((_request, response) => response.status(404).json({ message: "Gateway route not found" }));

app.listen(port, () => {
  logger.info({ port, authUrl, inventoryUrl, notificationUrl }, "api-gateway listening");
});
