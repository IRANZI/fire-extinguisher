import { X } from "lucide-react";
import type { PropsWithChildren } from "react";

export const Modal = ({ title, onClose, children }: PropsWithChildren<{ title: string; onClose: () => void }>) => (
  <div className="fixed inset-0 z-50 grid place-items-center bg-ink/55 p-4 backdrop-blur-sm">
    <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-cream shadow-2xl">
      <header className="sticky top-0 flex items-center justify-between border-b border-sand bg-cream/95 px-5 py-4 backdrop-blur">
        <h2 className="text-xl font-black tracking-tight">{title}</h2>
        <button className="rounded-xl p-2 text-slate-500 hover:bg-sand" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
      </header>
      <div className="p-5">{children}</div>
    </section>
  </div>
);

