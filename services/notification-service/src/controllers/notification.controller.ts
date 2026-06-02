import { Response } from "express";
import { AuthenticatedRequest } from "@fems/shared";
import { runScan } from "../services/notification.service";

export const scan = async (_request: AuthenticatedRequest, response: Response) => {
  response.json({ summary: await runScan() });
};
