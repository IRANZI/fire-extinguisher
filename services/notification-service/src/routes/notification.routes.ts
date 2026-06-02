import { Router } from "express";
import { asyncHandler, authenticate, authorize } from "@fems/shared";
import { scan } from "../controllers/notification.controller";
import { internalOnly } from "../middlewares/internal.middleware";

export const notificationRoutes = Router();

notificationRoutes.post("/internal/notifications/scan", internalOnly, asyncHandler(scan));
notificationRoutes.post("/notifications/scan", authenticate, authorize("ADMIN", "STAFF"), asyncHandler(scan));
