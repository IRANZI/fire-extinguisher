import "./config/env";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { z } from "zod";
import {
  AppError,
  AuthenticatedRequest,
  asyncHandler,
  authenticate,
  authorize,
  corsOrigin,
  errorHandler,
  getPagination,
  httpLogger,
  notFound,
  paginated,
} from "@fems/shared";
import { db } from "./config/db";
import { swaggerDocument } from "./config/swagger";
import { requestImmediateNotificationScan } from "./jobs/expiryChecker.job";
import { internalOnly } from "./middlewares/internal.middleware";
import { extinguisherRoutes } from "./routes/extinguisher.routes";
import { getCustomerScope } from "./services/extinguisher.service";
import { getNotificationSettings } from "./services/settings.service";
import { audit, recordExtinguisherHistory } from "./utils/audit";
import { formatDate } from "./utils/date";

export const app = express();
const staffRoles = ["ADMIN", "STAFF"] as const;

app.use(helmet());
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);
app.use(express.json({ limit: "200kb" }));
app.use(httpLogger);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);

const uuidParam = z.object({ id: z.string().uuid() });
const customerSchema = z.object({
  portalUserId: z.string().uuid().nullable().optional(),
  fullName: z.string().trim().min(2).max(140),
  email: z.string().trim().email().toLowerCase(),
  phone: z.string().trim().min(5).max(40),
  address: z.string().trim().min(4).max(500),
  nationalId: z.string().trim().max(80).optional().default(""),
  companyName: z.string().trim().max(140).optional().default(""),
});
const extinguisherSchema = z
  .object({
    customerId: z.string().uuid(),
    serialNumber: z.string().trim().min(2).max(100),
    extinguisherType: z.string().trim().min(2).max(80),
    capacityKg: z.coerce.number().positive().max(1000),
    manufacturer: z.string().trim().max(120).optional().default(""),
    purchaseDate: z.coerce.date(),
    expiryDate: z.coerce.date(),
    notes: z.string().trim().max(1000).optional().default(""),
  })
  .refine((data) => data.expiryDate >= data.purchaseDate, {
    message: "Expiry date must be on or after purchase date",
    path: ["expiryDate"],
  });
const extinguisherUpdateSchema = z.object({
  extinguisherType: z.string().trim().min(2).max(80).optional(),
  capacityKg: z.coerce.number().positive().max(1000).optional(),
  manufacturer: z.string().trim().max(120).optional(),
  purchaseDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  status: z.enum(["ACTIVE", "EXPIRED", "SERVICED", "REPLACED"]).optional(),
  notes: z.string().trim().max(1000).optional(),
});
const inspectionSchema = z.object({
  extinguisherId: z.string().uuid(),
  scheduledDate: z.coerce.date(),
  inspectionType: z.enum(["ROUTINE", "ANNUAL", "POST_SERVICE"]).default("ROUTINE"),
  notes: z.string().trim().max(1000).optional().default(""),
});
const inspectionUpdateSchema = z.object({
  scheduledDate: z.coerce.date().optional(),
  completedDate: z.coerce.date().nullable().optional(),
  status: z.enum(["SCHEDULED", "COMPLETED", "MISSED", "CANCELLED"]).optional(),
  notes: z.string().trim().max(1000).optional(),
});
const serviceRequestSchema = z.object({
  extinguisherId: z.string().uuid(),
  requestType: z.enum(["SERVICE", "RENEWAL", "REPLACEMENT"]),
  customerNotes: z.string().trim().max(1000).optional().default(""),
});
const serviceRequestUpdateSchema = z.object({
  status: z.enum(["REQUESTED", "APPROVED", "IN_PROGRESS", "COMPLETED", "REJECTED"]),
  staffNotes: z.string().trim().max(1000).optional().default(""),
});
const notificationSettingsSchema = z.object({
  expiryWarningDays: z.coerce.number().int().min(1).max(365),
  escalationGraceDays: z.coerce.number().int().min(1).max(90),
  reminderIntervalDays: z.coerce.number().int().min(1).max(30),
  maxReminders: z.coerce.number().int().min(1).max(10),
});
const reportStatusSchema = z.object({
  status: z.enum(["OPEN", "REVIEWING", "CLOSED"]),
});
const emailResultSchema = z.object({
  notificationId: z.string().uuid(),
  status: z.enum(["SENT", "FAILED", "PREVIEW"]),
  recipient: z.string().email(),
  errorMessage: z.string().max(1000).optional(),
});

app.use(extinguisherRoutes);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.post("/internal/expiry-scan", internalOnly, asyncHandler(async (_request, response) => {
  const settings = await getNotificationSettings();
  const warningDays = settings.expiry_warning_days;
  const graceDays = settings.escalation_grace_days;
  const equipment = await db.query(
    `SELECT e.id, e.serial_number, e.expiry_date, e.status,
            c.id AS customer_id, c.full_name, c.email, c.portal_user_id
     FROM extinguishers e
     JOIN customers c ON c.id = e.customer_id
     WHERE e.status IN ('ACTIVE', 'EXPIRED')
       AND e.expiry_date <= CURRENT_DATE + $1::INTEGER`,
    [warningDays],
  );
  const jobs: Array<{ notificationId: string; recipient: string; subject: string; message: string }> = [];
  let overdue = 0;
  let warnings = 0;
  let escalations = 0;

  for (const item of equipment.rows) {
    const isExpired = new Date(item.expiry_date) <= new Date();
    const type = isExpired ? "EXPIRY_OVERDUE" : "EXPIRY_WARNING";
    const existing = await db.query(
      `SELECT id, created_at, is_read, email_sent_at, reminder_count, last_reminded_at, title, message
       FROM notifications WHERE extinguisher_id = $1 AND type = $2
       ORDER BY created_at DESC LIMIT 1`,
      [item.id, type],
    );

    if (isExpired && item.status !== "EXPIRED") {
      await db.query("UPDATE extinguishers SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1", [item.id]);
      await recordExtinguisherHistory(item.id, undefined, "MARKED_EXPIRED", {
        expiryDate: formatDate(item.expiry_date),
      });
    }

    if (!existing.rowCount) {
      const title = isExpired ? "Fire extinguisher expired" : "Fire extinguisher expiry reminder";
      const message = isExpired
        ? `Extinguisher ${item.serial_number} expired on ${formatDate(item.expiry_date)}. Please contact the company immediately.`
        : `Extinguisher ${item.serial_number} expires on ${formatDate(item.expiry_date)}. Please arrange servicing or replacement.`;
      const inserted = await db.query(
        `INSERT INTO notifications
          (customer_id, extinguisher_id, target_user_id, target_role, type, title, message)
         VALUES ($1, $2, $3, 'CUSTOMER', $4, $5, $6)
         RETURNING id`,
        [item.customer_id, item.id, item.portal_user_id, type, title, message],
      );
      jobs.push({ notificationId: inserted.rows[0].id, recipient: item.email, subject: title, message });
      if (isExpired) overdue += 1;
      else warnings += 1;
      await audit(undefined, `NOTIFICATION_${type}`, "extinguisher", item.id, { customerId: item.customer_id });
    } else if (
      !existing.rows[0].email_sent_at ||
      (
        existing.rows[0].reminder_count < settings.max_reminders &&
        (
          !existing.rows[0].last_reminded_at ||
          new Date(existing.rows[0].last_reminded_at) <= new Date(Date.now() - settings.reminder_interval_days * 86400000)
        )
      )
    ) {
      jobs.push({
        notificationId: existing.rows[0].id,
        recipient: item.email,
        subject: existing.rows[0].title,
        message: existing.rows[0].message,
      });
    }

    const overdueNotice = isExpired
      ? await db.query(
          `SELECT id FROM notifications
           WHERE extinguisher_id = $1 AND type = 'EXPIRY_OVERDUE'
             AND is_read = FALSE AND created_at <= NOW() - ($2::TEXT || ' days')::INTERVAL
             AND reminder_count >= $3
           ORDER BY created_at DESC LIMIT 1`,
          [item.id, graceDays, settings.max_reminders],
        )
      : { rowCount: 0, rows: [] };
    const reported = await db.query("SELECT notification_id FROM police_reports WHERE extinguisher_id = $1", [item.id]);

    if (overdueNotice.rowCount && !reported.rowCount) {
      const reason = `Expired extinguisher ${item.serial_number} remains unacknowledged after ${graceDays} days.`;
      const policeNotice = await db.query(
        `INSERT INTO notifications
          (customer_id, extinguisher_id, target_role, type, title, message)
         VALUES ($1, $2, 'POLICE', 'POLICE_ESCALATION', 'Compliance escalation', $3)
         RETURNING id`,
        [item.customer_id, item.id, reason],
      );
      await db.query(
        `INSERT INTO police_reports (customer_id, extinguisher_id, notification_id, reason)
         VALUES ($1, $2, $3, $4)`,
        [item.customer_id, item.id, policeNotice.rows[0].id, reason],
      );
      jobs.push({
        notificationId: policeNotice.rows[0].id,
        recipient: process.env.POLICE_CONTACT_EMAIL ?? "police@safehub.local",
        subject: "SafeHub compliance escalation",
        message: `${reason} Customer: ${item.full_name}, email: ${item.email}.`,
      });
      escalations += 1;
      await audit(undefined, "POLICE_ESCALATION_CREATED", "extinguisher", item.id, { customerId: item.customer_id });
    } else if (reported.rowCount) {
      const policeEmail = await db.query(
        "SELECT id, title, message FROM notifications WHERE id = $1 AND email_sent_at IS NULL",
        [reported.rows[0].notification_id],
      );
      if (policeEmail.rowCount) {
        jobs.push({
          notificationId: policeEmail.rows[0].id,
          recipient: process.env.POLICE_CONTACT_EMAIL ?? "police@safehub.local",
          subject: policeEmail.rows[0].title,
          message: policeEmail.rows[0].message,
        });
      }
    }
  }

  response.json({ jobs, summary: { checked: equipment.rowCount, warnings, overdue, escalations } });
}));

app.post("/internal/email-result", internalOnly, asyncHandler(async (request, response) => {
  const input = emailResultSchema.parse(request.body);
  if (input.status === "SENT" || input.status === "PREVIEW") {
    await db.query(
      `UPDATE notifications
       SET email_sent_at = COALESCE(email_sent_at, NOW()), last_reminded_at = NOW(),
           reminder_count = reminder_count + 1
       WHERE id = $1`,
      [input.notificationId],
    );
  }
  await audit(undefined, `EMAIL_${input.status}`, "notification", input.notificationId, {
    recipient: input.recipient,
    errorMessage: input.errorMessage,
  });
  response.status(204).send();
}));

app.use(authenticate);

app.get("/customers/self", authorize("CUSTOMER"), asyncHandler(async (request, response) => {
  const result = await db.query("SELECT * FROM customers WHERE portal_user_id = $1", [request.user!.id]);
  response.json({ customer: result.rows[0] ?? null });
}));

app.put("/customers/self", authorize("CUSTOMER"), asyncHandler(async (request, response) => {
  const input = customerSchema.omit({ portalUserId: true }).parse(request.body);
  let result = await db.query(
    `UPDATE customers SET portal_user_id = $1, full_name = $2, email = $3, phone = $4,
       address = $5, national_id = $6, company_name = $7, updated_at = NOW()
     WHERE id = (
       SELECT id FROM customers
       WHERE portal_user_id IS NULL AND LOWER(email) = LOWER($3)
       ORDER BY created_at ASC LIMIT 1
     )
     RETURNING *`,
    [request.user!.id, input.fullName, input.email, input.phone, input.address, input.nationalId, input.companyName],
  );
  if (!result.rowCount) result = await db.query(
    `INSERT INTO customers (portal_user_id, full_name, email, phone, address, national_id, company_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (portal_user_id) WHERE portal_user_id IS NOT NULL DO UPDATE SET
       full_name = EXCLUDED.full_name, email = EXCLUDED.email, phone = EXCLUDED.phone,
       address = EXCLUDED.address, national_id = EXCLUDED.national_id,
       company_name = EXCLUDED.company_name, updated_at = NOW()
     RETURNING *`,
    [request.user!.id, input.fullName, input.email, input.phone, input.address, input.nationalId, input.companyName],
  );
  await audit(request.user, "CUSTOMER_PROFILE_SAVED", "customer", result.rows[0].id);
  response.json({ customer: result.rows[0] });
}));

app.get("/customers", authorize(...staffRoles), asyncHandler(async (request, response) => {
  const { page, limit, offset } = getPagination(request.query);
  const search = String(request.query.search ?? "").trim();
  const values: unknown[] = [];
  const where = search
    ? `WHERE is_active = TRUE AND (full_name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)`
    : "WHERE is_active = TRUE";
  if (search) values.push(`%${search}%`);
  const total = await db.query(`SELECT COUNT(*)::INTEGER AS count FROM customers ${where}`, values);
  values.push(limit, offset);
  const records = await db.query(
    `SELECT * FROM customers ${where}
     ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  response.json(paginated(records.rows, total.rows[0].count, page, limit));
}));

app.post("/customers", authorize(...staffRoles), asyncHandler(async (request, response) => {
  const input = customerSchema.parse(request.body);
  const result = await db.query(
    `INSERT INTO customers (portal_user_id, full_name, email, phone, address, national_id, company_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [input.portalUserId, input.fullName, input.email, input.phone, input.address, input.nationalId, input.companyName],
  );
  await audit(request.user, "CUSTOMER_CREATED", "customer", result.rows[0].id);
  response.status(201).json({ customer: result.rows[0] });
}));

app.patch("/customers/:id", authorize(...staffRoles), asyncHandler(async (request, response) => {
  const { id } = uuidParam.parse(request.params);
  const input = customerSchema.omit({ portalUserId: true }).partial().parse(request.body);
  if (!Object.keys(input).length) throw new AppError(400, "At least one field is required");
  const result = await db.query(
    `UPDATE customers SET
       full_name = COALESCE($2, full_name), email = COALESCE($3, email),
       phone = COALESCE($4, phone), address = COALESCE($5, address),
       national_id = COALESCE($6, national_id), company_name = COALESCE($7, company_name),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, input.fullName, input.email, input.phone, input.address, input.nationalId, input.companyName],
  );
  if (!result.rowCount) throw new AppError(404, "Customer not found");
  await audit(request.user, "CUSTOMER_UPDATED", "customer", id, input);
  response.json({ customer: result.rows[0] });
}));

app.delete("/customers/:id", authorize("ADMIN"), asyncHandler(async (request, response) => {
  const { id } = uuidParam.parse(request.params);
  const result = await db.query(
    "UPDATE customers SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id",
    [id],
  );
  if (!result.rowCount) throw new AppError(404, "Customer not found");
  await audit(request.user, "CUSTOMER_ARCHIVED", "customer", id);
  response.status(204).send();
}));

app.get("/extinguishers", asyncHandler(async (request, response) => {
  const { page, limit, offset } = getPagination(request.query);
  const values: unknown[] = [];
  const conditions: string[] = [];
  if (request.user!.role === "CUSTOMER") {
    values.push(request.user!.id);
    conditions.push(`c.portal_user_id = $${values.length}`);
  }
  if (request.query.status) {
    values.push(String(request.query.status));
    conditions.push(`e.status = $${values.length}`);
  }
  if (request.query.search) {
    values.push(`%${String(request.query.search).trim()}%`);
    conditions.push(`(e.serial_number ILIKE $${values.length} OR c.full_name ILIKE $${values.length})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const total = await db.query(
    `SELECT COUNT(*)::INTEGER AS count FROM extinguishers e JOIN customers c ON c.id = e.customer_id ${where}`,
    values,
  );
  values.push(limit, offset);
  const records = await db.query(
    `SELECT e.*, c.full_name AS customer_name, c.email AS customer_email
     FROM extinguishers e JOIN customers c ON c.id = e.customer_id
     ${where} ORDER BY e.expiry_date ASC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  response.json(paginated(records.rows, total.rows[0].count, page, limit));
}));

app.post("/extinguishers", authorize(...staffRoles), asyncHandler(async (request, response) => {
  const input = extinguisherSchema.parse(request.body);
  const result = await db.query(
    `INSERT INTO extinguishers
      (customer_id, serial_number, extinguisher_type, capacity_kg, manufacturer, purchase_date, expiry_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      input.customerId,
      input.serialNumber,
      input.extinguisherType,
      input.capacityKg,
      input.manufacturer,
      input.purchaseDate,
      input.expiryDate,
      input.notes,
    ],
  );
  await audit(request.user, "EXTINGUISHER_CREATED", "extinguisher", result.rows[0].id, {
    serialNumber: input.serialNumber,
    customerId: input.customerId,
  });
  await recordExtinguisherHistory(result.rows[0].id, request.user, "PURCHASE_RECORDED", {
    serialNumber: input.serialNumber,
    customerId: input.customerId,
    expiryDate: formatDate(input.expiryDate),
  });
  response.status(201).json({ extinguisher: result.rows[0] });
  requestImmediateNotificationScan();
}));

app.patch("/extinguishers/:id", authorize(...staffRoles), asyncHandler(async (request, response) => {
  const { id } = uuidParam.parse(request.params);
  const input = extinguisherUpdateSchema.parse(request.body);
  if (!Object.keys(input).length) throw new AppError(400, "At least one field is required");
  const result = await db.query(
    `UPDATE extinguishers SET
       extinguisher_type = COALESCE($2, extinguisher_type),
       capacity_kg = COALESCE($3, capacity_kg), manufacturer = COALESCE($4, manufacturer),
       purchase_date = COALESCE($5, purchase_date), expiry_date = COALESCE($6, expiry_date),
       status = COALESCE($7, status), notes = COALESCE($8, notes), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [
      id,
      input.extinguisherType,
      input.capacityKg,
      input.manufacturer,
      input.purchaseDate,
      input.expiryDate,
      input.status,
      input.notes,
    ],
  );
  if (!result.rowCount) throw new AppError(404, "Extinguisher not found");
  await audit(request.user, "EXTINGUISHER_UPDATED", "extinguisher", id, input);
  await recordExtinguisherHistory(id, request.user, "DETAILS_UPDATED", input);
  response.json({ extinguisher: result.rows[0] });
  requestImmediateNotificationScan();
}));

app.get("/extinguishers/:id/history", asyncHandler(async (request, response) => {
  const { id } = uuidParam.parse(request.params);
  const params: unknown[] = [id];
  let scope = "";
  if (request.user!.role === "CUSTOMER") {
    params.push(request.user!.id);
    scope = "AND c.portal_user_id = $2";
  }
  const visible = await db.query(
    `SELECT 1 FROM extinguishers e JOIN customers c ON c.id = e.customer_id
     WHERE e.id = $1 ${scope}`,
    params,
  );
  if (!visible.rowCount) throw new AppError(404, "Extinguisher not found");
  const records = await db.query(
    "SELECT * FROM extinguisher_history WHERE extinguisher_id = $1 ORDER BY created_at DESC",
    [id],
  );
  response.json({ records: records.rows });
}));

app.get("/inspections", authorize("ADMIN", "STAFF", "CUSTOMER"), asyncHandler(async (request, response) => {
  const { page, limit, offset } = getPagination(request.query);
  const values: unknown[] = [];
  const conditions: string[] = [];
  if (request.user!.role === "CUSTOMER") {
    values.push(request.user!.id);
    conditions.push(`c.portal_user_id = $${values.length}`);
  }
  if (request.query.status) {
    values.push(String(request.query.status));
    conditions.push(`i.status = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const total = await db.query(
    `SELECT COUNT(*)::INTEGER AS count FROM inspections i
     JOIN extinguishers e ON e.id = i.extinguisher_id
     JOIN customers c ON c.id = e.customer_id ${where}`,
    values,
  );
  values.push(limit, offset);
  const records = await db.query(
    `SELECT i.*, e.serial_number, c.full_name AS customer_name
     FROM inspections i
     JOIN extinguishers e ON e.id = i.extinguisher_id
     JOIN customers c ON c.id = e.customer_id
     ${where} ORDER BY i.scheduled_date ASC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  response.json(paginated(records.rows, total.rows[0].count, page, limit));
}));

app.post("/inspections", authorize(...staffRoles), asyncHandler(async (request, response) => {
  const input = inspectionSchema.parse(request.body);
  const result = await db.query(
    `INSERT INTO inspections (extinguisher_id, scheduled_date, inspection_type, inspector_user_id, notes)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [input.extinguisherId, input.scheduledDate, input.inspectionType, request.user!.id, input.notes],
  );
  await audit(request.user, "INSPECTION_SCHEDULED", "inspection", result.rows[0].id, input);
  await recordExtinguisherHistory(input.extinguisherId, request.user, "INSPECTION_SCHEDULED", {
    inspectionId: result.rows[0].id,
    scheduledDate: formatDate(input.scheduledDate),
  });
  response.status(201).json({ inspection: result.rows[0] });
}));

app.patch("/inspections/:id", authorize(...staffRoles), asyncHandler(async (request, response) => {
  const { id } = uuidParam.parse(request.params);
  const input = inspectionUpdateSchema.parse(request.body);
  if (!Object.keys(input).length) throw new AppError(400, "At least one field is required");
  const result = await db.query(
    `UPDATE inspections SET scheduled_date = COALESCE($2, scheduled_date),
       completed_date = COALESCE($3, completed_date), status = COALESCE($4, status),
       notes = COALESCE($5, notes), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, input.scheduledDate, input.completedDate, input.status, input.notes],
  );
  if (!result.rowCount) throw new AppError(404, "Inspection not found");
  await audit(request.user, "INSPECTION_UPDATED", "inspection", id, input);
  await recordExtinguisherHistory(result.rows[0].extinguisher_id, request.user, "INSPECTION_UPDATED", {
    inspectionId: id,
    ...input,
  });
  response.json({ inspection: result.rows[0] });
}));

app.get("/service-requests", authorize("ADMIN", "STAFF", "CUSTOMER"), asyncHandler(async (request, response) => {
  const { page, limit, offset } = getPagination(request.query);
  const values: unknown[] = [];
  const conditions: string[] = [];
  if (request.user!.role === "CUSTOMER") {
    values.push(request.user!.id);
    conditions.push(`c.portal_user_id = $${values.length}`);
  }
  if (request.query.status) {
    values.push(String(request.query.status));
    conditions.push(`s.status = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const total = await db.query(
    `SELECT COUNT(*)::INTEGER AS count FROM service_requests s
     JOIN customers c ON c.id = s.customer_id ${where}`,
    values,
  );
  values.push(limit, offset);
  const records = await db.query(
    `SELECT s.*, e.serial_number, c.full_name AS customer_name
     FROM service_requests s
     JOIN extinguishers e ON e.id = s.extinguisher_id
     JOIN customers c ON c.id = s.customer_id
     ${where} ORDER BY s.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  response.json(paginated(records.rows, total.rows[0].count, page, limit));
}));

app.post("/service-requests", authorize("CUSTOMER"), asyncHandler(async (request, response) => {
  const input = serviceRequestSchema.parse(request.body);
  const customerId = await getCustomerScope(request.user!);
  if (!customerId) throw new AppError(400, "Complete your customer profile before requesting service");
  const equipment = await db.query(
    "SELECT 1 FROM extinguishers WHERE id = $1 AND customer_id = $2",
    [input.extinguisherId, customerId],
  );
  if (!equipment.rowCount) throw new AppError(404, "Extinguisher not found");
  const result = await db.query(
    `INSERT INTO service_requests (customer_id, extinguisher_id, request_type, customer_notes)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [customerId, input.extinguisherId, input.requestType, input.customerNotes],
  );
  await audit(request.user, "SERVICE_REQUEST_CREATED", "service_request", result.rows[0].id, input);
  await recordExtinguisherHistory(input.extinguisherId, request.user, "SERVICE_REQUEST_CREATED", {
    serviceRequestId: result.rows[0].id,
    requestType: input.requestType,
  });
  response.status(201).json({ serviceRequest: result.rows[0] });
}));

app.patch("/service-requests/:id", authorize(...staffRoles), asyncHandler(async (request, response) => {
  const { id } = uuidParam.parse(request.params);
  const input = serviceRequestUpdateSchema.parse(request.body);
  const result = await db.query(
    `UPDATE service_requests SET status = $2, staff_notes = $3, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, input.status, input.staffNotes],
  );
  if (!result.rowCount) throw new AppError(404, "Service request not found");
  await audit(request.user, "SERVICE_REQUEST_UPDATED", "service_request", id, input);
  await recordExtinguisherHistory(result.rows[0].extinguisher_id, request.user, "SERVICE_REQUEST_UPDATED", {
    serviceRequestId: id,
    status: input.status,
  });
  response.json({ serviceRequest: result.rows[0] });
}));

app.get("/notifications", asyncHandler(async (request, response) => {
  const { page, limit, offset } = getPagination(request.query);
  const values: unknown[] = [];
  let where = "";
  if (request.user!.role === "CUSTOMER") {
    values.push(request.user!.id);
    where = `WHERE n.target_user_id = $1 OR c.portal_user_id = $1`;
  } else if (request.user!.role === "POLICE") {
    where = `WHERE n.target_role = 'POLICE'`;
  }
  const total = await db.query(
    `SELECT COUNT(*)::INTEGER AS count FROM notifications n
     LEFT JOIN customers c ON c.id = n.customer_id ${where}`,
    values,
  );
  values.push(limit, offset);
  const records = await db.query(
    `SELECT n.*, c.full_name AS customer_name, e.serial_number
     FROM notifications n
     LEFT JOIN customers c ON c.id = n.customer_id
     LEFT JOIN extinguishers e ON e.id = n.extinguisher_id
     ${where} ORDER BY n.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  response.json(paginated(records.rows, total.rows[0].count, page, limit));
}));

app.patch("/notifications/:id/read", asyncHandler(async (request, response) => {
  const { id } = uuidParam.parse(request.params);
  const params: unknown[] = [id];
  let scope = "";
  if (request.user!.role === "CUSTOMER") {
    params.push(request.user!.id);
    scope = `AND (n.target_user_id = $2 OR c.portal_user_id = $2)`;
  } else if (request.user!.role === "POLICE") {
    scope = `AND n.target_role = 'POLICE'`;
  }
  const result = await db.query(
    `UPDATE notifications n SET is_read = TRUE
     FROM customers c
     WHERE n.id = $1 AND (n.customer_id = c.id OR n.customer_id IS NULL) ${scope}
     RETURNING n.*`,
    params,
  );
  if (!result.rowCount) throw new AppError(404, "Notification not found");
  await audit(request.user, "NOTIFICATION_READ", "notification", id);
  response.json({ notification: result.rows[0] });
}));

app.get("/settings/notifications", authorize("ADMIN"), asyncHandler(async (_request, response) => {
  const settings = await getNotificationSettings();
  response.json({ settings });
}));

app.patch("/settings/notifications", authorize("ADMIN"), asyncHandler(async (request, response) => {
  const input = notificationSettingsSchema.parse(request.body);
  const result = await db.query(
    `UPDATE notification_settings SET expiry_warning_days = $1, escalation_grace_days = $2,
       reminder_interval_days = $3, max_reminders = $4, updated_at = NOW()
     WHERE id = 1 RETURNING *`,
    [input.expiryWarningDays, input.escalationGraceDays, input.reminderIntervalDays, input.maxReminders],
  );
  await audit(request.user, "NOTIFICATION_SETTINGS_UPDATED", "notification_settings", "1", input);
  response.json({ settings: result.rows[0] });
}));

app.get("/reports/summary", asyncHandler(async (request, response) => {
  const isCustomer = request.user!.role === "CUSTOMER";
  const customerId = isCustomer ? await getCustomerScope(request.user!) : undefined;
  const params = isCustomer ? [customerId ?? "00000000-0000-0000-0000-000000000000"] : [];
  const equipmentScope = isCustomer ? "WHERE customer_id = $1" : "";
  const notificationScope = isCustomer ? "WHERE customer_id = $1" : "";
  const [customers, equipment, notifications, police, inspections, serviceRequests] = await Promise.all([
    isCustomer ? { rows: [{ count: customerId ? 1 : 0 }] } : db.query("SELECT COUNT(*)::INTEGER AS count FROM customers"),
    db.query(
      `SELECT COUNT(*)::INTEGER AS total,
              COUNT(*) FILTER (WHERE status = 'ACTIVE')::INTEGER AS active,
              COUNT(*) FILTER (WHERE status = 'EXPIRED')::INTEGER AS expired,
              COUNT(*) FILTER (WHERE expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30)::INTEGER AS expiring_soon
       FROM extinguishers ${equipmentScope}`,
      params,
    ),
    db.query(
      `SELECT COUNT(*) FILTER (WHERE is_read = FALSE)::INTEGER AS unread
       FROM notifications ${notificationScope}`,
      params,
    ),
    isCustomer
      ? { rows: [{ count: 0 }] }
      : db.query("SELECT COUNT(*) FILTER (WHERE status <> 'CLOSED')::INTEGER AS count FROM police_reports"),
    db.query(
      `SELECT COUNT(*) FILTER (WHERE i.status = 'SCHEDULED' AND i.scheduled_date <= CURRENT_DATE + 30)::INTEGER AS due
       FROM inspections i JOIN extinguishers e ON e.id = i.extinguisher_id
       ${isCustomer ? "WHERE e.customer_id = $1" : ""}`,
      params,
    ),
    db.query(
      `SELECT COUNT(*) FILTER (WHERE status IN ('REQUESTED', 'APPROVED', 'IN_PROGRESS'))::INTEGER AS pending
       FROM service_requests ${isCustomer ? "WHERE customer_id = $1" : ""}`,
      params,
    ),
  ]);
  response.json({
    customers: customers.rows[0].count,
    extinguishers: equipment.rows[0],
    unreadNotifications: notifications.rows[0].unread,
    openPoliceReports: police.rows[0].count,
    dueInspections: inspections.rows[0].due,
    pendingServiceRequests: serviceRequests.rows[0].pending,
  });
}));

app.get("/reports/management", authorize(...staffRoles), asyncHandler(async (_request, response) => {
  const [summary, salesByMonth, extinguisherStatuses, requestStatuses, notificationTypes] = await Promise.all([
    db.query(
      `SELECT
         (SELECT COUNT(*)::INTEGER FROM customers WHERE is_active = TRUE) AS active_customers,
         (SELECT COUNT(*)::INTEGER FROM extinguishers) AS sales_total,
         (SELECT COUNT(*)::INTEGER FROM extinguishers WHERE status = 'EXPIRED') AS expired_extinguishers,
         (SELECT COUNT(*)::INTEGER FROM inspections WHERE status = 'SCHEDULED' AND scheduled_date <= CURRENT_DATE + 30) AS inspections_due,
         (SELECT COUNT(*)::INTEGER FROM inspections WHERE status = 'MISSED') AS inspections_missed,
         (SELECT COUNT(*)::INTEGER FROM service_requests WHERE status IN ('REQUESTED', 'APPROVED', 'IN_PROGRESS')) AS pending_service_requests,
         (SELECT COUNT(*)::INTEGER FROM police_reports WHERE status <> 'CLOSED') AS open_escalations`,
    ),
    db.query(
      `SELECT TO_CHAR(DATE_TRUNC('month', purchase_date), 'YYYY-MM') AS month, COUNT(*)::INTEGER AS sales
       FROM extinguishers GROUP BY DATE_TRUNC('month', purchase_date) ORDER BY DATE_TRUNC('month', purchase_date) DESC LIMIT 12`,
    ),
    db.query("SELECT status, COUNT(*)::INTEGER AS count FROM extinguishers GROUP BY status ORDER BY status"),
    db.query("SELECT status, COUNT(*)::INTEGER AS count FROM service_requests GROUP BY status ORDER BY status"),
    db.query("SELECT type, COUNT(*)::INTEGER AS count FROM notifications GROUP BY type ORDER BY type"),
  ]);
  response.json({
    summary: summary.rows[0],
    salesByMonth: salesByMonth.rows,
    extinguisherStatuses: extinguisherStatuses.rows,
    serviceRequestStatuses: requestStatuses.rows,
    notificationTypes: notificationTypes.rows,
  });
}));

app.get("/reports/police", authorize("ADMIN", "STAFF", "POLICE"), asyncHandler(async (request, response) => {
  const { page, limit, offset } = getPagination(request.query);
  const total = await db.query("SELECT COUNT(*)::INTEGER AS count FROM police_reports");
  const records = await db.query(
    `SELECT p.*, c.full_name AS customer_name, c.email AS customer_email, c.phone,
            e.serial_number, e.expiry_date
     FROM police_reports p
     JOIN customers c ON c.id = p.customer_id
     JOIN extinguishers e ON e.id = p.extinguisher_id
     ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  response.json(paginated(records.rows, total.rows[0].count, page, limit));
}));

app.patch("/reports/police/:id", authorize("ADMIN", "POLICE"), asyncHandler(async (request, response) => {
  const { id } = uuidParam.parse(request.params);
  const { status } = reportStatusSchema.parse(request.body);
  const result = await db.query(
    "UPDATE police_reports SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *",
    [id, status],
  );
  if (!result.rowCount) throw new AppError(404, "Police report not found");
  await audit(request.user, "POLICE_REPORT_UPDATED", "police_report", id, { status });
  response.json({ report: result.rows[0] });
}));

app.get("/logs", authorize(...staffRoles), asyncHandler(async (request, response) => {
  const { page, limit, offset } = getPagination(request.query);
  const total = await db.query("SELECT COUNT(*)::INTEGER AS count FROM audit_logs");
  const records = await db.query(
    "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    [limit, offset],
  );
  response.json(paginated(records.rows, total.rows[0].count, page, limit));
}));

app.use(notFound);
app.use(errorHandler);
