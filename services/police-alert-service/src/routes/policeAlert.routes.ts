import { Router } from "express";
import { asyncHandler, authorize } from "@fems/shared";
import { list, update } from "../controllers/policeAlert.controller";

export const policeAlertRoutes = Router();

policeAlertRoutes.get("/", authorize("ADMIN", "STAFF", "POLICE"), asyncHandler(list));
policeAlertRoutes.patch("/:id", authorize("ADMIN", "POLICE"), asyncHandler(update));
