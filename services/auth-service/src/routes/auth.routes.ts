import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler, authenticate, authorize } from "@fems/shared";
import { addUser, currentUser, loginUser, signupCustomer, users } from "../controllers/auth.controller";

export const authRoutes = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

authRoutes.post("/signup", authLimiter, asyncHandler(signupCustomer));
authRoutes.post("/login", authLimiter, asyncHandler(loginUser));
authRoutes.get("/me", authenticate, asyncHandler(currentUser));
authRoutes.get("/users", authenticate, authorize("ADMIN"), asyncHandler(users));
authRoutes.post("/users", authenticate, authorize("ADMIN"), asyncHandler(addUser));
