import { Router } from "express";
import { asyncHandler, authorize } from "@fems/shared";
import { logs, management, summary } from "../controllers/report.controller";

export const reportRoutes = Router();
export const logRoutes = Router();

reportRoutes.get("/summary", asyncHandler(summary));
reportRoutes.get("/management", authorize("ADMIN", "STAFF"), asyncHandler(management));
logRoutes.get("/", authorize("ADMIN", "STAFF"), asyncHandler(logs));
