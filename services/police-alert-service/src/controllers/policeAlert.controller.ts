import { Response } from "express";
import { AppError, AuthenticatedRequest } from "@fems/shared";
import { listReports, updateReport } from "../services/policeAlert.service";
import { reportStatusSchema, uuidParam } from "../validations/policeAlert.validation";

export const list = async (request: AuthenticatedRequest, response: Response) => {
  response.json(await listReports(request.query));
};

export const update = async (request: AuthenticatedRequest, response: Response) => {
  const { id } = uuidParam.parse(request.params);
  const { status } = reportStatusSchema.parse(request.body);
  const report = await updateReport(request.user!, id, status);
  if (!report) throw new AppError(404, "Police report not found");
  response.json({ report });
};
