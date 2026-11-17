"use client";
// Panel de administración de Odonty: licencias de todas las clínicas.
// Solo muestra datos de la clínica y conteos; nunca expedientes de pacientes.
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, CalendarClock, CheckCircle2, Clock, LogOut, PauseCircle, Pencil, RefreshCw, ShieldCheck } from "lucide-react";
import { adminClinics, adminUpdateClinic, license, planLabel, type AdminClinic, type LicensePlan, type LicenseState } from "@/lib/cloud";
import { fmtDate, toISODate, today } from "@/lib/format";
import { EmptyState, Modal, SearchInput, StatCard, useUI } from "./ui";
import { Logo } from "./Logo";

type Filter = "todas" | "pendiente" | "por_vencer" | "activa" | "inactiva";
const stateBadge = {
  activa: ["Activa", "bg-brand-soft text-brand-dark"],
  por_vencer: ["Por vencer", "bg-[#FDF1D8] text-[#855A06]"],
  gracia: ["En gracia", "bg-[#FDF1D8] text-[#855A06]"],
  vencida: ["Vencida", "bg-[#FBE3E0] text-[#9E2A20]"],
  pendiente: ["Pendiente", "bg-[#E6EEF8] text-[#22508F]"],
  suspendida: ["Suspendida", "bg-[#FBE3E0] text-[#9E2A20]"],
} as const;

const addMonths = (from: string, n: number) => {
  const [y, m, d] = from.split("-").map(Number);
  const dt = new Date(y, m - 1 + n, d);
  return toISODate(dt);
};
const ago = (iso: string | null) => {
  if (!iso) return "Sin actividad";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return days <= 0 ? "Hoy" : days === 1 ? "Ayer" : `Hace ${days} días`;
};

export default function AdminPanel({ standalone, onSignOut, onBack }: { standalone?: boolean; onSignOut?: () => void; onBack?: () => void }) {
  const { toast } = useUI();
  const [rows, setRows] = useState<AdminClinic[] | null>(null);
  const [filter, setFilter] = useState<Filter>("todas");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<AdminClinic | null>(null);

  const load = useCallback(() => {
    adminClinics().then(setRows).catch((e) => { setRows([]); toast(e instanceof Error ? e.message : String(e), "error"); });
  }, [toast]);
  useEffect(load, [load]);

  const withLic = useMemo(() => (rows ?? []).map((c) => ({ c, lic: license(c) })), [rows]);
  const count = (f: Filter) => withLic.filter(({ lic }) => match(f, lic.state)).length;
  const list = withLic.filter(({ c, lic }) =>
    match(filter, lic.state) && (!q || `${c.nombre} ${c.doctor ?? ""} ${c.email ?? ""} ${c.codigo}`.toLowerCase().includes(q.toLowerCase())));

  const body = (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-muted">Administración de licencias</p>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Panel Odonty</h1>
        </div>
        <button className="btn-outline" onClick={load}><RefreshCw size={18} /> Actualizar</button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Clínicas" value={String(rows?.length ?? "–")} icon={Building2} tone="navy" note={`${count("activa")} activas`} />
        <StatCard label="Pendientes de activar" value={String(count("pendiente"))} icon={Clock} tone={count("pendiente") ? "amber" : "white"} />
        <StatCard label="Por vencer (7 días)" value={String(count("por_vencer"))} icon={CalendarClock} tone={count("por_vencer") ? "amber" : "white"} />
        <StatCard label="Suspendidas o vencidas" value={String(count("inactiva"))} icon={PauseCircle} tone={count("inactiva") ? "red" : "white"} />
      </div>

      <section className="card">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] flex-1"><SearchInput value={q} onChange={setQ} placeholder="Buscar clínica, doctor, correo o código…" /></div>
          <div className="flex flex-wrap gap-1.5">
            {([["todas", "Todas"], ["pendiente", "Pendientes"], ["por_vencer", "Por vencer"], ["activa", "Activas"], ["inactiva", "Suspendidas / vencidas"]] as [Filter, string][]).map(([f, l]) => (
              <button key={f} onClick={() => setFilter(f)} className={`badge border px-3 py-2 ${filter === f ? "border-navy bg-navy text-white" : "border-line bg-surface text-ink-soft"}`}>{l} <span className="opacity-70">{count(f)}</span></button>
            ))}
          </div>
        </div>
        {rows === null ? <p className="py-10 text-center text-sm text-muted">Cargando clínicas…</p> : list.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead><tr><th className="th">Clínica</th><th className="th">Doctor</th><th className="th text-right">Usuarios</th><th className="th text-right">Pacientes</th><th className="th">Actividad</th><th className="th">Plan</th><th className="th">Licencia</th><th className="th" /></tr></thead>
              <tbody>{list.map(({ c, lic }) => {
                const [label, cls] = stateBadge[lic.state];
                return (
                  <tr key={c.id} className="row-hover">
                    <td className="td"><p className="font-bold">{c.nombre}</p><p className="text-xs text-muted">Código {c.codigo} · alta {fmtDate(c.created_at.slice(0, 10), { day: "numeric", month: "short", year: "numeric" })}</p></td>
                    <td className="td"><p className="font-semibold">{c.doctor ?? "—"}</p><p className="text-xs text-muted">{c.email}</p></td>
                    <td className="td text-right">{c.usuarios}</td>
                    <td className="td text-right">{c.pacientes}</td>
                    <td className="td text-muted">{ago(c.ultima_actividad)}</td>
                    <td className="td">{planLabel[c.plan]}</td>
                    <td className="td">
                      <span className={`badge ${cls}`}>{label}</span>
                      <p className="mt-1 text-xs text-muted">{c.vence_el ? `Vence ${fmtDate(c.vence_el, { day: "numeric", month: "short", year: "numeric" })}` : "Sin vencimiento"}</p>
                    </td>
                    <td className="td text-right">
                      {c.estado === "pendiente"
                        ? <button className="btn-primary btn-sm" onClick={() => setEdit({ ...c, estado: "activa", vence_el: c.vence_el ?? addMonths(today(), 1) })}><CheckCircle2 size={14} /> Activar</button>
                        : <button className="btn-outline btn-sm" onClick={() => setEdit(c)}><Pencil size={14} /> Editar</button>}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ) : <EmptyState icon={ShieldCheck} title="Sin clínicas en esta vista" />}
      </section>

      <EditLicense clinic={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />
    </>
  );

  if (!standalone) return body;
  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 md:px-8">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#2BC487] to-[#0A6B46]"><Logo size={20} /></div>
        <p className="flex-1 text-lg font-extrabold">Odon<span className="text-brand">ty</span> <span className="text-sm font-semibold text-muted">· Administración</span></p>
        {onBack && <button className="btn-outline" onClick={onBack}><ArrowLeft size={16} /> Mi clínica</button>}
        {onSignOut && <button className="btn-ghost text-muted" onClick={onSignOut}><LogOut size={16} /> Salir</button>}
      </header>
      <main className="p-4 md:p-8">{body}</main>
    </div>
  );
}

function match(f: Filter, s: keyof typeof stateBadge) {
  if (f === "todas") return true;
  if (f === "por_vencer") return s === "por_vencer" || s === "gracia";
  if (f === "inactiva") return s === "suspendida" || s === "vencida";
  if (f === "activa") return s === "activa" || s === "por_vencer" || s === "gracia";
  return s === f;
}

function EditLicense({ clinic, onClose, onSaved }: { clinic: AdminClinic | null; onClose: () => void; onSaved: () => void }) {
  const { toast, confirm } = useUI();
  const [f, setF] = useState<AdminClinic | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setF(clinic), [clinic]);
  if (!f) return null;
  // Las extensiones se suman al vencimiento actual si sigue vigente; si no, desde hoy
  const base = f.vence_el && f.vence_el > today() ? f.vence_el : today();

  const save = async () => {
    if (f.estado === "suspendida" && clinic?.estado !== "suspendida" &&
      !(await confirm({ title: "Suspender clínica", text: `${f.nombre} perderá el acceso de inmediato. Sus datos se conservan y vuelven a estar disponibles al reactivarla.`, danger: true, confirmLabel: "Suspender" }))) return;
    setBusy(true);
    try {
      await adminUpdateClinic(f);
      toast(`${f.nombre}: licencia actualizada`);
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={f.nombre} subtitle={`${f.doctor ?? "Sin doctor"} · ${f.email ?? ""}`}
      footer={<><button className="btn-outline" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy} onClick={save}>{busy ? "Guardando…" : "Guardar licencia"}</button></>}>
      <div className="flex flex-col gap-4">
        <div className="label">Estado
          <div className="grid grid-cols-3 gap-2">
            {(["pendiente", "activa", "suspendida"] as LicenseState[]).map((s) => (
              <button key={s} type="button" onClick={() => setF({ ...f, estado: s })}
                className={`btn border capitalize ${f.estado === s ? (s === "suspendida" ? "border-danger bg-[#FBE3E0] text-[#9E2A20]" : "border-brand bg-brand-soft text-brand-dark") : "border-line bg-surface"}`}>{s}</button>
            ))}
          </div>
        </div>
        <label className="label">Plan
          <select className="input" value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value as LicensePlan })}>
            {(Object.keys(planLabel) as LicensePlan[]).map((p) => <option key={p} value={p}>{planLabel[p]}</option>)}
          </select>
        </label>
        <div className="label">Vence el
          <input type="date" className="input" value={f.vence_el ?? ""} onChange={(e) => setF({ ...f, vence_el: e.target.value || null })} />
          <div className="flex flex-wrap gap-1.5">
            {([["+1 mes", 1], ["+3 meses", 3], ["+6 meses", 6], ["+1 año", 12]] as [string, number][]).map(([l, n]) => (
              <button key={l} type="button" className="btn btn-sm border border-line bg-surface hover:bg-bg" onClick={() => setF({ ...f, vence_el: addMonths(base, n) })}>{l}</button>
            ))}
            <button type="button" className="btn btn-sm border border-line bg-surface hover:bg-bg" onClick={() => setF({ ...f, vence_el: null })}>Sin vencimiento</button>
          </div>
          <span className="text-xs font-normal text-muted">Tras vencer tiene 5 días de gracia; después se bloquea el acceso (los datos se conservan).</span>
        </div>
        <label className="label">Notas internas<textarea className="input min-h-[70px]" value={f.notas ?? ""} onChange={(e) => setF({ ...f, notas: e.target.value })} placeholder="Ej. Enganche pagado 10/11, mensualidad día 10…" /></label>
      </div>
    </Modal>
  );
}
