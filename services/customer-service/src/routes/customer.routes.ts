import { Router } from "express";
import { asyncHandler, authorize } from "@fems/shared";
import { archive, create, getOwnProfile, list, saveOwnProfile, update } from "../controllers/customer.controller";

export const customerRoutes = Router();
const staffRoles = ["ADMIN", "STAFF"] as const;

customerRoutes.get("/self", authorize("CUSTOMER"), asyncHandler(getOwnProfile));
customerRoutes.put("/self", authorize("CUSTOMER"), asyncHandler(saveOwnProfile));
customerRoutes.get("/", authorize(...staffRoles), asyncHandler(list));
customerRoutes.post("/", authorize(...staffRoles), asyncHandler(create));
customerRoutes.patch("/:id", authorize(...staffRoles), asyncHandler(update));
customerRoutes.delete("/:id", authorize("ADMIN"), asyncHandler(archive));
