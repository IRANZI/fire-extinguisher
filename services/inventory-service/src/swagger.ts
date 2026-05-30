export const swaggerDocument = {
  openapi: "3.0.3",
  info: {
    title: "SafeHub Inventory Service API",
    version: "1.0.0",
    description:
      "Customer, extinguisher, in-app notification, audit log, and compliance report service.",
  },
  servers: [{ url: "http://localhost:4002" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Customer: {
        type: "object",
        required: ["fullName", "email", "phone", "address"],
        properties: {
          portalUserId: { type: "string", format: "uuid", nullable: true },
          fullName: { type: "string" },
          email: { type: "string", format: "email" },
          phone: { type: "string" },
          address: { type: "string" },
          nationalId: { type: "string" },
          companyName: { type: "string" },
        },
      },
      Extinguisher: {
        type: "object",
        required: [
          "customerId",
          "serialNumber",
          "extinguisherType",
          "capacityKg",
          "purchaseDate",
          "expiryDate",
        ],
        properties: {
          customerId: { type: "string", format: "uuid" },
          serialNumber: { type: "string" },
          extinguisherType: { type: "string", example: "ABC Dry Chemical" },
          capacityKg: { type: "number", example: 6 },
          manufacturer: { type: "string" },
          purchaseDate: { type: "string", format: "date" },
          expiryDate: { type: "string", format: "date" },
          notes: { type: "string" },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/customers": {
      get: { summary: "List customers with pagination", responses: { "200": { description: "Customers" } } },
      post: {
        summary: "Register a customer",
        requestBody: {
          content: { "application/json": { schema: { $ref: "#/components/schemas/Customer" } } },
        },
        responses: { "201": { description: "Customer created" } },
      },
    },
    "/customers/self": {
      get: { summary: "Get the signed-in customer profile", responses: { "200": { description: "Profile" } } },
      put: { summary: "Create or update the signed-in customer profile", responses: { "200": { description: "Profile" } } },
    },
    "/extinguishers": {
      get: { summary: "List visible extinguishers with pagination", responses: { "200": { description: "Extinguishers" } } },
      post: {
        summary: "Register an extinguisher purchase",
        requestBody: {
          content: { "application/json": { schema: { $ref: "#/components/schemas/Extinguisher" } } },
        },
        responses: { "201": { description: "Extinguisher created" } },
      },
    },
    "/notifications": {
      get: { summary: "List visible in-app notifications", responses: { "200": { description: "Notifications" } } },
    },
    "/reports/summary": {
      get: { summary: "Return dashboard totals", responses: { "200": { description: "Report summary" } } },
    },
    "/reports/police": {
      get: { summary: "List compliance reports sent to police", responses: { "200": { description: "Police reports" } } },
    },
    "/logs": {
      get: { summary: "List audit logs", responses: { "200": { description: "Audit logs" } } },
    },
  },
};

