import { AppError, JwtUser, getPagination, logger, paginated } from "@fems/shared";
import { Request } from "express";
import { db } from "../config/db";
import { CreateUserInput, SignupInput, TokenUser } from "../models/user.model";
import { hashPassword, verifyPassword } from "../utils/password";

const ensureEmailAvailable = async (email: string) => {
  const existing = await db.query("SELECT 1 FROM users WHERE email = $1", [email]);
  if (existing.rowCount) throw new AppError(409, "An account with this email already exists");
};

export const signup = async (input: SignupInput) => {
  await ensureEmailAvailable(input.email);
  const result = await db.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'CUSTOMER')
     RETURNING id, name, email, role, created_at`,
    [input.name, input.email, await hashPassword(input.password)],
  );
  return result.rows[0] as TokenUser;
};

export const login = async (email: string, password: string) => {
  const result = await db.query(
    "SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = $1",
    [email],
  );
  const user = result.rows[0];
  if (!user || !user.is_active || !(await verifyPassword(password, user.password_hash))) {
    throw new AppError(401, "Invalid email or password");
  }
  return { id: user.id, name: user.name, email: user.email, role: user.role } as TokenUser;
};

export const getMe = async (userId: string) => {
  const result = await db.query(
    "SELECT id, name, email, role, is_active, created_at FROM users WHERE id = $1",
    [userId],
  );
  if (!result.rows[0]?.is_active) throw new AppError(401, "Account is no longer active");
  return result.rows[0];
};

export const listUsers = async (query: Request["query"]) => {
  const { page, limit, offset } = getPagination(query);
  const total = await db.query("SELECT COUNT(*)::INTEGER AS count FROM users");
  const users = await db.query(
    `SELECT id, name, email, role, is_active, created_at
     FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return paginated(users.rows, total.rows[0].count, page, limit);
};

export const createUser = async (_actor: JwtUser, input: CreateUserInput) => {
  await ensureEmailAvailable(input.email);
  const result = await db.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, is_active, created_at`,
    [input.name, input.email, await hashPassword(input.password), input.role],
  );
  return result.rows[0];
};

export const ensureBootstrapAdmin = async () => {
  const email = process.env.ADMIN_EMAIL ?? "admin@safehub.local";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
  const existing = await db.query("SELECT 1 FROM users WHERE email = $1", [email]);
  if (!existing.rowCount) {
    await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ('System Administrator', $1, $2, 'ADMIN')`,
      [email, await hashPassword(password)],
    );
    logger.warn({ email }, "bootstrap administrator created; change the default password");
  }
};
