import { Request } from "express";
import { JwtUser, getPagination, paginated } from "@fems/shared";
import { db } from "../config/db";
import { CustomerInput, CustomerUpdate } from "../models/customer.model";
import { audit } from "../utils/audit";

export const getSelf = async (userId: string) => {
  const result = await db.query("SELECT * FROM customers WHERE portal_user_id = $1", [userId]);
  return result.rows[0] ?? null;
};

export const saveSelf = async (user: JwtUser, input: Omit<CustomerInput, "portalUserId">) => {
  let result = await db.query(
    `UPDATE customers SET portal_user_id = $1, full_name = $2, email = $3, phone = $4,
       address = $5, national_id = $6, company_name = $7, updated_at = NOW()
     WHERE id = (
       SELECT id FROM customers
       WHERE portal_user_id IS NULL AND LOWER(email) = LOWER($3)
       ORDER BY created_at ASC LIMIT 1
     )
     RETURNING *`,
    [user.id, input.fullName, input.email, input.phone, input.address, input.nationalId, input.companyName],
  );
  if (!result.rowCount) {
    result = await db.query(
      `INSERT INTO customers (portal_user_id, full_name, email, phone, address, national_id, company_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (portal_user_id) WHERE portal_user_id IS NOT NULL DO UPDATE SET
         full_name = EXCLUDED.full_name, email = EXCLUDED.email, phone = EXCLUDED.phone,
         address = EXCLUDED.address, national_id = EXCLUDED.national_id,
         company_name = EXCLUDED.company_name, updated_at = NOW()
       RETURNING *`,
      [user.id, input.fullName, input.email, input.phone, input.address, input.nationalId, input.companyName],
    );
  }
  await audit(user, "CUSTOMER_PROFILE_SAVED", result.rows[0].id);
  return result.rows[0];
};

export const listCustomers = async (query: Request["query"]) => {
  const { page, limit, offset } = getPagination(query);
  const search = String(query.search ?? "").trim();
  const values: unknown[] = [];
  const where = search
    ? "WHERE is_active = TRUE AND (full_name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)"
    : "WHERE is_active = TRUE";
  if (search) values.push(`%${search}%`);
  const total = await db.query(`SELECT COUNT(*)::INTEGER AS count FROM customers ${where}`, values);
  values.push(limit, offset);
  const records = await db.query(
    `SELECT * FROM customers ${where}
     ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return paginated(records.rows, total.rows[0].count, page, limit);
};

export const createCustomer = async (user: JwtUser, input: CustomerInput) => {
  const result = await db.query(
    `INSERT INTO customers (portal_user_id, full_name, email, phone, address, national_id, company_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [input.portalUserId, input.fullName, input.email, input.phone, input.address, input.nationalId, input.companyName],
  );
  await audit(user, "CUSTOMER_CREATED", result.rows[0].id);
  return result.rows[0];
};

export const updateCustomer = async (user: JwtUser, id: string, input: CustomerUpdate) => {
  const result = await db.query(
    `UPDATE customers SET
       full_name = COALESCE($2, full_name), email = COALESCE($3, email),
       phone = COALESCE($4, phone), address = COALESCE($5, address),
       national_id = COALESCE($6, national_id), company_name = COALESCE($7, company_name),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, input.fullName, input.email, input.phone, input.address, input.nationalId, input.companyName],
  );
  await audit(user, "CUSTOMER_UPDATED", id, input);
  return result.rows[0];
};

export const archiveCustomer = async (user: JwtUser, id: string) => {
  const result = await db.query(
    "UPDATE customers SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id",
    [id],
  );
  if (result.rowCount) await audit(user, "CUSTOMER_ARCHIVED", id);
  return Boolean(result.rowCount);
};
