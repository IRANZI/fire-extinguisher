import axios from "axios";
import { AppError, logger } from "@fems/shared";
import { EmailJob } from "../models/notification.model";
import { getInternalSecret } from "../utils/internalSecret";
import { sendEmail } from "./email.service";

const extinguisherUrl =
  process.env.EXTINGUISHER_SERVICE_URL ??
  process.env.INVENTORY_SERVICE_URL ??
  "http://localhost:4002";
let scanRunning = false;

export const runScan = async () => {
  if (scanRunning) throw new AppError(409, "An expiry scan is already running");
  scanRunning = true;
  try {
    const { data } = await axios.post<{ jobs: EmailJob[]; summary: Record<string, number> }>(
      `${extinguisherUrl}/internal/expiry-scan`,
      {},
      { headers: { "x-internal-secret": getInternalSecret() } },
    );
    await Promise.all(data.jobs.map(sendEmail));
    logger.info({ ...data.summary, emails: data.jobs.length }, "expiry scan completed");
    return { ...data.summary, emails: data.jobs.length };
  } finally {
    scanRunning = false;
  }
};
