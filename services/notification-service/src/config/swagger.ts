export const swaggerDocument = {
  openapi: "3.0.3",
  info: {
    title: "SafeHub Notification Service API",
    version: "1.0.0",
    description: "Scheduled email delivery and expiry scan orchestration.",
  },
  servers: [{ url: "http://localhost:4003" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
  paths: {
    "/notifications/scan": {
      post: {
        summary: "Run the expiry scan immediately",
        description: "ADMIN and STAFF only. The worker also runs on the configured cron schedule.",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Scan summary" } },
      },
    },
    "/internal/notifications/scan": {
      post: {
        summary: "Run an internal expiry scan",
        description: "Service-to-service endpoint protected by x-internal-secret.",
        responses: { "200": { description: "Scan summary" } },
      },
    },
    "/health": {
      get: { summary: "Health check", responses: { "200": { description: "Healthy" } } },
    },
  },
};
