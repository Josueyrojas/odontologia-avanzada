"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, CalendarClock, Cloud, CloudOff, Loader2, Menu, Moon, Search, Sun, Wallet } from "lucide-react";
import { useStore, patientBalance } from "@/lib/store";
import { fmtLong, fmtQty, initials, mxn, nowTime, toMin, today } from "@/lib/format";
import { Avatar } from "./ui";

function useClickOutside(ref: React.RefObject<HTMLElement>, cb: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && cb();
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, cb]);
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch { /* sin almacenamiento */ }
    setDark(next);
  };
  return (
    <button onClick={toggle} className="btn-outline px-3" aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"} title={dark ? "Modo claro" : "Modo oscuro"}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

export default function Topbar({ onMenu }: { onMenu: () => void }) {
  const { db, mode, sync, profile, role, reload } = useStore();
  const userName = profile?.nombre ?? db.settings.doctorName;
  const userRole = profile ? (profile.rol === "doctor" ? "Doctor" : "Recepción") : db.settings.specialty;
  const router = useRouter();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [bell, setBell] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  useClickOutside(searchRef, () => setFocus(false));
  useClickOutside(bellRef, () => setBell(false));

  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const results = q.trim()
    ? db.patients.filter((p) => norm(p.name).includes(norm(q)) || p.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "") || "~")).slice(0, 6)
    : [];

  const t = today();
  const now = toMin(nowTime());
  const upcoming = db.appointments
    .filter((a) => a.date === t && ["pendiente", "confirmada", "urgencia"].includes(a.status) && toMin(a.start) >= now - 15)
    .sort((a, b) => a.start.localeCompare(b.start)).slice(0, 3);
  const lowStock = db.materials.filter((m) => m.stock < m.alertLevel);
  const debtors = db.patients.map((p) => ({ p, owed: patientBalance(db, p.id) })).filter((x) => x.owed > 0).slice(0, 3);
  const notifCount = upcoming.length + lowStock.length + debtors.length;

  const go = (id: string) => { setQ(""); setFocus(false); router.push(`/pacientes/${id}`); };

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/85 px-4 py-3 backdrop-blur md:px-8 print:hidden">
      <button onClick={onMenu} className="icon-btn md:hidden" aria-label="Abrir menú"><Menu size={20} /></button>

      <div ref={searchRef} className="relative max-w-md flex-1">
        <label>
          <span className="sr-only">Buscar paciente</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input className="input bg-bg pl-9" placeholder="Buscar paciente por nombre o teléfono…" value={q}
            onChange={(e) => setQ(e.target.value)} onFocus={() => setFocus(true)}
            onKeyDown={(e) => { if (e.key === "Enter" && results[0]) go(results[0].id); if (e.key === "Escape") setFocus(false); }} />
        </label>
        {focus && q.trim() && (
          <div className="absolute inset-x-0 top-full mt-2 animate-pop overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
            {results.length ? results.map((p) => (
              <button key={p.id} onClick={() => go(p.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-bg">
                <Avatar name={p.name} size={32} />
                <span className="flex-1"><span className="block text-sm font-bold">{p.name}</span><span className="text-xs text-muted">{p.phone}</span></span>
              </button>
            )) : (
              <div className="p-4 text-sm text-muted">Sin resultados. <Link href="/pacientes?nuevo=1" className="font-bold text-brand" onClick={() => setFocus(false)}>Registrar paciente</Link></div>
            )}
          </div>
        )}
      </div>

      <p className="ml-auto hidden text-sm font-semibold capitalize text-muted lg:block">{fmtLong(t)}</p>

      {mode === "cloud" && (
        sync === "offline"
          ? <span className="badge bg-[#FDF1D8] py-2 text-[#855A06]" title="Los cambios se guardan en este equipo y se envían al volver la conexión"><CloudOff size={14} /> Sin conexión · cambios en espera</span>
          : sync === "error"
            ? <button onClick={reload} className="badge bg-[#FBE3E0] py-2 text-[#9E2A20]" title="Se reintenta automáticamente. Clic para recargar desde la nube"><Loader2 size={14} className="animate-spin" /> Reintentando guardar…</button>
            : <span className="hidden items-center gap-1.5 text-xs font-semibold text-muted md:flex" aria-live="polite">
                {sync === "saving" ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : <><Cloud size={14} className="text-brand" /> Guardado</>}
              </span>
      )}
      <ThemeToggle />
      <div ref={bellRef} className="relative">
        <button aria-label={`Notificaciones (${notifCount})`} className="btn-outline relative px-3" onClick={() => setBell(!bell)}>
          <Bell size={18} />
          {notifCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{notifCount}</span>}
        </button>
        {bell && (
          <div className="absolute right-0 top-full mt-2 w-80 animate-pop overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
            <p className="border-b border-line px-4 py-3 text-sm font-extrabold">Notificaciones</p>
            <div className="max-h-96 overflow-y-auto">
              {!notifCount && <p className="p-4 text-sm text-muted">Todo en orden por ahora ✨</p>}
              {upcoming.map((a) => (
                <Link key={a.id} href="/agenda" onClick={() => setBell(false)} className="flex gap-3 px-4 py-3 hover:bg-bg">
                  <CalendarClock size={18} className="mt-0.5 shrink-0 text-[#3A7BD5]" />
                  <span className="text-sm"><b>{a.start}</b> · {db.patients.find((p) => p.id === a.patientId)?.name}<span className="block text-xs text-muted">{a.treatment}</span></span>
                </Link>
              ))}
              {lowStock.map((m) => (
                <Link key={m.id} href="/inventario" onClick={() => setBell(false)} className="flex gap-3 px-4 py-3 hover:bg-bg">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
                  <span className="text-sm"><b>Stock bajo:</b> {m.name}<span className="block text-xs text-muted">Quedan {fmtQty(m.stock)} {m.unit} (mínimo {m.alertLevel})</span></span>
                </Link>
              ))}
              {debtors.map(({ p, owed }) => (
                <Link key={p.id} href={`/pacientes/${p.id}`} onClick={() => setBell(false)} className="flex gap-3 px-4 py-3 hover:bg-bg">
                  <Wallet size={18} className="mt-0.5 shrink-0 text-cost" />
                  <span className="text-sm"><b>Saldo pendiente:</b> {p.name}<span className="block text-xs text-muted">{mxn(owed)} por cobrar</span></span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <Link href={role === "recepcion" ? "/" : "/configuracion"} className="hidden items-center gap-3 rounded-xl px-2 py-1 hover:bg-bg sm:flex">
        <div className="text-right text-sm">
          <div className="font-bold">{userName}</div>
          <div className="text-xs text-muted">{userRole}</div>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-full bg-navy text-sm font-bold text-white">{initials(userName.replace(/^Dr[a]?\.\s*/, ""))}</div>
      </Link>
    </header>
  );
}
