import { Request } from "express";
import { JwtUser, getPagination, paginated } from "@fems/shared";
import { db } from "../config/db";
import { PoliceReportStatus } from "../models/policeAlert.model";
import { auditReportUpdate } from "../utils/audit";

export const listReports = async (query: Request["query"]) => {
  const { page, limit, offset } = getPagination(query);
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
  return paginated(records.rows, total.rows[0].count, page, limit);
};

export const updateReport = async (actor: JwtUser, id: string, status: PoliceReportStatus) => {
  const result = await db.query(
    "UPDATE police_reports SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *",
    [id, status],
  );
  if (result.rowCount) await auditReportUpdate(actor, id, status);
  return result.rows[0];
};
