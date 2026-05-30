import "./env";
import axios from "axios";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import cron from "node-cron";
import nodemailer from "nodemailer";
import swaggerUi from "swagger-ui-express";
import {
  AppError,
  asyncHandler,
  authenticate,
  authorize,
  errorHandler,
  httpLogger,
  logger,
  notFound,
} from "@fems/shared";
import { db } from "./db";
import { swaggerDocument } from "./swagger";

const app = express();
const port = Number(process.env.PORT ?? 4003);
const inventoryUrl = process.env.INVENTORY_SERVICE_URL ?? "http://localhost:4002";
const internalSecret = process.env.INTERNAL_SECRET;
if (!internalSecret) throw new Error("INTERNAL_SECRET is required");
let scanRunning = false;

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL?.split(",") ?? ["http://localhost:5173"],
    credentials: true,
  }),
);
app.use(express.json({ limit: "100kb" }));
app.use(httpLogger);

const transport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASSWORD
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
    })
  : nodemailer.createTransport({ jsonTransport: true });

interface EmailJob {
  notificationId: string;
  recipient: string;
  subject: string;
  message: string;
}

const internalOnly = (request: Request, _response: Response, next: NextFunction) => {
  if (request.header("x-internal-secret") !== internalSecret) {
    return next(new AppError(403, "Internal service credential is invalid"));
  }
  next();
};

const recordResult = async (
  job: EmailJob,
  status: "SENT" | "FAILED" | "PREVIEW",
  errorMessage?: string,
) => {
  await db.query(
    `INSERT INTO email_logs (notification_id, recipient, subject, status, error_message)
     VALUES ($1, $2, $3, $4, $5)`,
    [job.notificationId, job.recipient, job.subject, status, errorMessage ?? null],
  );
  await axios.post(
    `${inventoryUrl}/internal/email-result`,
    {
      notificationId: job.notificationId,
      recipient: job.recipient,
      status,
      errorMessage,
    },
    { headers: { "x-internal-secret": internalSecret } },
  );
};

const sendEmail = async (job: EmailJob) => {
  try {
    const info = await transport.sendMail({
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

const runScan = async () => {
  if (scanRunning) throw new AppError(409, "An expiry scan is already running");
  scanRunning = true;
  try {
    const { data } = await axios.post<{ jobs: EmailJob[]; summary: Record<string, number> }>(
      `${inventoryUrl}/internal/expiry-scan`,
      {},
      { headers: { "x-internal-secret": internalSecret } },
    );
    await Promise.all(data.jobs.map(sendEmail));
    logger.info({ ...data.summary, emails: data.jobs.length }, "expiry scan completed");
    return { ...data.summary, emails: data.jobs.length };
  } finally {
    scanRunning = false;
  }
};

app.get("/health", asyncHandler(async (_request, response) => {
  await db.query("SELECT 1");
  response.json({ service: "notification-service", status: "ok" });
}));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.post(
  "/internal/notifications/scan",
  internalOnly,
  asyncHandler(async (_request, response) => {
    response.json({ summary: await runScan() });
  }),
);
app.post(
  "/notifications/scan",
  authenticate,
  authorize("ADMIN", "STAFF"),
  asyncHandler(async (_request, response) => {
    response.json({ summary: await runScan() });
  }),
);
app.use(notFound);
app.use(errorHandler);

const start = async () => {
  await db.query("SELECT 1");
  const schedule = process.env.SCAN_CRON ?? "0 8 * * *";
  if (!cron.validate(schedule)) throw new Error(`Invalid SCAN_CRON expression: ${schedule}`);
  cron.schedule(schedule, () => {
    runScan().catch((error) => logger.error(error, "scheduled expiry scan failed"));
  });
  app.listen(port, () => logger.info({ port, schedule }, "notification-service listening"));
};

start().catch((error) => {
  logger.fatal(error, "notification-service failed to start");
  process.exit(1);
});
