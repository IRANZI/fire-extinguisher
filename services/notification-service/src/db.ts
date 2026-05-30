import { Pool } from "pg";

export const db = new Pool({
  connectionString:
    process.env.NOTIFICATION_DATABASE_URL ??
    "postgres://postgres:user@localhost:5432/fems_notification",
});
