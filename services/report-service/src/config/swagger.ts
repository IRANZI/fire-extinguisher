export const swaggerDocument = {
  openapi: "3.0.3",
  info: {
    title: "SafeHub Report Service API",
    version: "1.0.0",
    description: "Dashboard, management, and audit reporting.",
  },
  servers: [{ url: "http://localhost:4006" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/reports/summary": {
      get: { summary: "Return role-aware dashboard totals", responses: { "200": { description: "Summary" } } },
    },
    "/reports/management": {
      get: { summary: "Return management reports", responses: { "200": { description: "Management report" } } },
    },
    "/logs": {
      get: { summary: "Return audit logs", responses: { "200": { description: "Audit logs" } } },
    },
  },
};
