export const serviceUrls = {
  auth: process.env.AUTH_SERVICE_URL ?? "http://localhost:4001",
  extinguisher: process.env.EXTINGUISHER_SERVICE_URL ?? process.env.INVENTORY_SERVICE_URL ?? "http://localhost:4002",
  notification: process.env.NOTIFICATION_SERVICE_URL ?? "http://localhost:4003",
  customer: process.env.CUSTOMER_SERVICE_URL ?? "http://localhost:4004",
  policeAlert: process.env.POLICE_ALERT_SERVICE_URL ?? "http://localhost:4005",
  report: process.env.REPORT_SERVICE_URL ?? "http://localhost:4006",
};
