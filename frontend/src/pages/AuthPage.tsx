import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Flame, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { clearAuthError, login, signup } from "../store/authSlice";

export const AuthPage = ({ mode }: { mode: "login" | "signup" }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { loading, error } = useAppSelector((state) => state.auth);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const isSignup = mode === "signup";

  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch, mode]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const action = isSignup
      ? await dispatch(signup(form))
      : await dispatch(login({ email: form.email, password: form.password }));
    if ((isSignup ? signup : login).fulfilled.match(action)) navigate("/");
  };

  return (
    <main className="min-h-screen bg-forest p-3 sm:p-5">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-7xl overflow-hidden rounded-[2rem] bg-cream shadow-2xl sm:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full border-[38px] border-ember/15" />
          <div className="absolute -bottom-28 -left-24 h-96 w-96 rounded-full border-[46px] border-moss/30" />
          <div className="relative">
            <div className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.2em] text-ember">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ember text-white">
                <Flame size={22} />
              </span>
              SafeHub
            </div>
            <h1 className="mt-20 max-w-xl text-6xl font-black leading-[0.98] tracking-[-0.055em]">
              Compliance you can see coming.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-white/65">
              Track every extinguisher from purchase to replacement, notify customers early, and preserve a clear compliance record.
            </p>
          </div>
          <div className="relative grid grid-cols-3 gap-3">
            {["Expiry monitoring", "Email alerts", "Police escalation"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-white/80">
                <CheckCircle2 className="mb-5 text-ember" size={20} />
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-12">
          <div className="w-full max-w-md">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ember text-white"><Flame size={22} /></span>
              <span className="font-black uppercase tracking-[0.2em] text-forest">SafeHub</span>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-moss/10 text-moss">
              <ShieldCheck size={25} />
            </div>
            <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-ember">
              {isSignup ? "Customer registration" : "Secure access"}
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.04em] text-ink">
              {isSignup ? "Create your portal account" : "Welcome back"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              {isSignup
                ? "Register to view your equipment and receive compliance reminders."
                : "Sign in to continue to your fire safety workspace."}
            </p>

            <form onSubmit={submit} className="mt-8 space-y-4">
              {isSignup && (
                <div>
                  <label className="label" htmlFor="name">Full name</label>
                  <input id="name" className="field" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                </div>
              )}
              <div>
                <label className="label" htmlFor="email">Email address</label>
                <input id="email" type="email" className="field" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="password">Password</label>
                <input id="password" type="password" className="field" required minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
                {isSignup && <p className="mt-2 text-xs text-slate-400">Use uppercase, lowercase, and a number.</p>}
              </div>
              {error && <div className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">{error}</div>}
              <button className="btn-primary mt-2 w-full" disabled={loading}>
                {loading ? "Please wait..." : isSignup ? "Create account" : "Sign in"}
                {!loading && <ArrowRight size={17} />}
              </button>
            </form>
            <p className="mt-7 text-center text-sm text-slate-500">
              {isSignup ? "Already registered?" : "New customer?"}{" "}
              <Link className="font-bold text-moss hover:text-forest" to={isSignup ? "/login" : "/signup"}>
                {isSignup ? "Sign in" : "Create an account"}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
};

