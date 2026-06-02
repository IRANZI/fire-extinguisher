import { NextFunction, Request, Response } from "express";
import { AppError } from "@fems/shared";
import { getInternalSecret } from "../utils/internalSecret";

export const internalOnly = (request: Request, _response: Response, next: NextFunction) => {
  if (request.header("x-internal-secret") !== getInternalSecret()) {
    return next(new AppError(403, "Internal service credential is invalid"));
  }
  next();
};
