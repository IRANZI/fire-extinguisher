import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  BookOpen,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Flame,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  RefreshCcw,
  Search,
  ShieldAlert,
  UserCircle,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Modal } from "../components/Modal";
import { Pagination } from "../components/Pagination";
import { CustomerForm, ExtinguisherForm, ProfileForm } from "../components/Forms";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  clearFeedback,
  fetchCustomers,
  fetchExtinguishers,
  fetchLogs,
  fetchNotifications,
  fetchReports,
  fetchSummary,
  markNotificationRead,
  runExpiryScan,
} from "../store/inventorySlice";
import type { Extinguisher, Role } from "../types";
import { api, getErrorMessage } from "../lib/api";
import type { Pagination as PaginationType, User } from "../types";

type Section = "dashboard" | "extinguishers" | "customers" | "users" | "notifications" | "reports" | "logs" | "profile";

const date = (value?: string) => value ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value)) : "-";
const stamp = (value: string) => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const title = (value: string) => value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter: string) => letter.toUpperCase());

const statusStyle: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  EXPIRED: "bg-red-50 text-red-700",
  SERVICED: "bg-blue-50 text-blue-700",
  REPLACED: "bg-slate-100 text-slate-600",
  OPEN: "bg-red-50 text-red-700",
  REVIEWING: "bg-amber-50 text-amber-700",
  CLOSED: "bg-emerald-50 text-emerald-700",
};

const Status = ({ value }: { value: string }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${statusStyle[value] ?? "bg-slate-100 text-slate-600"}`}>
    {title(value)}
  </span>
);

const nav = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard, roles: ["ADMIN", "STAFF", "POLICE", "CUSTOMER"] },
  { id: "extinguishers", label: "Extinguishers", icon: Boxes, roles: ["ADMIN", "STAFF", "POLICE", "CUSTOMER"] },
  { id: "customers", label: "Customers", icon: Users, roles: ["ADMIN", "STAFF"] },
  { id: "users", label: "User accounts", icon: UserCog, roles: ["ADMIN"] },
  { id: "notifications", label: "Notifications", icon: Bell, roles: ["ADMIN", "STAFF", "POLICE", "CUSTOMER"] },
  { id: "reports", label: "Police reports", icon: ShieldAlert, roles: ["ADMIN", "STAFF", "POLICE"] },
  { id: "logs", label: "Audit logs", icon: BookOpen, roles: ["ADMIN", "STAFF"] },
  { id: "profile", label: "My profile", icon: UserCircle, roles: ["CUSTOMER"] },
] as const;

const Metric = ({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Activity; tone: string }) => (
  <div className="card p-5">
    <div className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon size={19} /></div>
    <p className="mt-5 text-3xl font-black tracking-[-0.06em]">{value}</p>
    <p className="mt-1 text-sm font-semibold text-slate-500">{label}</p>
  </div>
);

const EquipmentTable = ({ equipment }: { equipment: Extinguisher[] }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full text-left text-sm">
      <thead><tr className="border-b border-sand text-xs uppercase tracking-wider text-slate-400">
        <th className="px-4 py-3">Serial / type</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Purchase</th><th className="px-4 py-3">Expiry</th><th className="px-4 py-3">Status</th>
      </tr></thead>
      <tbody>{equipment.map((item) => (
        <tr key={item.id} className="border-b border-sand/70 last:border-0 hover:bg-cream/70">
          <td className="px-4 py-4"><strong className="block text-ink">{item.serial_number}</strong><span className="text-xs text-slate-400">{item.extinguisher_type} - {item.capacity_kg}kg</span></td>
          <td className="px-4 py-4"><span className="block font-medium">{item.customer_name}</span><span className="text-xs text-slate-400">{item.customer_email}</span></td>
          <td className="whitespace-nowrap px-4 py-4 text-slate-500">{date(item.purchase_date)}</td>
          <td className="whitespace-nowrap px-4 py-4 font-semibold">{date(item.expiry_date)}</td>
          <td className="px-4 py-4"><Status value={item.status} /></td>
        </tr>
      ))}</tbody>
    </table>
    {!equipment.length && <Empty text="No extinguisher records found." />}
  </div>
);

const Empty = ({ text }: { text: string }) => <div className="px-4 py-14 text-center text-sm text-slate-400">{text}</div>;

export const DashboardPage = () => {
  const dispatch = useAppDispatch();
  const { logout, hasRole } = useAuth();
  const user = useAppSelector((state) => state.auth.user)!;
  const state = useAppSelector((store) => store.inventory);
  const [section, setSection] = useState<Section>("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [modal, setModal] = useState<"customer" | "extinguisher" | null>(null);
  const [search, setSearch] = useState("");
  const allowedNav = useMemo(() => nav.filter((item) => item.roles.includes(user.role as never)), [user.role]);

  useEffect(() => {
    dispatch(fetchSummary());
    dispatch(fetchNotifications());
    dispatch(fetchExtinguishers());
  }, [dispatch]);

  useEffect(() => {
    if (section === "customers") dispatch(fetchCustomers());
    if (section === "reports") dispatch(fetchReports());
    if (section === "logs") dispatch(fetchLogs());
    if (section === "notifications") dispatch(fetchNotifications());
    if (section === "extinguishers") dispatch(fetchExtinguishers());
  }, [dispatch, section]);

  useEffect(() => {
    if (modal === "extinguisher" && !state.customers.records.length) dispatch(fetchCustomers());
  }, [dispatch, modal, state.customers.records.length]);

  const chooseSection = (next: Section) => {
    setSection(next);
    setSearch("");
    setMobileNav(false);
    dispatch(clearFeedback());
  };

  const refresh = () => {
    dispatch(fetchSummary());
    if (section === "customers") dispatch(fetchCustomers({ search }));
    if (section === "extinguishers") dispatch(fetchExtinguishers({ search }));
    if (section === "notifications") dispatch(fetchNotifications());
    if (section === "reports") dispatch(fetchReports());
    if (section === "logs") dispatch(fetchLogs());
  };

  return (
    <div className="min-h-screen bg-cream">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-ink px-4 py-5 text-white transition-transform lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.18em] text-ember">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-ember text-white"><Flame size={20} /></span>
            SafeHub
          </div>
          <button onClick={() => setMobileNav(false)} className="lg:hidden"><X size={20} /></button>
        </div>
        <div className="mt-9 rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="truncate text-sm font-bold">{user.name}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.15em] text-ember">{title(user.role)}</p>
        </div>
        <nav className="mt-6 space-y-1">
          {allowedNav.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => chooseSection(id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${section === id ? "bg-white text-ink" : "text-white/60 hover:bg-white/10 hover:text-white"}`}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>
        <button onClick={logout} className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white/60 hover:bg-white/10 hover:text-white">
          <LogOut size={18} /> Sign out
        </button>
      </aside>
      {mobileNav && <button className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}

      <main className="lg:ml-72">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-sand bg-cream/90 px-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3">
            <button className="rounded-xl border border-sand bg-white p-2.5 lg:hidden" onClick={() => setMobileNav(true)}><Menu size={19} /></button>
            <div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-ember">SafeHub workspace</p><h1 className="text-xl font-black tracking-tight">{allowedNav.find((item) => item.id === section)?.label}</h1></div>
          </div>
          <button className="btn-secondary !px-3" onClick={refresh}><RefreshCcw size={16} className={state.loading ? "animate-spin" : ""} /><span className="hidden sm:inline">Refresh</span></button>
        </header>

        <div className="p-4 sm:p-7">
          {state.error && <div className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{state.error}</div>}
          {state.notice && <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{state.notice}</div>}

          {section === "dashboard" && <Overview />}
          {section === "extinguishers" && <Extinguishers search={search} setSearch={setSearch} openForm={() => setModal("extinguisher")} />}
          {section === "customers" && <Customers search={search} setSearch={setSearch} openForm={() => setModal("customer")} />}
          {section === "users" && <UserAccounts />}
          {section === "notifications" && <Notifications />}
          {section === "reports" && <Reports />}
          {section === "logs" && <Logs />}
          {section === "profile" && <ProfileForm />}
        </div>
      </main>

      {modal === "customer" && <Modal title="Register customer" onClose={() => setModal(null)}><CustomerForm onSaved={() => { setModal(null); dispatch(fetchCustomers()); dispatch(fetchSummary()); }} /></Modal>}
      {modal === "extinguisher" && <Modal title="Register extinguisher purchase" onClose={() => setModal(null)}><ExtinguisherForm customers={state.customers.records} onSaved={() => { setModal(null); dispatch(fetchExtinguishers()); dispatch(fetchSummary()); }} /></Modal>}
    </div>
  );

  function Overview() {
    const summary = state.summary;
    return <>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-black uppercase tracking-[0.16em] text-ember">Live compliance picture</p><h2 className="mt-2 text-3xl font-black tracking-[-0.05em]">Good {new Date().getHours() < 12 ? "morning" : "day"}, {user.name.split(" ")[0]}.</h2><p className="mt-2 text-sm text-slate-500">Here is the latest equipment and alert activity.</p></div>
        {hasRole("ADMIN", "STAFF") && <button className="btn-primary" onClick={() => dispatch(runExpiryScan()).then(() => { dispatch(fetchSummary()); dispatch(fetchNotifications()); })}><Activity size={17} /> Run expiry scan</button>}
      </div>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Registered extinguishers" value={summary?.extinguishers.total ?? 0} icon={Boxes} tone="bg-moss/10 text-moss" />
        <Metric label="Expiring within 30 days" value={summary?.extinguishers.expiring_soon ?? 0} icon={Activity} tone="bg-amber-50 text-amber-600" />
        <Metric label="Expired equipment" value={summary?.extinguishers.expired ?? 0} icon={ShieldAlert} tone="bg-red-50 text-red-600" />
        <Metric label="Unread notifications" value={summary?.unreadNotifications ?? 0} icon={Bell} tone="bg-blue-50 text-blue-600" />
      </div>
      <div className="mt-7 grid gap-5 xl:grid-cols-[1.6fr_0.8fr]">
        <section className="card overflow-hidden"><div className="flex items-center justify-between px-5 py-4"><div><h3 className="font-black">Upcoming expiry dates</h3><p className="mt-1 text-xs text-slate-400">Equipment requiring the closest attention</p></div><button onClick={() => chooseSection("extinguishers")} className="text-xs font-black uppercase tracking-wider text-moss">View all</button></div><EquipmentTable equipment={state.extinguishers.records.slice(0, 5)} /></section>
        <section className="rounded-2xl bg-forest p-5 text-white shadow-card"><ClipboardList className="text-ember" size={23} /><h3 className="mt-7 text-2xl font-black tracking-tight">Compliance summary</h3><p className="mt-2 text-sm leading-6 text-white/60">Keep expired units moving toward servicing or replacement. Ignored overdue reminders escalate automatically.</p><div className="mt-8 space-y-3 text-sm"><div className="flex justify-between border-b border-white/10 pb-3"><span className="text-white/60">Customers</span><strong>{summary?.customers ?? 0}</strong></div><div className="flex justify-between border-b border-white/10 pb-3"><span className="text-white/60">Active units</span><strong>{summary?.extinguishers.active ?? 0}</strong></div>{!hasRole("CUSTOMER") && <div className="flex justify-between"><span className="text-white/60">Open police reports</span><strong>{summary?.openPoliceReports ?? 0}</strong></div>}</div></section>
      </div>
    </>;
  }

  function Extinguishers({ search, setSearch, openForm }: { search: string; setSearch: (value: string) => void; openForm: () => void }) {
    return <section className="card overflow-hidden">
      <Toolbar title="Extinguisher register" description="Purchase, lifecycle, and expiry details for every unit." search={search} setSearch={setSearch} onSearch={() => dispatch(fetchExtinguishers({ search }))} action={hasRole("ADMIN", "STAFF") ? <button className="btn-primary" onClick={openForm}><Plus size={16} /> Add extinguisher</button> : undefined} />
      <EquipmentTable equipment={state.extinguishers.records} />
      <Pagination pagination={state.extinguishers.pagination} onPage={(page) => dispatch(fetchExtinguishers({ page, search }))} />
    </section>;
  }

  function Customers({ search, setSearch, openForm }: { search: string; setSearch: (value: string) => void; openForm: () => void }) {
    return <section className="card overflow-hidden">
      <Toolbar title="Customers" description="Contact details retained for reminders and compliance follow-up." search={search} setSearch={setSearch} onSearch={() => dispatch(fetchCustomers({ search }))} action={<button className="btn-primary" onClick={openForm}><Plus size={16} /> Add customer</button>} />
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-sand text-xs uppercase tracking-wider text-slate-400"><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Address</th><th className="px-4 py-3">Registered</th></tr></thead><tbody>{state.customers.records.map((customer) => <tr key={customer.id} className="border-b border-sand/70 last:border-0 hover:bg-cream/70"><td className="px-4 py-4"><strong>{customer.full_name}</strong><span className="block text-xs text-slate-400">{customer.company_name || "Individual customer"}</span></td><td className="px-4 py-4"><span className="block">{customer.email}</span><span className="text-xs text-slate-400">{customer.phone}</span></td><td className="max-w-xs px-4 py-4 text-slate-500">{customer.address}</td><td className="whitespace-nowrap px-4 py-4 text-slate-500">{date(customer.created_at)}</td></tr>)}</tbody></table>{!state.customers.records.length && <Empty text="No customers found." />}</div>
      <Pagination pagination={state.customers.pagination} onPage={(page) => dispatch(fetchCustomers({ page, search }))} />
    </section>;
  }

  function Notifications() {
    return <section className="card overflow-hidden"><div className="px-5 py-4"><h2 className="text-lg font-black">Notification center</h2><p className="mt-1 text-sm text-slate-400">Email and in-app expiry events are kept together.</p></div><div className="divide-y divide-sand">{state.notifications.records.map((item) => <div key={item.id} className={`flex gap-4 px-5 py-4 ${item.is_read ? "bg-white" : "bg-amber-50/40"}`}><div className={`mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.type === "POLICE_ESCALATION" || item.type === "EXPIRY_OVERDUE" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}><Bell size={17} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong>{item.title}</strong>{!item.is_read && <span className="rounded-full bg-ember px-2 py-0.5 text-[10px] font-black uppercase text-white">New</span>}</div><p className="mt-1 text-sm leading-6 text-slate-500">{item.message}</p><p className="mt-2 text-xs text-slate-400">{stamp(item.created_at)} {item.email_sent_at ? "- email processed" : ""}</p></div>{!item.is_read && <button onClick={() => dispatch(markNotificationRead(item.id))} className="self-center rounded-xl p-2 text-moss hover:bg-moss/10" title="Mark as read"><CheckCircle2 size={20} /></button>}</div>)}{!state.notifications.records.length && <Empty text="No notifications yet." />}</div><Pagination pagination={state.notifications.pagination} onPage={(page) => dispatch(fetchNotifications(page))} /></section>;
  }

  function Reports() {
    const updateStatus = async (id: string, status: string) => {
      await api.patch(`/inventory/reports/police/${id}`, { status });
      dispatch(fetchReports(state.reports.pagination.page));
      dispatch(fetchSummary());
    };
    return <section className="card overflow-hidden"><div className="px-5 py-4"><h2 className="text-lg font-black">Police escalation reports</h2><p className="mt-1 text-sm text-slate-400">Overdue equipment that remained unacknowledged after the configured grace period.</p></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-sand text-xs uppercase tracking-wider text-slate-400"><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Extinguisher</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Reported</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{state.reports.records.map((report) => <tr key={report.id} className="border-b border-sand/70 last:border-0"><td className="px-4 py-4"><strong>{report.customer_name}</strong><span className="block text-xs text-slate-400">{report.customer_email} - {report.phone}</span></td><td className="px-4 py-4"><strong>{report.serial_number}</strong><span className="block text-xs text-slate-400">Expired {date(report.expiry_date)}</span></td><td className="max-w-sm px-4 py-4 text-slate-500">{report.reason}</td><td className="whitespace-nowrap px-4 py-4 text-slate-500">{date(report.created_at)}</td><td className="px-4 py-4">{hasRole("ADMIN", "POLICE") ? <select className="rounded-lg border border-sand bg-white px-2 py-1.5 text-xs font-bold" value={report.status} onChange={(event) => updateStatus(report.id, event.target.value)}><option value="OPEN">Open</option><option value="REVIEWING">Reviewing</option><option value="CLOSED">Closed</option></select> : <Status value={report.status} />}</td></tr>)}</tbody></table>{!state.reports.records.length && <Empty text="No police escalations have been raised." />}</div><Pagination pagination={state.reports.pagination} onPage={(page) => dispatch(fetchReports(page))} /></section>;
  }

  function Logs() {
    return <section className="card overflow-hidden"><div className="px-5 py-4"><h2 className="text-lg font-black">Audit trail</h2><p className="mt-1 text-sm text-slate-400">A chronological record of important system activity.</p></div><div className="divide-y divide-sand">{state.logs.records.map((log) => <div key={log.id} className="grid gap-1 px-5 py-4 sm:grid-cols-[1fr_auto]"><div><p className="text-sm font-bold">{title(log.action)}</p><p className="mt-1 text-xs text-slate-400">{title(log.entity_type)} {log.entity_id ? `- ${log.entity_id}` : ""}</p></div><div className="text-xs text-slate-400 sm:text-right"><p>{stamp(log.created_at)}</p><p className="mt-1 font-bold uppercase tracking-wide text-moss">{log.actor_role ?? "SYSTEM"}</p></div></div>)}{!state.logs.records.length && <Empty text="No audit activity recorded yet." />}</div><Pagination pagination={state.logs.pagination} onPage={(page) => dispatch(fetchLogs(page))} /></section>;
  }
};

const Toolbar = ({ title: heading, description, search, setSearch, onSearch, action }: { title: string; description: string; search: string; setSearch: (value: string) => void; onSearch: () => void; action?: React.ReactNode }) => (
  <div className="flex flex-col gap-4 border-b border-sand px-5 py-4 xl:flex-row xl:items-center xl:justify-between"><div><h2 className="text-lg font-black">{heading}</h2><p className="mt-1 text-sm text-slate-400">{description}</p></div><div className="flex flex-col gap-2 sm:flex-row"><label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input className="field !pl-9 sm:w-64" placeholder="Search records..." value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onSearch()} /></label>{action}</div></div>
);

interface ManagedUser extends User {
  is_active: boolean;
  created_at: string;
}

const UserAccounts = () => {
  const [records, setRecords] = useState<ManagedUser[]>([]);
  const [pagination, setPagination] = useState<PaginationType>({ page: 1, limit: 10, total: 0, pages: 0 });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "STAFF" as Role });

  const load = async (page = 1) => {
    try {
      const { data } = await api.get("/auth/users", { params: { page } });
      setRecords(data.records);
      setPagination(data.pagination);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await api.post("/auth/users", form);
      setShowForm(false);
      setForm({ name: "", email: "", password: "", role: "STAFF" });
      load();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  return <>
    {error && <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
    <section className="card overflow-hidden">
      <div className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
        <div><h2 className="text-lg font-black">User accounts</h2><p className="mt-1 text-sm text-slate-400">Create controlled access for staff, police, and administrators.</p></div>
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Add user</button>
      </div>
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-sand text-xs uppercase tracking-wider text-slate-400"><th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">State</th><th className="px-4 py-3">Created</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-b border-sand/70 last:border-0"><td className="px-4 py-4"><strong>{record.name}</strong><span className="block text-xs text-slate-400">{record.email}</span></td><td className="px-4 py-4"><Status value={record.role} /></td><td className="px-4 py-4 text-xs font-black uppercase tracking-wider text-moss">{record.is_active ? "Active" : "Disabled"}</td><td className="whitespace-nowrap px-4 py-4 text-slate-500">{date(record.created_at)}</td></tr>)}</tbody></table></div>
      <Pagination pagination={pagination} onPage={load} />
    </section>
    {showForm && <Modal title="Create user account" onClose={() => setShowForm(false)}><form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
      <label><span className="label">Full name</span><input className="field" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label><span className="label">Email address</span><input className="field" required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label><span className="label">Temporary password</span><input className="field" required type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
      <label><span className="label">Role</span><select className="field" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}><option value="STAFF">Staff</option><option value="POLICE">Police</option><option value="ADMIN">Administrator</option><option value="CUSTOMER">Customer</option></select></label>
      <button className="btn-primary sm:col-span-2"><UserCog size={16} /> Create user account</button>
    </form></Modal>}
  </>;
};
