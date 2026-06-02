export const swaggerDocument = {
  openapi: "3.0.3",
  info: {
    title: "SafeHub Extinguisher Service API",
    version: "1.0.0",
    description:
      "Extinguisher lifecycle, inspections, service requests, and expiry workflow service.",
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
    "/customers/{id}": {
      patch: { summary: "Update a customer profile (ADMIN or STAFF)", responses: { "200": { description: "Customer updated" } } },
      delete: { summary: "Archive a customer while preserving history (ADMIN)", responses: { "204": { description: "Customer archived" } } },
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
    "/extinguishers/{id}/history": {
      get: { summary: "View extinguisher lifecycle history", responses: { "200": { description: "History entries" } } },
    },
    "/inspections": {
      get: { summary: "List visible inspection schedules", responses: { "200": { description: "Inspections" } } },
      post: { summary: "Schedule an inspection (ADMIN or STAFF)", responses: { "201": { description: "Inspection scheduled" } } },
    },
    "/inspections/{id}": {
      patch: { summary: "Update an inspection result (ADMIN or STAFF)", responses: { "200": { description: "Inspection updated" } } },
    },
    "/service-requests": {
      get: { summary: "List visible service and renewal requests", responses: { "200": { description: "Service requests" } } },
      post: { summary: "Request servicing, renewal, or replacement (CUSTOMER)", responses: { "201": { description: "Request created" } } },
    },
    "/service-requests/{id}": {
      patch: { summary: "Update a service request status (ADMIN or STAFF)", responses: { "200": { description: "Request updated" } } },
    },
    "/notifications": {
      get: { summary: "List visible in-app notifications", responses: { "200": { description: "Notifications" } } },
    },
    "/reports/summary": {
      get: { summary: "Return dashboard totals", responses: { "200": { description: "Report summary" } } },
    },
    "/reports/management": {
      get: { summary: "Return sales and operational management reports", responses: { "200": { description: "Management report" } } },
    },
    "/reports/police": {
      get: { summary: "List compliance reports sent to police", responses: { "200": { description: "Police reports" } } },
    },
    "/logs": {
      get: { summary: "List audit logs", responses: { "200": { description: "Audit logs" } } },
    },
    "/settings/notifications": {
      get: { summary: "View reminder and escalation settings (ADMIN)", responses: { "200": { description: "Notification settings" } } },
      patch: { summary: "Update reminder and escalation settings (ADMIN)", responses: { "200": { description: "Notification settings updated" } } },
    },
  },
};
