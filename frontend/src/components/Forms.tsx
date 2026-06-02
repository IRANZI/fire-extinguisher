import { useEffect, useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import { api, getErrorMessage } from "../lib/api";
import type { Customer } from "../types";

const Field = ({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <label>
    <span className="label">{label}</span>
    <input className="field" {...props} />
  </label>
);

export const CustomerForm = ({ customer, onSaved }: { customer?: Customer; onSaved: () => void }) => {
  const [form, setForm] = useState({
    fullName: customer?.full_name ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    address: customer?.address ?? "",
    nationalId: customer?.national_id ?? "",
    companyName: customer?.company_name ?? "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (customer) await api.patch(`/inventory/customers/${customer.id}`, form);
      else await api.post("/inventory/customers", form);
      onSaved();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
      <Field label="Full name" required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
      <Field label="Email address" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
      <Field label="Phone number" required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
      <Field label="National ID" value={form.nationalId} onChange={(event) => setForm({ ...form, nationalId: event.target.value })} />
      <Field label="Company name" value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} />
      <Field label="Address" required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</div>}
      <button className="btn-primary sm:col-span-2" disabled={saving}><Save size={16} /> {saving ? "Saving..." : customer ? "Update customer" : "Register customer"}</button>
    </form>
  );
};

export const ExtinguisherForm = ({
  customers,
  onSaved,
}: {
  customers: Customer[];
  onSaved: () => void;
}) => {
  const [form, setForm] = useState({
    customerId: customers[0]?.id ?? "",
    serialNumber: "",
    extinguisherType: "ABC Dry Chemical",
    capacityKg: "6",
    manufacturer: "",
    purchaseDate: "",
    expiryDate: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/inventory/extinguishers", form);
      onSaved();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
      <label className="sm:col-span-2">
        <span className="label">Customer</span>
        <select className="field" required value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })}>
          <option value="">Select a customer</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name} · {customer.email}</option>)}
        </select>
      </label>
      <Field label="Serial number" required value={form.serialNumber} onChange={(event) => setForm({ ...form, serialNumber: event.target.value })} />
      <Field label="Type" required value={form.extinguisherType} onChange={(event) => setForm({ ...form, extinguisherType: event.target.value })} />
      <Field label="Capacity (kg)" type="number" min="0.1" step="0.1" required value={form.capacityKg} onChange={(event) => setForm({ ...form, capacityKg: event.target.value })} />
      <Field label="Manufacturer" value={form.manufacturer} onChange={(event) => setForm({ ...form, manufacturer: event.target.value })} />
      <Field label="Purchase date" type="date" required value={form.purchaseDate} onChange={(event) => setForm({ ...form, purchaseDate: event.target.value })} />
      <Field label="Expiry date" type="date" required value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} />
      <label className="sm:col-span-2">
        <span className="label">Notes</span>
        <textarea className="field min-h-24" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
      </label>
      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</div>}
      <button className="btn-primary sm:col-span-2" disabled={saving}><Save size={16} /> {saving ? "Saving..." : "Register extinguisher"}</button>
    </form>
  );
};

export const ProfileForm = () => {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    nationalId: "",
    companyName: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/inventory/customers/self").then(({ data }) => {
      const customer = data.customer as Customer | null;
      if (customer) {
        setForm({
          fullName: customer.full_name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          nationalId: customer.national_id ?? "",
          companyName: customer.company_name ?? "",
        });
      }
    }).catch((requestError) => setError(getErrorMessage(requestError)));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.put("/inventory/customers/self", form);
      setMessage("Your contact profile has been saved.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  return (
    <section className="card max-w-3xl p-5 sm:p-7">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-ember">Customer profile</p>
      <h2 className="mt-2 text-2xl font-black tracking-tight">Keep your contact details current</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">These details are used for expiry reminders and servicing follow-up.</p>
      <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <Field label="Full name" required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
        <Field label="Email address" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <Field label="Phone number" required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <Field label="National ID" value={form.nationalId} onChange={(event) => setForm({ ...form, nationalId: event.target.value })} />
        <Field label="Company name" value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} />
        <Field label="Address" required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
        {message && <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 sm:col-span-2">{message}</div>}
        {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</div>}
        <button className="btn-primary sm:col-span-2"><Save size={16} /> Save contact profile</button>
      </form>
    </section>
  );
};
