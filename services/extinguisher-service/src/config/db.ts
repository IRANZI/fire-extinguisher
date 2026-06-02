import { Pool } from "pg";

export const db = new Pool({
  connectionString:
    process.env.EXTINGUISHER_DATABASE_URL ??
    process.env.INVENTORY_DATABASE_URL ??
    "postgres://postgres:user@localhost:5432/fems_inventory",
});
