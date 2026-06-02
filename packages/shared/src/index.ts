import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import pino from "pino";
import pinoHttp from "pino-http";
import { ZodError, ZodSchema } from "zod";

export const ROLES = ["ADMIN", "STAFF", "POLICE", "CUSTOMER"] as const;
export type Role = (typeof ROLES)[number];

export interface JwtUser {
  id: string;
  email: string;
  role: Role;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtUser;
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

export const httpLogger = pinoHttp({ logger });

export const corsOrigin = (
  origin: string | undefined,
  callback: (error: Error | null, allowed?: boolean) => void,
) => {
  if (!origin) return callback(null, true);
  const configuredOrigins = (process.env.FRONTEND_URL ?? "http://localhost:5173")
    .split(",")
    .map((value) => value.trim());
  const isLocalDevelopmentOrigin =
    process.env.NODE_ENV !== "production" &&
    /^http:\/\/(localhost|127\.0\.0\.1):517\d$/.test(origin);

  callback(null, configuredOrigins.includes(origin) || isLocalDevelopmentOrigin);
};

export const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required");
  return process.env.JWT_SECRET;
};

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const asyncHandler =
  (
    handler: (
      request: AuthenticatedRequest,
      response: Response,
      next: NextFunction,
    ) => Promise<unknown>,
  ) =>
  (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };

export const authenticate = (
  request: AuthenticatedRequest,
  _response: Response,
  next: NextFunction,
) => {
  const token = request.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return next(new AppError(401, "Authentication token is required"));
  }

  try {
    request.user = jwt.verify(
      token,
      getJwtSecret(),
    ) as JwtUser;
    next();
  } catch {
    next(new AppError(401, "Authentication token is invalid or expired"));
  }
};

export const authorize =
  (...roles: Role[]) =>
  (request: AuthenticatedRequest, _response: Response, next: NextFunction) => {
    if (!request.user || !roles.includes(request.user.role)) {
      return next(new AppError(403, "You do not have permission to perform this action"));
    }
    next();
  };

export const validate =
  (schema: ZodSchema, source: "body" | "query" | "params" = "body") =>
  (request: Request, _response: Response, next: NextFunction) => {
    try {
      request[source] = schema.parse(request[source]);
      next();
    } catch (error) {
      next(error);
    }
  };

export const errorHandler = (
  error: Error,
  request: Request,
  response: Response,
  _next: NextFunction,
) => {
  if (error instanceof ZodError) {
    return response.status(400).json({
      message: "Validation failed",
      errors: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  if (error instanceof AppError) {
    return response.status(error.statusCode).json({
      message: error.message,
      details: error.details,
    });
  }

  const databaseError = error as Error & { code?: string; constraint?: string };
  if (databaseError.code === "23505") {
    return response.status(409).json({ message: "A record with these unique details already exists" });
  }
  if (databaseError.code === "23503" || databaseError.code === "23514") {
    return response.status(400).json({ message: "The submitted record violates a data rule" });
  }

  request.log?.error(error);
  response.status(500).json({ message: "An unexpected server error occurred" });
};

export const notFound = (_request: Request, response: Response) => {
  response.status(404).json({ message: "Route not found" });
};

export const getPagination = (query: Request["query"]) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
  return { page, limit, offset: (page - 1) * limit };
};

export const paginated = <T>(
  records: T[],
  total: number,
  page: number,
  limit: number,
) => ({
  records,
  pagination: {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  },
});
