import { useEffect, useState, type FormEvent } from "react";
import { CalendarCheck, History, Plus, Save, Settings2, Wrench } from "lucide-react";
import { api, getErrorMessage } from "../lib/api";
import type {
  Extinguisher,
  ExtinguisherHistory,
  Inspection,
  Pagination as PaginationType,
  ServiceRequest,
} from "../types";
import { Modal } from "./Modal";
import { Pagination } from "./Pagination";

const emptyPagination = { page: 1, limit: 10, total: 0, pages: 0 };
const date = (value?: string) => value ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value)) : "-";
const stamp = (value: string) => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const title = (value: string) => value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const Status = ({ value }: { value: string }) => (
  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-slate-600">
    {title(value)}
  </span>
);

const ErrorBanner = ({ message }: { message: string }) => message
  ? <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div>
  : null;

export const InspectionsPanel = ({ equipment, canManage }: { equipment: Extinguisher[]; canManage: boolean }) => {
  const [records, setRecords] = useState<Inspection[]>([]);
  const [pagination, setPagination] = useState<PaginationType>(emptyPagination);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ extinguisherId: "", scheduledDate: "", inspectionType: "ROUTINE", notes: "" });

  const load = async (page = 1) => {
    try {
      const { data } = await api.get("/inventory/inspections", { params: { page } });
      setRecords(data.records);
      setPagination(data.pagination);
      setError("");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.post("/inventory/inspections", form);
      setShowForm(false);
      setForm({ extinguisherId: "", scheduledDate: "", inspectionType: "ROUTINE", notes: "" });
      void load();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  const updateStatus = async (id: string, status: Inspection["status"]) => {
    try {
      await api.patch(`/inventory/inspections/${id}`, {
        status,
        completedDate: status === "COMPLETED" ? new Date().toISOString().slice(0, 10) : undefined,
      });
      void load(pagination.page);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  return <>
    <ErrorBanner message={error} />
    <section className="card overflow-hidden">
      <div className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
        <div><h2 className="text-lg font-black">Inspection schedules</h2><p className="mt-1 text-sm text-slate-400">Plan routine checks and record completion status.</p></div>
        {canManage && <button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Schedule inspection</button>}
      </div>
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-sand text-xs uppercase tracking-wider text-slate-400"><th className="px-4 py-3">Extinguisher</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Schedule</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-b border-sand/70 last:border-0"><td className="px-4 py-4 font-bold">{record.serial_number}</td><td className="px-4 py-4 text-slate-500">{record.customer_name}</td><td className="px-4 py-4"><Status value={record.inspection_type} /></td><td className="whitespace-nowrap px-4 py-4 text-slate-500">{date(record.scheduled_date)}</td><td className="px-4 py-4">{canManage ? <select className="rounded-lg border border-sand bg-white px-2 py-1.5 text-xs font-bold" value={record.status} onChange={(event) => void updateStatus(record.id, event.target.value as Inspection["status"])}><option value="SCHEDULED">Scheduled</option><option value="COMPLETED">Completed</option><option value="MISSED">Missed</option><option value="CANCELLED">Cancelled</option></select> : <Status value={record.status} />}</td></tr>)}</tbody></table>{!records.length && <div className="px-4 py-14 text-center text-sm text-slate-400">No inspections scheduled yet.</div>}</div>
      <Pagination pagination={pagination} onPage={load} />
    </section>
    {showForm && <Modal title="Schedule inspection" onClose={() => setShowForm(false)}><form className="grid gap-4 sm:grid-cols-2" onSubmit={create}>
      <label className="sm:col-span-2"><span className="label">Extinguisher</span><select className="field" required value={form.extinguisherId} onChange={(event) => setForm({ ...form, extinguisherId: event.target.value })}><option value="">Select extinguisher</option>{equipment.map((item) => <option key={item.id} value={item.id}>{item.serial_number} - {item.customer_name}</option>)}</select></label>
      <label><span className="label">Inspection date</span><input className="field" type="date" required value={form.scheduledDate} onChange={(event) => setForm({ ...form, scheduledDate: event.target.value })} /></label>
      <label><span className="label">Inspection type</span><select className="field" value={form.inspectionType} onChange={(event) => setForm({ ...form, inspectionType: event.target.value })}><option value="ROUTINE">Routine</option><option value="ANNUAL">Annual</option><option value="POST_SERVICE">Post-service</option></select></label>
      <label className="sm:col-span-2"><span className="label">Notes</span><textarea className="field min-h-24" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      <button className="btn-primary sm:col-span-2"><CalendarCheck size={16} /> Save inspection</button>
    </form></Modal>}
  </>;
};

export const ServiceRequestsPanel = ({ equipment, isCustomer, canManage }: { equipment: Extinguisher[]; isCustomer: boolean; canManage: boolean }) => {
  const [records, setRecords] = useState<ServiceRequest[]>([]);
  const [pagination, setPagination] = useState<PaginationType>(emptyPagination);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ extinguisherId: "", requestType: "SERVICE", customerNotes: "" });

  const load = async (page = 1) => {
    try {
      const { data } = await api.get("/inventory/service-requests", { params: { page } });
      setRecords(data.records);
      setPagination(data.pagination);
      setError("");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.post("/inventory/service-requests", form);
      setShowForm(false);
      setForm({ extinguisherId: "", requestType: "SERVICE", customerNotes: "" });
      void load();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  const updateStatus = async (id: string, status: ServiceRequest["status"]) => {
    try {
      await api.patch(`/inventory/service-requests/${id}`, { status });
      void load(pagination.page);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  return <>
    <ErrorBanner message={error} />
    <section className="card overflow-hidden">
      <div className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
        <div><h2 className="text-lg font-black">Service and renewal requests</h2><p className="mt-1 text-sm text-slate-400">Track customer requests from submission through completion.</p></div>
        {isCustomer && <button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Request service</button>}
      </div>
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-sand text-xs uppercase tracking-wider text-slate-400"><th className="px-4 py-3">Extinguisher</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Request</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-b border-sand/70 last:border-0"><td className="px-4 py-4 font-bold">{record.serial_number}</td><td className="px-4 py-4 text-slate-500">{record.customer_name}</td><td className="px-4 py-4"><Status value={record.request_type} /></td><td className="whitespace-nowrap px-4 py-4 text-slate-500">{date(record.created_at)}</td><td className="px-4 py-4">{canManage ? <select className="rounded-lg border border-sand bg-white px-2 py-1.5 text-xs font-bold" value={record.status} onChange={(event) => void updateStatus(record.id, event.target.value as ServiceRequest["status"])}><option value="REQUESTED">Requested</option><option value="APPROVED">Approved</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option><option value="REJECTED">Rejected</option></select> : <Status value={record.status} />}</td></tr>)}</tbody></table>{!records.length && <div className="px-4 py-14 text-center text-sm text-slate-400">No service requests yet.</div>}</div>
      <Pagination pagination={pagination} onPage={load} />
    </section>
    {showForm && <Modal title="Request servicing or renewal" onClose={() => setShowForm(false)}><form className="grid gap-4" onSubmit={create}>
      <label><span className="label">Extinguisher</span><select className="field" required value={form.extinguisherId} onChange={(event) => setForm({ ...form, extinguisherId: event.target.value })}><option value="">Select extinguisher</option>{equipment.map((item) => <option key={item.id} value={item.id}>{item.serial_number} - expires {date(item.expiry_date)}</option>)}</select></label>
      <label><span className="label">Request type</span><select className="field" value={form.requestType} onChange={(event) => setForm({ ...form, requestType: event.target.value })}><option value="SERVICE">Service</option><option value="RENEWAL">Renewal</option><option value="REPLACEMENT">Replacement</option></select></label>
      <label><span className="label">Notes</span><textarea className="field min-h-24" value={form.customerNotes} onChange={(event) => setForm({ ...form, customerNotes: event.target.value })} /></label>
      <button className="btn-primary"><Wrench size={16} /> Submit request</button>
    </form></Modal>}
  </>;
};

export const NotificationSettingsPanel = () => {
  const [form, setForm] = useState({ expiryWarningDays: 30, escalationGraceDays: 7, reminderIntervalDays: 3, maxReminders: 3 });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/inventory/settings/notifications").then(({ data }) => setForm({
      expiryWarningDays: data.settings.expiry_warning_days,
      escalationGraceDays: data.settings.escalation_grace_days,
      reminderIntervalDays: data.settings.reminder_interval_days,
      maxReminders: data.settings.max_reminders,
    })).catch((requestError) => setError(getErrorMessage(requestError)));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.patch("/inventory/settings/notifications", form);
      setMessage("Notification settings saved.");
      setError("");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  return <section className="card max-w-3xl p-5 sm:p-7">
    <Settings2 className="text-moss" />
    <h2 className="mt-5 text-2xl font-black tracking-tight">Notification settings</h2>
    <p className="mt-2 text-sm leading-6 text-slate-500">Control reminder timing and when unresolved cases escalate to safety authorities.</p>
    <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
      {[
        ["Expiry warning days", "expiryWarningDays"],
        ["Escalation grace days", "escalationGraceDays"],
        ["Reminder interval days", "reminderIntervalDays"],
        ["Maximum reminders", "maxReminders"],
      ].map(([label, key]) => <label key={key}><span className="label">{label}</span><input className="field" type="number" min="1" required value={form[key as keyof typeof form]} onChange={(event) => setForm({ ...form, [key]: Number(event.target.value) })} /></label>)}
      {message && <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 sm:col-span-2">{message}</div>}
      <ErrorBanner message={error} />
      <button className="btn-primary sm:col-span-2"><Save size={16} /> Save settings</button>
    </form>
  </section>;
};

export const ManagementReportsPanel = () => {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/inventory/reports/management").then((response) => setData(response.data)).catch((requestError) => setError(getErrorMessage(requestError)));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!data) return <div className="text-sm text-slate-400">Loading management reports...</div>;
  const summary = data.summary;

  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[["Active customers", summary.active_customers], ["Recorded sales", summary.sales_total], ["Inspections due", summary.inspections_due], ["Pending requests", summary.pending_service_requests]].map(([label, value]) => <div className="card p-5" key={label}><p className="text-3xl font-black tracking-tight">{value}</p><p className="mt-2 text-sm font-semibold text-slate-500">{label}</p></div>)}
    </div>
    <section className="card overflow-hidden"><div className="px-5 py-4"><h2 className="text-lg font-black">Monthly sales report</h2><p className="mt-1 text-sm text-slate-400">Registered extinguisher purchases grouped by month.</p></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-sand text-xs uppercase tracking-wider text-slate-400"><th className="px-4 py-3">Month</th><th className="px-4 py-3">Sales</th></tr></thead><tbody>{data.salesByMonth.map((row: { month: string; sales: number }) => <tr key={row.month} className="border-b border-sand/70 last:border-0"><td className="px-4 py-4 font-bold">{row.month}</td><td className="px-4 py-4 text-slate-500">{row.sales}</td></tr>)}</tbody></table></div></section>
  </div>;
};

export const HistoryModal = ({ extinguisher, onClose }: { extinguisher: Extinguisher; onClose: () => void }) => {
  const [records, setRecords] = useState<ExtinguisherHistory[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/inventory/extinguishers/${extinguisher.id}/history`).then(({ data }) => setRecords(data.records)).catch((requestError) => setError(getErrorMessage(requestError)));
  }, [extinguisher.id]);

  return <Modal title={`History: ${extinguisher.serial_number}`} onClose={onClose}>
    <ErrorBanner message={error} />
    <div className="space-y-3">{records.map((record) => <div key={record.id} className="rounded-xl border border-sand bg-white p-4"><div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{title(record.action)}</strong><span className="text-xs text-slate-400">{stamp(record.created_at)}</span></div><p className="mt-2 text-xs font-bold uppercase tracking-wider text-moss">{record.actor_role ?? "SYSTEM"}</p></div>)}{!records.length && !error && <div className="py-10 text-center text-sm text-slate-400"><History className="mx-auto mb-3" />No history entries yet.</div>}</div>
  </Modal>;
};

