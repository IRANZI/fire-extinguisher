export const swaggerDocument = {
  openapi: "3.0.3",
  info: {
    title: "SafeHub Customer Service API",
    version: "1.0.0",
    description: "Customer profile registration and maintenance.",
  },
  servers: [{ url: "http://localhost:4004" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/customers": {
      get: { summary: "List active customers", responses: { "200": { description: "Customers" } } },
      post: { summary: "Register a customer", responses: { "201": { description: "Customer created" } } },
    },
    "/customers/self": {
      get: { summary: "Return the signed-in customer profile", responses: { "200": { description: "Profile" } } },
      put: { summary: "Save the signed-in customer profile", responses: { "200": { description: "Profile saved" } } },
    },
  },
};
