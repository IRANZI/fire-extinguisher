import { JwtUser } from "@fems/shared";
import { db } from "../config/db";

export const getCustomerScope = async (user: JwtUser) => {
  const result = await db.query("SELECT id FROM customers WHERE portal_user_id = $1", [user.id]);
  return result.rows[0]?.id as string | undefined;
};
