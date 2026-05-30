import "./env";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import swaggerUi from "swagger-ui-express";
import { z } from "zod";
import {
  AppError,
  asyncHandler,
  authenticate,
  authorize,
  errorHandler,
  getJwtSecret,
  getPagination,
  httpLogger,
  logger,
  notFound,
  paginated,
} from "@fems/shared";
import { db } from "./db";
import { swaggerDocument } from "./swagger";

const app = express();
const port = Number(process.env.PORT ?? 4001);

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL?.split(",") ?? ["http://localhost:5173"],
    credentials: true,
  }),
);
app.use(express.json({ limit: "100kb" }));
app.use(httpLogger);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

const signupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().toLowerCase(),
  password: z
    .string()
    .min(8)
    .max(72)
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[0-9]/, "Password must include a number"),
});

const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1).max(72),
});

const createUserSchema = signupSchema.extend({
  role: z.enum(["ADMIN", "STAFF", "POLICE", "CUSTOMER"]),
});

const signToken = (user: { id: string; name: string; email: string; role: string }) =>
  jwt.sign(user, getJwtSecret(), {
    expiresIn: "8h",
  });

app.get("/health", asyncHandler(async (_request, response) => {
  await db.query("SELECT 1");
  response.json({ service: "auth-service", status: "ok" });
}));

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.post("/auth/signup", authLimiter, asyncHandler(async (request, response) => {
  const input = signupSchema.parse(request.body);
  const existing = await db.query("SELECT 1 FROM users WHERE email = $1", [input.email]);
  if (existing.rowCount) {
    throw new AppError(409, "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const result = await db.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'CUSTOMER')
     RETURNING id, name, email, role, created_at`,
    [input.name, input.email, passwordHash],
  );
  const user = result.rows[0];
  request.log.info({ userId: user.id }, "customer account created");
  response.status(201).json({ user, token: signToken(user) });
}));

app.post("/auth/login", authLimiter, asyncHandler(async (request, response) => {
  const input = loginSchema.parse(request.body);
  const result = await db.query(
    `SELECT id, name, email, password_hash, role, is_active
     FROM users WHERE email = $1`,
    [input.email],
  );
  const user = result.rows[0];

  if (!user || !user.is_active || !(await bcrypt.compare(input.password, user.password_hash))) {
    throw new AppError(401, "Invalid email or password");
  }

  const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
  request.log.info({ userId: user.id, role: user.role }, "user signed in");
  response.json({ user: payload, token: signToken(payload) });
}));

app.get("/auth/me", authenticate, asyncHandler(async (request, response) => {
  const result = await db.query(
    "SELECT id, name, email, role, is_active, created_at FROM users WHERE id = $1",
    [request.user!.id],
  );
  if (!result.rows[0]?.is_active) {
    throw new AppError(401, "Account is no longer active");
  }
  response.json({ user: result.rows[0] });
}));

app.get("/auth/users", authenticate, authorize("ADMIN"), asyncHandler(async (request, response) => {
  const { page, limit, offset } = getPagination(request.query);
  const total = await db.query("SELECT COUNT(*)::INTEGER AS count FROM users");
  const users = await db.query(
    `SELECT id, name, email, role, is_active, created_at
     FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  response.json(paginated(users.rows, total.rows[0].count, page, limit));
}));

app.post("/auth/users", authenticate, authorize("ADMIN"), asyncHandler(async (request, response) => {
  const input = createUserSchema.parse(request.body);
  const existing = await db.query("SELECT 1 FROM users WHERE email = $1", [input.email]);
  if (existing.rowCount) {
    throw new AppError(409, "An account with this email already exists");
  }
  const passwordHash = await bcrypt.hash(input.password, 12);
  const result = await db.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, is_active, created_at`,
    [input.name, input.email, passwordHash, input.role],
  );
  request.log.info({ actorId: request.user!.id, userId: result.rows[0].id, role: input.role }, "user account created");
  response.status(201).json({ user: result.rows[0] });
}));

app.use(notFound);
app.use(errorHandler);

const ensureBootstrapAdmin = async () => {
  const email = process.env.ADMIN_EMAIL ?? "admin@safehub.local";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
  const existing = await db.query("SELECT 1 FROM users WHERE email = $1", [email]);
  if (!existing.rowCount) {
    const passwordHash = await bcrypt.hash(password, 12);
    await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ('System Administrator', $1, $2, 'ADMIN')`,
      [email, passwordHash],
    );
    logger.warn({ email }, "bootstrap administrator created; change the default password");
  }
};

const start = async () => {
  await db.query("SELECT 1");
  await ensureBootstrapAdmin();
  app.listen(port, () => logger.info({ port }, "auth-service listening"));
};

start().catch((error) => {
  logger.fatal(error, "auth-service failed to start");
  process.exit(1);
});
