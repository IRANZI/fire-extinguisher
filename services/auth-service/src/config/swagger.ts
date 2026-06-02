export const swaggerDocument = {
  openapi: "3.0.3",
  info: {
    title: "SafeHub Auth Service API",
    version: "1.0.0",
    description: "JWT authentication and user identity service.",
  },
  servers: [{ url: "http://localhost:4001" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Signup: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string", example: "Aline Uwase" },
          email: { type: "string", format: "email" },
          password: { type: "string", format: "password", minLength: 8 },
        },
      },
      Login: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", format: "password" },
        },
      },
    },
  },
  paths: {
    "/auth/signup": {
      post: {
        summary: "Create a customer portal account",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/Signup" } } },
        },
        responses: { "201": { description: "Account created" } },
      },
    },
    "/auth/login": {
      post: {
        summary: "Sign in and receive a JWT",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/Login" } } },
        },
        responses: { "200": { description: "Authenticated" } },
      },
    },
    "/auth/me": {
      get: {
        summary: "Return the authenticated user",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Current user" } },
      },
    },
    "/auth/users": {
      get: {
        summary: "List user accounts (ADMIN only)",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Paginated user list" } },
      },
      post: {
        summary: "Create a role-based user account (ADMIN only)",
        security: [{ bearerAuth: [] }],
        responses: { "201": { description: "User created" } },
      },
    },
  },
};
