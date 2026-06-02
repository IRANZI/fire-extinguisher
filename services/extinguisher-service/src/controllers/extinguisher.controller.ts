import { Response } from "express";
import { AuthenticatedRequest } from "@fems/shared";
import { db } from "../config/db";

export const health = async (_request: AuthenticatedRequest, response: Response) => {
  await db.query("SELECT 1");
  response.json({ service: "extinguisher-service", status: "ok" });
};
