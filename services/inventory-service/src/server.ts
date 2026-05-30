import "./env";
import cors from "cors";
import express, { NextFunction, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { z } from "zod";
import {
  AppError,
  AuthenticatedRequest,
  JwtUser,
  asyncHandler,
  authenticate,
  authorize,
  errorHandler,
  getPagination,
  httpLogger,
  logger,
  notFound,
  paginated,
} from "@fems/shared";
import { db } from "./db";
import { swaggerDocument } from "./swagger";

const app = express();
const port = Number(process.env.PORT ?? 4002);
const staffRoles = ["ADMIN", "STAFF"] as const;
const internalSecret = process.env.INTERNAL_SECRET;
if (!internalSecret) throw new Error("INTERNAL_SECRET is required");

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL?.split(",") ?? ["http://localhost:5173"],
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
  expiryDate: z.coerce.date().optional(),
  status: z.enum(["ACTIVE", "EXPIRED", "SERVICED", "REPLACED"]).optional(),
  notes: z.string().trim().max(1000).optional(),
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

const audit = async (
  actor: JwtUser | undefined,
  action: string,
  entityType: string,
  entityId?: string,
  details: Record<string, unknown> = {},
) => {
  await db.query(
    `INSERT INTO audit_logs (actor_user_id, actor_role, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [actor?.id ?? null, actor?.role ?? "SYSTEM", action, entityType, entityId ?? null, details],
  );
};

const internalOnly = (
  request: AuthenticatedRequest,
  _response: Response,
  next: NextFunction,
) => {
  if (request.header("x-internal-secret") !== internalSecret) {
    return next(new AppError(403, "Internal service credential is invalid"));
  }
  next();
};

const getCustomerScope = async (user: JwtUser) => {
  const result = await db.query("SELECT id FROM customers WHERE portal_user_id = $1", [user.id]);
  return result.rows[0]?.id as string | undefined;
};

const requestImmediateNotificationScan = () => {
  const notificationUrl = process.env.NOTIFICATION_SERVICE_URL ?? "http://localhost:4003";
  fetch(`${notificationUrl}/internal/notifications/scan`, {
    method: "POST",
    headers: { "x-internal-secret": internalSecret },
  }).catch((error) => {
    logger.warn({ error }, "immediate notification scan could not be requested");
  });
};

app.get("/health", asyncHandler(async (_request, response) => {
  await db.query("SELECT 1");
  response.json({ service: "inventory-service", status: "ok" });
}));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.post("/internal/expiry-scan", internalOnly, asyncHandler(async (_request, response) => {
  const warningDays = Math.max(Number(process.env.EXPIRY_WARNING_DAYS ?? 30), 1);
  const graceDays = Math.max(Number(process.env.ESCALATION_GRACE_DAYS ?? 7), 1);
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
      `SELECT id, created_at, is_read, email_sent_at, title, message
       FROM notifications WHERE extinguisher_id = $1 AND type = $2
       ORDER BY created_at DESC LIMIT 1`,
      [item.id, type],
    );

    if (isExpired && item.status !== "EXPIRED") {
      await db.query("UPDATE extinguishers SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1", [item.id]);
    }

    if (!existing.rowCount) {
      const title = isExpired ? "Fire extinguisher expired" : "Fire extinguisher expiry reminder";
      const message = isExpired
        ? `Extinguisher ${item.serial_number} expired on ${item.expiry_date}. Please contact the company immediately.`
        : `Extinguisher ${item.serial_number} expires on ${item.expiry_date}. Please arrange servicing or replacement.`;
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
    } else if (!existing.rows[0].email_sent_at) {
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
           ORDER BY created_at DESC LIMIT 1`,
          [item.id, graceDays],
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
    await db.query("UPDATE notifications SET email_sent_at = NOW() WHERE id = $1", [input.notificationId]);
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
    ? `WHERE full_name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1`
    : "";
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
  response.status(201).json({ extinguisher: result.rows[0] });
  requestImmediateNotificationScan();
}));

app.patch("/extinguishers/:id", authorize(...staffRoles), asyncHandler(async (request, response) => {
  const { id } = uuidParam.parse(request.params);
  const input = extinguisherUpdateSchema.parse(request.body);
  if (!Object.keys(input).length) throw new AppError(400, "At least one field is required");
  const result = await db.query(
    `UPDATE extinguishers SET
       expiry_date = COALESCE($2, expiry_date), status = COALESCE($3, status),
       notes = COALESCE($4, notes), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, input.expiryDate, input.status, input.notes],
  );
  if (!result.rowCount) throw new AppError(404, "Extinguisher not found");
  await audit(request.user, "EXTINGUISHER_UPDATED", "extinguisher", id, input);
  response.json({ extinguisher: result.rows[0] });
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

app.get("/reports/summary", asyncHandler(async (request, response) => {
  const isCustomer = request.user!.role === "CUSTOMER";
  const customerId = isCustomer ? await getCustomerScope(request.user!) : undefined;
  const params = isCustomer ? [customerId ?? "00000000-0000-0000-0000-000000000000"] : [];
  const equipmentScope = isCustomer ? "WHERE customer_id = $1" : "";
  const notificationScope = isCustomer ? "WHERE customer_id = $1" : "";
  const [customers, equipment, notifications, police] = await Promise.all([
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
  ]);
  response.json({
    customers: customers.rows[0].count,
    extinguishers: equipment.rows[0],
    unreadNotifications: notifications.rows[0].unread,
    openPoliceReports: police.rows[0].count,
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

const start = async () => {
  await db.query("SELECT 1");
  app.listen(port, () => logger.info({ port }, "inventory-service listening"));
};

start().catch((error) => {
  logger.fatal(error, "inventory-service failed to start");
  process.exit(1);
});
