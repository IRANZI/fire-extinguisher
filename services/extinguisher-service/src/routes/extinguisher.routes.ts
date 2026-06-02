import { Router } from "express";
import { asyncHandler } from "@fems/shared";
import { health } from "../controllers/extinguisher.controller";

export const extinguisherRoutes = Router();

extinguisherRoutes.get("/health", asyncHandler(health));
