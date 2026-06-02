import { JwtUser } from "@fems/shared";
import { db } from "../config/db";

export const auditReportUpdate = async (actor: JwtUser, reportId: string, status: string) => {
  await db.query(
    `INSERT INTO audit_logs (actor_user_id, actor_role, action, entity_type, entity_id, details)
     VALUES ($1, $2, 'POLICE_REPORT_UPDATED', 'police_report', $3, $4)`,
    [actor.id, actor.role, reportId, { status }],
  );
};
