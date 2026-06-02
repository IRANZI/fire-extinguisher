import { JwtUser } from "@fems/shared";
import { db } from "../config/db";

export const audit = async (
  actor: JwtUser | undefined,
  action: string,
  entityId?: string,
  details: Record<string, unknown> = {},
) => {
  await db.query(
    `INSERT INTO audit_logs (actor_user_id, actor_role, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, 'customer', $4, $5)`,
    [actor?.id ?? null, actor?.role ?? "SYSTEM", action, entityId ?? null, details],
  );
};
