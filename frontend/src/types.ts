export type Role = "ADMIN" | "STAFF" | "POLICE" | "CUSTOMER";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface Customer {
  id: string;
  portal_user_id?: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  national_id?: string;
  company_name?: string;
  is_active: boolean;
  created_at: string;
}

export interface Extinguisher {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  serial_number: string;
  extinguisher_type: string;
  capacity_kg: string;
  manufacturer: string;
  purchase_date: string;
  expiry_date: string;
  status: "ACTIVE" | "EXPIRED" | "SERVICED" | "REPLACED";
  notes?: string;
}

export interface AppNotification {
  id: string;
  customer_name?: string;
  serial_number?: string;
  type: "EXPIRY_WARNING" | "EXPIRY_OVERDUE" | "POLICE_ESCALATION" | "SYSTEM";
  title: string;
  message: string;
  is_read: boolean;
  reminder_count: number;
  last_reminded_at?: string;
  email_sent_at?: string;
  created_at: string;
}

export interface ExtinguisherHistory {
  id: string;
  action: string;
  actor_role?: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface Inspection {
  id: string;
  extinguisher_id: string;
  serial_number: string;
  customer_name: string;
  scheduled_date: string;
  completed_date?: string;
  inspection_type: "ROUTINE" | "ANNUAL" | "POST_SERVICE";
  status: "SCHEDULED" | "COMPLETED" | "MISSED" | "CANCELLED";
  notes?: string;
}

export interface ServiceRequest {
  id: string;
  extinguisher_id: string;
  serial_number: string;
  customer_name: string;
  request_type: "SERVICE" | "RENEWAL" | "REPLACEMENT";
  status: "REQUESTED" | "APPROVED" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";
  customer_notes?: string;
  staff_notes?: string;
  created_at: string;
}

export interface PoliceReport {
  id: string;
  customer_name: string;
  customer_email: string;
  phone: string;
  serial_number: string;
  expiry_date: string;
  reason: string;
  status: "OPEN" | "REVIEWING" | "CLOSED";
  created_at: string;
}

export interface AuditLog {
  id: number;
  actor_role?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface Summary {
  customers: number;
  extinguishers: {
    total: number;
    active: number;
    expired: number;
    expiring_soon: number;
  };
  unreadNotifications: number;
  openPoliceReports: number;
  dueInspections: number;
  pendingServiceRequests: number;
}
