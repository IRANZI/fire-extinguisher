import { db } from "../config/db";

export const getNotificationSettings = async () => {
  const result = await db.query(
    `SELECT expiry_warning_days, escalation_grace_days, reminder_interval_days, max_reminders
     FROM notification_settings WHERE id = 1`,
  );
  return result.rows[0] ?? {
    expiry_warning_days: Number(process.env.EXPIRY_WARNING_DAYS ?? 30),
    escalation_grace_days: Number(process.env.ESCALATION_GRACE_DAYS ?? 7),
    reminder_interval_days: 3,
    max_reminders: 3,
  };
};
