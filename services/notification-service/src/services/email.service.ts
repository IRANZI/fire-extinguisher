import axios from "axios";
import { logger } from "@fems/shared";
import { db } from "../config/db";
import { mailTransport } from "../config/mail";
import { EmailJob, EmailStatus } from "../models/notification.model";
import { getInternalSecret } from "../utils/internalSecret";

const extinguisherUrl =
  process.env.EXTINGUISHER_SERVICE_URL ??
  process.env.INVENTORY_SERVICE_URL ??
  "http://localhost:4002";

const recordResult = async (job: EmailJob, status: EmailStatus, errorMessage?: string) => {
  await db.query(
    `INSERT INTO email_logs (notification_id, recipient, subject, status, error_message)
     VALUES ($1, $2, $3, $4, $5)`,
    [job.notificationId, job.recipient, job.subject, status, errorMessage ?? null],
  );
  await axios.post(
    `${extinguisherUrl}/internal/email-result`,
    { notificationId: job.notificationId, recipient: job.recipient, status, errorMessage },
    { headers: { "x-internal-secret": getInternalSecret() } },
  );
};

export const sendEmail = async (job: EmailJob) => {
  try {
    const info = await mailTransport.sendMail({
      from: process.env.SMTP_FROM ?? "SafeHub Alerts <alerts@safehub.local>",
      to: job.recipient,
      subject: job.subject,
      text: `${job.message}\n\nSafeHub Fire Extinguisher Management`,
    });
    const status = process.env.SMTP_HOST ? "SENT" : "PREVIEW";
    await recordResult(job, status);
    logger.info({ notificationId: job.notificationId, recipient: job.recipient, messageId: info.messageId, status }, "email processed");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email delivery error";
    await recordResult(job, "FAILED", message).catch((recordError) => {
      logger.error(recordError, "failed to record email delivery failure");
    });
    logger.error({ error, notificationId: job.notificationId }, "email delivery failed");
  }
};
