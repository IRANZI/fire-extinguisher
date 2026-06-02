import { JwtUser } from "@fems/shared";
import { db } from "../config/db";

export const audit = async (
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

export const recordExtinguisherHistory = async (
  extinguisherId: string,
  actor: JwtUser | undefined,
  action: string,
  details: Record<string, unknown> = {},
) => {
  await db.query(
    `INSERT INTO extinguisher_history (extinguisher_id, actor_user_id, actor_role, action, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [extinguisherId, actor?.id ?? null, actor?.role ?? "SYSTEM", action, details],
  );
};
