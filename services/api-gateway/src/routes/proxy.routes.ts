import { Application } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { serviceUrls } from "../config/services";

const matchesPrefix = (prefixes: string[]) => (path: string) =>
  prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

const stripApiPrefix = (path: string) =>
  path.replace(/^\/api\/inventory/, "").replace(/^\/api/, "");

const registerProxy = (
  app: Application,
  target: string,
  prefixes: string[],
  pathRewrite: (path: string) => string = stripApiPrefix,
) => {
  app.use(
    createProxyMiddleware({
      pathFilter: matchesPrefix(prefixes),
      target,
      changeOrigin: true,
      pathRewrite,
    }),
  );
};

export const registerProxyRoutes = (app: Application) => {
  registerProxy(app, serviceUrls.auth, ["/api/auth"]);
  registerProxy(app, serviceUrls.customer, ["/api/customers", "/api/inventory/customers"]);
  registerProxy(app, serviceUrls.policeAlert, ["/api/police-alerts", "/api/inventory/reports/police"]);
  registerProxy(app, serviceUrls.report, [
    "/api/reports",
    "/api/logs",
    "/api/inventory/reports",
    "/api/inventory/logs",
  ]);
  registerProxy(app, serviceUrls.extinguisher, [
    "/api/extinguishers",
    "/api/inspections",
    "/api/service-requests",
    "/api/notifications",
    "/api/settings",
    "/api/inventory/extinguishers",
    "/api/inventory/inspections",
    "/api/inventory/service-requests",
    "/api/inventory/notifications",
    "/api/inventory/settings",
  ]);
  registerProxy(
    app,
    serviceUrls.notification,
    ["/api/notification"],
    (path) => path.replace(/^\/api\/notification/, ""),
  );
};
