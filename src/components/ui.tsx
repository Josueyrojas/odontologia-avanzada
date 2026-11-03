"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X, type LucideIcon } from "lucide-react";
import { initials } from "@/lib/format";

/* ---------------- Modal ---------------- */
export function Modal({ open, onClose, title, subtitle, children, footer, size = "md", printable }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string;
  children: React.ReactNode; footer?: React.ReactNode; size?: "sm" | "md" | "lg";
  /** Al imprimir se imprime solo el contenido del modal. */
  printable?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    if (printable) document.body.classList.add("printing-modal");
    ref.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; document.body.classList.remove("printing-modal"); };
  }, [open, onClose, printable]);
  if (!open) return null;
  const w = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-3xl" : "max-w-xl";
  return createPortal(
    <div className={`fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 ${printable ? "print-root print:static print:block print:p-0" : "print:hidden"}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade bg-navy/50 backdrop-blur-[2px] print:hidden" onClick={onClose} />
      <div ref={ref} className={`relative flex max-h-[92vh] w-full ${w} animate-pop flex-col rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl print:max-h-none print:max-w-none print:animate-none print:shadow-none`}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 className="text-lg font-extrabold">{title}</h2>
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-bg print:hidden"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-6 py-5 print:overflow-visible">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4 print:hidden">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- Toasts + confirmación ---------------- */
type ToastKind = "success" | "error" | "info";
interface Toast { id: number; kind: ToastKind; text: string; }
interface Confirm { title: string; text: string; danger?: boolean; confirmLabel?: string; resolve: (ok: boolean) => void; }
const UICtx = createContext<{ toast: (text: string, kind?: ToastKind) => void; confirm: (o: Omit<Confirm, "resolve">) => Promise<boolean> } | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dlg, setDlg] = useState<Confirm | null>(null);
  const toast = useCallback((text: string, kind: ToastKind = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const confirm = useCallback((o: Omit<Confirm, "resolve">) => new Promise<boolean>((resolve) => setDlg({ ...o, resolve })), []);
  const close = (ok: boolean) => { dlg?.resolve(ok); setDlg(null); };
  const icons: Record<ToastKind, LucideIcon> = { success: CheckCircle2, error: AlertTriangle, info: Info };
  const tone: Record<ToastKind, string> = { success: "text-[#4BD69B]", error: "text-[#FF8A7E]", info: "text-[#8CB8F2]" };

  return (
    <UICtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2 print:hidden" aria-live="polite">
        {toasts.map((t) => { const Icon = icons[t.kind]; return (
          <div key={t.id} className="pointer-events-auto flex min-w-[260px] max-w-sm animate-slide items-center gap-3 rounded-2xl bg-navy px-4 py-3 text-sm font-semibold text-white shadow-xl">
            <Icon size={18} className={tone[t.kind]} />
            {t.text}
          </div>
        ); })}
      </div>
      <Modal open={!!dlg} onClose={() => close(false)} title={dlg?.title ?? ""} size="sm"
        footer={<>
          <button className="btn-outline" onClick={() => close(false)}>Cancelar</button>
          <button className={dlg?.danger ? "btn-danger" : "btn-primary"} onClick={() => close(true)}>{dlg?.confirmLabel ?? "Confirmar"}</button>
        </>}>
        <p className="text-sm text-ink-soft">{dlg?.text}</p>
      </Modal>
    </UICtx.Provider>
  );
}
export const useUI = () => {
  const c = useContext(UICtx);
  if (!c) throw new Error("useUI debe usarse dentro de <UIProvider>");
  return c;
};

/* ---------------- Piezas visuales ---------------- */
const avatarColors = ["#0F2A44", "#12A36A", "#3A7BD5", "#E8893A", "#7B61FF", "#D9483B", "#0A6B46", "#163A5C"];
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const c = avatarColors[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % avatarColors.length];
  return (
    <div className="grid shrink-0 place-items-center rounded-full font-bold text-white" style={{ width: size, height: size, background: c, fontSize: size * 0.36 }} aria-hidden="true">
      {initials(name)}
    </div>
  );
}

export function StatCard({ label, value, note, icon: Icon, tone = "white", trend }: {
  label: string; value: string; note?: string; icon?: LucideIcon; tone?: "white" | "navy" | "green" | "amber" | "red"; trend?: number;
}) {
  const tones = {
    white: "card", navy: "rounded-2xl p-5 bg-gradient-to-br from-navy to-navy-700 text-white",
    green: "rounded-2xl p-5 bg-brand-soft text-brand-dark", amber: "rounded-2xl p-5 bg-[#FDF1D8] text-[#855A06]", red: "rounded-2xl p-5 bg-[#FBE3E0] text-[#9E2A20]",
  };
  return (
    <div className={`${tones[tone]} ${tone === "white" ? "!p-5" : ""} relative overflow-hidden`}>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-semibold ${tone === "navy" ? "text-[#B8C9DA]" : tone === "white" ? "text-muted" : ""}`}>{label}</p>
        {Icon && <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone === "navy" ? "bg-white/10" : tone === "white" ? "bg-bg text-navy" : "bg-white/60 dark:bg-white/10"}`}><Icon size={18} /></span>}
      </div>
      <p className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl">{value}</p>
      {(note || trend !== undefined) && (
        <p className="mt-1 flex items-center gap-2 text-xs opacity-80">
          {trend !== undefined && Number.isFinite(trend) && (
            <span className={`rounded-full px-1.5 py-0.5 font-bold ${trend >= 0 ? "bg-[#4BD69B]/20" : "bg-[#FF8A7E]/25"}`}>{trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%</span>
          )}
          {note}
        </p>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-bg text-navy-300"><Icon size={26} /></span>
      <p className="font-bold">{title}</p>
      {text && <p className="max-w-xs text-sm text-muted">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-2xl bg-surface p-1.5 shadow-[0_1px_3px_rgba(15,42,68,.08)]" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${value === t.id ? "bg-navy text-white" : "text-ink-soft hover:bg-bg"}`}>
          {t.label}
          {t.count !== undefined && <span className={`rounded-full px-1.5 text-xs ${value === t.id ? "bg-white/20" : "bg-bg"}`}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block">
      <span className="sr-only">{placeholder}</span>
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
      <input className="input pl-9" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
