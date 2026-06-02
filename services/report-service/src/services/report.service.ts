import { Request } from "express";
import { JwtUser, getPagination, paginated } from "@fems/shared";
import { db } from "../config/db";

const getCustomerScope = async (user: JwtUser) => {
  const result = await db.query("SELECT id FROM customers WHERE portal_user_id = $1", [user.id]);
  return result.rows[0]?.id as string | undefined;
};

export const getSummary = async (user: JwtUser) => {
  const isCustomer = user.role === "CUSTOMER";
  const customerId = isCustomer ? await getCustomerScope(user) : undefined;
  const params = isCustomer ? [customerId ?? "00000000-0000-0000-0000-000000000000"] : [];
  const equipmentScope = isCustomer ? "WHERE customer_id = $1" : "";
  const notificationScope = isCustomer ? "WHERE customer_id = $1" : "";
  const [customers, equipment, notifications, police, inspections, serviceRequests] = await Promise.all([
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
    db.query(
      `SELECT COUNT(*) FILTER (WHERE i.status = 'SCHEDULED' AND i.scheduled_date <= CURRENT_DATE + 30)::INTEGER AS due
       FROM inspections i JOIN extinguishers e ON e.id = i.extinguisher_id
       ${isCustomer ? "WHERE e.customer_id = $1" : ""}`,
      params,
    ),
    db.query(
      `SELECT COUNT(*) FILTER (WHERE status IN ('REQUESTED', 'APPROVED', 'IN_PROGRESS'))::INTEGER AS pending
       FROM service_requests ${isCustomer ? "WHERE customer_id = $1" : ""}`,
      params,
    ),
  ]);
  return {
    customers: customers.rows[0].count,
    extinguishers: equipment.rows[0],
    unreadNotifications: notifications.rows[0].unread,
    openPoliceReports: police.rows[0].count,
    dueInspections: inspections.rows[0].due,
    pendingServiceRequests: serviceRequests.rows[0].pending,
  };
};

export const getManagement = async () => {
  const [summary, salesByMonth, extinguisherStatuses, requestStatuses, notificationTypes] = await Promise.all([
    db.query(
      `SELECT
         (SELECT COUNT(*)::INTEGER FROM customers WHERE is_active = TRUE) AS active_customers,
         (SELECT COUNT(*)::INTEGER FROM extinguishers) AS sales_total,
         (SELECT COUNT(*)::INTEGER FROM extinguishers WHERE status = 'EXPIRED') AS expired_extinguishers,
         (SELECT COUNT(*)::INTEGER FROM inspections WHERE status = 'SCHEDULED' AND scheduled_date <= CURRENT_DATE + 30) AS inspections_due,
         (SELECT COUNT(*)::INTEGER FROM inspections WHERE status = 'MISSED') AS inspections_missed,
         (SELECT COUNT(*)::INTEGER FROM service_requests WHERE status IN ('REQUESTED', 'APPROVED', 'IN_PROGRESS')) AS pending_service_requests,
         (SELECT COUNT(*)::INTEGER FROM police_reports WHERE status <> 'CLOSED') AS open_escalations`,
    ),
    db.query(
      `SELECT TO_CHAR(DATE_TRUNC('month', purchase_date), 'YYYY-MM') AS month, COUNT(*)::INTEGER AS sales
       FROM extinguishers GROUP BY DATE_TRUNC('month', purchase_date) ORDER BY DATE_TRUNC('month', purchase_date) DESC LIMIT 12`,
    ),
    db.query("SELECT status, COUNT(*)::INTEGER AS count FROM extinguishers GROUP BY status ORDER BY status"),
    db.query("SELECT status, COUNT(*)::INTEGER AS count FROM service_requests GROUP BY status ORDER BY status"),
    db.query("SELECT type, COUNT(*)::INTEGER AS count FROM notifications GROUP BY type ORDER BY type"),
  ]);
  return {
    summary: summary.rows[0],
    salesByMonth: salesByMonth.rows,
    extinguisherStatuses: extinguisherStatuses.rows,
    serviceRequestStatuses: requestStatuses.rows,
    notificationTypes: notificationTypes.rows,
  };
};

export const listAuditLogs = async (query: Request["query"]) => {
  const { page, limit, offset } = getPagination(query);
  const total = await db.query("SELECT COUNT(*)::INTEGER AS count FROM audit_logs");
  const records = await db.query(
    "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    [limit, offset],
  );
  return paginated(records.rows, total.rows[0].count, page, limit);
};
