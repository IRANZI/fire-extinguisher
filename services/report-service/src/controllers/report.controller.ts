import { Response } from "express";
import { AuthenticatedRequest } from "@fems/shared";
import { getManagement, getSummary, listAuditLogs } from "../services/report.service";

export const summary = async (request: AuthenticatedRequest, response: Response) => {
  response.json(await getSummary(request.user!));
};

export const management = async (_request: AuthenticatedRequest, response: Response) => {
  response.json(await getManagement());
};

export const logs = async (request: AuthenticatedRequest, response: Response) => {
  response.json(await listAuditLogs(request.query));
};
