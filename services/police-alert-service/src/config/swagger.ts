export const swaggerDocument = {
  openapi: "3.0.3",
  info: {
    title: "SafeHub Police Alert Service API",
    version: "1.0.0",
    description: "Compliance escalation review for police and administrators.",
  },
  servers: [{ url: "http://localhost:4005" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/reports/police": {
      get: { summary: "List police compliance reports", responses: { "200": { description: "Reports" } } },
    },
    "/reports/police/{id}": {
      patch: { summary: "Update police report status", responses: { "200": { description: "Report updated" } } },
    },
  },
};
