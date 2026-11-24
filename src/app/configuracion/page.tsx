"use client";
import { useEffect, useRef, useState } from "react";
import { Building2, Clock, Copy, Database, Download, Pencil, Plus, RefreshCw, RotateCcw, Save, Stethoscope, Trash2, Upload, UserMinus, Users } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Avatar, Modal, Tabs, useUI } from "@/components/ui";
import { professionalsOf, useCollection, useStore } from "@/lib/store";
import { fmtDate, mxn, today, uid } from "@/lib/format";
import type { DB, Procedure, ProcedureMaterial, Professional, Settings } from "@/lib/types";
import { listTeam, loadAudit, removeMember, renewCode, setRole, type AuditEntry, type Profile } from "@/lib/cloud";
import type { DB as DBType } from "@/lib/types";

type Tab = "clinica" | "tratamientos" | "equipo" | "bitacora" | "datos";

export default function ConfiguracionPage() {
  const { db, update, reset, replace, mode } = useStore();
  const procedures = useCollection("procedures");
  const { toast, confirm } = useUI();
  const [tab, setTab] = useState<Tab>("clinica");
  const [s, setS] = useState<Settings>(db.settings);
  const [proc, setProc] = useState<Procedure | null | undefined>(undefined);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => setS(db.settings), [db.settings]);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => ({ ...x, [k]: v }));

  const saveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (s.endHour <= s.startHour) return toast("La hora de cierre debe ser posterior a la de apertura", "error");
    update((d) => ({ ...d, settings: s }));
    toast("Configuración guardada");
  };
  const backup = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `respaldo-consultorio-${today()}.json`; a.click();
    URL.revokeObjectURL(a.href);
    toast("Respaldo descargado");
  };
  const restore = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as DB;
      if (!Array.isArray(data.patients) || !data.settings) throw new Error();
      if (!(await confirm({ title: "Restaurar respaldo", text: `Se reemplazarán todos los datos actuales con el respaldo (${data.patients.length} pacientes).`, danger: true, confirmLabel: "Restaurar" }))) return;
      replace(data); setS(data.settings); toast("Respaldo restaurado");
    } catch { toast("El archivo no es un respaldo válido", "error"); }
  };
  const doReset = async () => {
    if (await confirm({ title: "Restablecer datos de ejemplo", text: "Se borrarán todos tus datos y se cargarán los datos de demostración. Descarga un respaldo antes si lo necesitas.", danger: true, confirmLabel: "Restablecer" })) {
      reset(); toast("Datos de ejemplo cargados", "info");
    }
  };
  const doClear = async () => {
    if (await confirm({ title: "Empezar desde cero", text: "Se eliminarán pacientes, citas, presupuestos, pagos, recetas, materiales y egresos. Se conservan la configuración y el catálogo de tratamientos.", danger: true, confirmLabel: "Borrar todo" })) {
      update((d) => ({ ...d, patients: [], appointments: [], budgets: [], payments: [], materials: [], expenses: [], prescriptions: [], consents: [] }));
      toast("Datos eliminados. ¡Listo para empezar!", "info");
    }
  };
  const delProc = async (p: Procedure) => {
    if (await confirm({ title: "Eliminar tratamiento", text: `¿Quitar "${p.name}" del catálogo? Los presupuestos existentes no se modifican.`, danger: true, confirmLabel: "Eliminar" })) { procedures.remove(p.id); toast("Tratamiento eliminado", "info"); }
  };

  const counts = [
    ["Pacientes", db.patients.length], ["Citas", db.appointments.length], ["Presupuestos", db.budgets.length],
    ["Pagos", db.payments.length], ["Materiales", db.materials.length], ["Egresos", db.expenses.length], ["Recetas", db.prescriptions.length], ["Consentimientos", db.consents.length],
  ] as const;

  return (
    <>
      <PageHeader kicker="Preferencias del sistema" title="Configuración" />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: "clinica", label: "Clínica y horario" }, { id: "tratamientos", label: "Tratamientos", count: db.procedures.length }, ...(mode === "cloud" ? [{ id: "equipo" as Tab, label: "Equipo" }, { id: "bitacora" as Tab, label: "Bitácora" }] : []), { id: "datos", label: "Datos y respaldo" }]} />

      {tab === "equipo" && <TeamPanel />}
      {tab === "bitacora" && <AuditPanel />}

      {tab === "clinica" && (
        <form onSubmit={saveSettings} className="grid gap-5 xl:grid-cols-2">
          <section className="card grid gap-4 sm:grid-cols-2">
            <h2 className="flex items-center gap-2 text-lg font-bold sm:col-span-2"><Building2 size={20} className="text-brand" /> Datos del consultorio</h2>
            <label className="label sm:col-span-2">Nombre de la clínica<input className="input" value={s.clinicName} onChange={(e) => set("clinicName", e.target.value)} /></label>
            <label className="label">Doctor(a)<input className="input" value={s.doctorName} onChange={(e) => set("doctorName", e.target.value)} /></label>
            <label className="label">Especialidad<input className="input" value={s.specialty} onChange={(e) => set("specialty", e.target.value)} /></label>
            <label className="label">Cédula profesional<input className="input" value={s.license} onChange={(e) => set("license", e.target.value)} /></label>
            <label className="label">Teléfono<input className="input" value={s.phone} onChange={(e) => set("phone", e.target.value)} /></label>
            <label className="label">Correo<input className="input" type="email" value={s.email} onChange={(e) => set("email", e.target.value)} /></label>
            <label className="label">Dirección<input className="input" value={s.address} onChange={(e) => set("address", e.target.value)} /></label>
            <label className="label">RFC (para recibos)<input className="input uppercase" value={s.rfc ?? ""} onChange={(e) => set("rfc", e.target.value.toUpperCase())} placeholder="Opcional" /></label>
          </section>
          <section className="card flex flex-col gap-4">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Clock size={20} className="text-brand" /> Horario de atención</h2>
            <div className="grid grid-cols-2 gap-4">
              <label className="label">Apertura
                <select className="input" value={s.startHour} onChange={(e) => set("startHour", +e.target.value)}>{Array.from({ length: 14 }, (_, i) => i + 6).map((h) => <option key={h} value={h}>{h}:00</option>)}</select>
              </label>
              <label className="label">Cierre
                <select className="input" value={s.endHour} onChange={(e) => set("endHour", +e.target.value)}>{Array.from({ length: 14 }, (_, i) => i + 10).map((h) => <option key={h} value={h}>{h}:00</option>)}</select>
              </label>
            </div>
            <div className="label">Días laborales
              <div className="grid grid-cols-3 gap-2">
                {[[5, "Lun – Vie"], [6, "Lun – Sáb"], [7, "Toda la semana"]].map(([n, l]) => (
                  <button type="button" key={n} onClick={() => set("workDays", +n)} className={`btn border ${s.workDays === n ? "border-brand bg-brand-soft text-brand-dark" : "border-line bg-surface"}`}>{l}</button>
                ))}
              </div>
            </div>
            <div className="mt-auto rounded-2xl bg-bg p-4 text-sm text-ink-soft">
              Así aparecerá en tus presupuestos impresos:<br />
              <b className="text-ink">{s.clinicName}</b> · {s.doctorName} · {s.specialty}<br />{s.address} · Tel. {s.phone}
            </div>
            <button className="btn-primary"><Save size={18} /> Guardar cambios</button>
          </section>
          <ProfessionalsEditor value={professionalsOf(s)} onChange={(professionals) => set("professionals", professionals)} />
        </form>
      )}

      {tab === "tratamientos" && (
        <section className="card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="flex items-center gap-2 text-lg font-bold"><Stethoscope size={20} className="text-brand" /> Catálogo de tratamientos</h2><p className="text-sm text-muted">Precios, costos de material y duración usados en presupuestos y agenda.</p></div>
            <button className="btn-primary" onClick={() => setProc(null)}><Plus size={18} /> Nuevo tratamiento</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr><th className="th">Tratamiento</th><th className="th">Duración</th><th className="th text-right">Precio</th><th className="th text-right">Costo material</th><th className="th text-right">Margen</th><th className="th" /></tr></thead>
              <tbody>{db.procedures.map((p) => {
                const m = p.price ? Math.round(((p.price - p.materialCost) / p.price) * 100) : 0;
                return (
                  <tr key={p.id} className="row-hover">
                    <td className="td"><span className="flex items-center gap-2 font-semibold"><span className="h-3 w-3 rounded-full" style={{ background: p.color ?? "#9FB4C9" }} />{p.name}</span></td>
                    <td className="td text-muted">{p.durationMin} min{p.materials?.length ? <span className="block text-xs">{p.materials.length} materiales</span> : null}</td>
                    <td className="td text-right font-bold">{mxn(p.price)}</td>
                    <td className="td text-right text-cost">{mxn(p.materialCost)}</td>
                    <td className="td text-right"><span className={`badge ${m >= 60 ? "bg-brand-soft text-brand-dark" : m >= 40 ? "bg-[#FDF1D8] text-[#855A06]" : "bg-[#FBE3E0] text-[#9E2A20]"}`}>{m}%</span></td>
                    <td className="td"><div className="flex justify-end gap-1">
                      <button className="icon-btn" aria-label="Editar" onClick={() => setProc(p)}><Pencil size={15} /></button>
                      <button className="icon-btn hover:text-danger" aria-label="Eliminar" onClick={() => delProc(p)}><Trash2 size={15} /></button>
                    </div></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "datos" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="card">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold"><Database size={20} className="text-brand" /> Tus datos</h2>
            <p className="mb-4 text-sm text-muted">{mode === "cloud" ? "La información está en la nube (Supabase) y se sincroniza en tiempo real con tu equipo. Un respaldo descargable nunca está de más." : "La información se guarda en este navegador. Descarga respaldos periódicamente o conecta Supabase para guardarla en la nube."}</p>
            <div className="grid grid-cols-3 gap-3">
              {counts.map(([l, n]) => <div key={l} className="rounded-2xl bg-bg p-3 text-center"><p className="text-2xl font-extrabold">{n}</p><p className="text-xs text-muted">{l}</p></div>)}
            </div>
          </section>
          <section className="card flex flex-col gap-3">
            <h2 className="text-lg font-bold">Respaldo y restauración</h2>
            <button className="btn-primary justify-start" onClick={backup}><Download size={18} /> Descargar respaldo (.json)</button>
            <button className="btn-outline justify-start" onClick={() => file.current?.click()}><Upload size={18} /> Restaurar desde archivo</button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ""; }} />
            <hr className="my-2 border-line" />
            <button className="btn-outline justify-start" onClick={doReset}><RotateCcw size={18} /> Cargar datos de ejemplo</button>
            <button className="btn-outline justify-start text-danger" onClick={doClear}><Trash2 size={18} /> Empezar desde cero</button>
          </section>
        </div>
      )}

      <ProcedureModal proc={proc} onClose={() => setProc(undefined)} />
    </>
  );
}

const palette = ["#12A36A", "#0F2A44", "#3A7BD5", "#E8893A", "#D9483B", "#F2B33D", "#7B61FF", "#9ADBC0"];
function ProcedureModal({ proc, onClose }: { proc: Procedure | null | undefined; onClose: () => void }) {
  const { db } = useStore();
  const procedures = useCollection("procedures");
  const { toast } = useUI();
  const [f, setF] = useState<Procedure>({ id: "", name: "", price: 0, materialCost: 0, durationMin: 30, color: palette[0] });
  const [last, setLast] = useState<Procedure | null | undefined>(undefined);
  if (proc !== last) { setLast(proc); if (proc !== undefined) setF(proc ?? { id: "", name: "", price: 0, materialCost: 0, durationMin: 30, color: palette[0] }); }
  const matCost = (f.materials ?? []).reduce((a, m) => a + m.qty * (db.materials.find((x) => x.id === m.materialId)?.lastCost ?? 0), 0);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    procedures.save({ ...f, id: f.id || `t${uid()}` });
    toast(proc ? "Tratamiento actualizado" : "Tratamiento agregado");
    onClose();
  };
  return (
    <Modal open={proc !== undefined} onClose={onClose} title={proc ? "Editar tratamiento" : "Nuevo tratamiento"}
      footer={<><button type="button" className="btn-outline" onClick={onClose}>Cancelar</button><button form="proc-form" className="btn-primary">Guardar</button></>}>
      <form id="proc-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="label sm:col-span-2">Nombre *<input required className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="label">Precio al paciente<input type="number" min={0} className="input" value={f.price} onChange={(e) => setF({ ...f, price: +e.target.value })} /></label>
        <label className="label">Costo de material<input type="number" min={0} className="input" value={f.materialCost} onChange={(e) => setF({ ...f, materialCost: +e.target.value })} /></label>
        <label className="label">Duración (min)<input type="number" min={5} step={5} className="input" value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: +e.target.value })} /></label>
        <div className="label">Color
          <div className="flex flex-wrap gap-2">{palette.map((c) => (
            <button type="button" key={c} aria-label={c} onClick={() => setF({ ...f, color: c })} className={`h-8 w-8 rounded-full ring-offset-2 ${f.color === c ? "ring-2 ring-navy" : ""}`} style={{ background: c }} />
          ))}</div>
        </div>
        <div className="rounded-2xl border border-line p-4 sm:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold">Materiales que consume</p>
            <button type="button" className="btn-outline btn-sm" disabled={!db.materials.length}
              onClick={() => setF({ ...f, materials: [...(f.materials ?? []), { materialId: db.materials[0]?.id ?? "", qty: 1 }] })}><Plus size={14} /> Material</button>
          </div>
          {(f.materials ?? []).length ? (
            <div className="flex flex-col gap-2">
              {(f.materials ?? []).map((m, i) => {
                const mat = db.materials.find((x) => x.id === m.materialId);
                const setRow = (ch: Partial<ProcedureMaterial>) => setF({ ...f, materials: (f.materials ?? []).map((x, j) => j === i ? { ...x, ...ch } : x) });
                return (
                  <div key={i} className="flex items-center gap-2">
                    <select aria-label="Material" className="input min-h-[38px] flex-1" value={m.materialId} onChange={(e) => setRow({ materialId: e.target.value })}>
                      {db.materials.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                    <input aria-label="Cantidad" type="number" min={0} step={0.01} className="input min-h-[38px] w-20" value={m.qty} onChange={(e) => setRow({ qty: Math.max(0, +e.target.value) })} />
                    <span className="w-16 truncate text-xs text-muted">{mat?.unit}</span>
                    <button type="button" aria-label="Quitar" className="icon-btn hover:text-danger" onClick={() => setF({ ...f, materials: (f.materials ?? []).filter((_, j) => j !== i) })}><Trash2 size={15} /></button>
                  </div>
                );
              })}
              <p className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted">
                Costo calculado con el último precio de compra: <b className="text-ink">{mxn(matCost)}</b>
                {Math.round(matCost) !== f.materialCost && <button type="button" className="font-bold text-brand" onClick={() => setF({ ...f, materialCost: Math.round(matCost) })}>Usar como costo de material</button>}
              </p>
            </div>
          ) : <p className="text-xs text-muted">Agrega los insumos para que se descuenten del inventario automáticamente al terminar una consulta.</p>}
        </div>
        <p className="rounded-xl bg-brand-soft p-3 text-sm text-brand-dark sm:col-span-2">Utilidad por tratamiento: <b>{mxn(f.price - f.materialCost)}</b> ({f.price ? Math.round(((f.price - f.materialCost) / f.price) * 100) : 0}% de margen)</p>
      </form>
    </Modal>
  );
}

function TeamPanel() {
  const { clinic, profile } = useStore();
  const { toast, confirm } = useUI();
  const [team, setTeam] = useState<Profile[]>([]);
  const [code, setCode] = useState(clinic?.codigo ?? "");
  const load = () => { if (clinic) listTeam(clinic.id).then(setTeam).catch((e) => toast(String(e.message ?? e), "error")); };
  useEffect(load, [clinic]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async () => {
    try { await navigator.clipboard.writeText(code); toast("Código copiado"); } catch { toast(`Código: ${code}`, "info"); }
  };
  const renew = async () => {
    if (!(await confirm({ title: "Generar código nuevo", text: "El código actual dejará de funcionar. Quienes ya están en el equipo no se ven afectados.", confirmLabel: "Generar" }))) return;
    try { setCode(await renewCode()); toast("Código renovado"); } catch (e) { toast(e instanceof Error ? e.message : String(e), "error"); }
  };
  const changeRole = async (m: Profile, rol: Profile["rol"]) => {
    try { await setRole(m.user_id, rol); toast(`${m.nombre} ahora es ${rol === "doctor" ? "doctor" : "recepción"}`); load(); } catch (e) { toast(e instanceof Error ? e.message : String(e), "error"); }
  };
  const remove = async (m: Profile) => {
    if (!(await confirm({ title: "Quitar del equipo", text: `${m.nombre} ya no podrá ver los datos de la clínica.`, danger: true, confirmLabel: "Quitar" }))) return;
    try { await removeMember(m.user_id); toast("Miembro eliminado", "info"); load(); } catch (e) { toast(e instanceof Error ? e.message : String(e), "error"); }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[2fr_3fr]">
      <section className="card flex h-fit flex-col gap-4">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Users size={20} className="text-brand" /> Invitar al equipo</h2>
        <p className="text-sm text-muted">Pide a tu recepcionista que cree su cuenta en esta misma página y elija <b>Unirme con código</b>.</p>
        <div className="rounded-2xl bg-bg p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Código de la clínica</p>
          <p className="my-2 font-mono text-3xl font-extrabold tracking-[.35em]">{code}</p>
          <div className="flex justify-center gap-2">
            <button className="btn-outline btn-sm" onClick={copy}><Copy size={14} /> Copiar</button>
            <button className="btn-outline btn-sm" onClick={renew}><RefreshCw size={14} /> Renovar</button>
          </div>
        </div>
        <p className="rounded-xl bg-[#E6EEF8] p-3 text-xs text-[#22508F]">Recepción puede agendar, registrar pacientes, cobrar y capturar compras. No ve Finanzas, Reportes ni Configuración, y no puede borrar pacientes ni pagos.</p>
      </section>
      <section className="card">
        <h2 className="mb-3 text-lg font-bold">Miembros ({team.length})</h2>
        {team.map((m) => (
          <div key={m.user_id} className="flex flex-wrap items-center gap-3 border-t border-line py-3 first:border-0">
            <Avatar name={m.nombre} size={38} />
            <div className="min-w-[160px] flex-1"><p className="font-bold">{m.nombre}{m.user_id === profile?.user_id && <span className="font-normal text-muted"> (tú)</span>}</p><p className="text-xs text-muted">{m.email}</p></div>
            {m.user_id === profile?.user_id ? <span className="badge bg-brand-soft text-brand-dark">Doctor</span> : (
              <>
                <select aria-label={`Rol de ${m.nombre}`} className="input min-h-[36px] w-auto" value={m.rol} onChange={(e) => changeRole(m, e.target.value as Profile["rol"])}>
                  <option value="recepcion">Recepción</option><option value="doctor">Doctor</option>
                </select>
                <button className="icon-btn hover:text-danger" aria-label={`Quitar a ${m.nombre}`} onClick={() => remove(m)}><UserMinus size={16} /></button>
              </>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

/* ---------------- Bitácora del expediente ---------------- */
const collLabel: Record<string, string> = {
  patients: "Paciente", appointments: "Cita", budgets: "Presupuesto", payments: "Pago", prescriptions: "Receta",
  consents: "Consentimiento", materials: "Material", expenses: "Egreso", procedures: "Tratamiento", settings: "Configuración",
};
const fieldLabel: Record<string, string> = {
  name: "nombre", phone: "teléfono", email: "correo", birthDate: "fecha de nacimiento", allergies: "alergias", conditions: "padecimientos",
  notes: "notas", teeth: "odontograma", surfaces: "superficies", clinicalNotes: "notas clínicas", history: "historia clínica",
  status: "estado", date: "fecha", start: "hora", items: "conceptos", discount: "descuento", amount: "monto", stock: "existencias",
  treatment: "tratamiento", durationMin: "duración", price: "precio",
};
const accionStyle = { crear: "bg-brand-soft text-brand-dark", editar: "bg-[#E6EEF8] text-[#22508F]", eliminar: "bg-[#FBE3E0] text-[#9E2A20]" };

/** Nombre legible del registro afectado, buscándolo en los datos actuales (o en la copia previa si se borró). */
function recordLabel(db: DBType, e: AuditEntry): string {
  const prev = (e.antes ?? {}) as Record<string, unknown>;
  const patient = (id?: unknown) => db.patients.find((p) => p.id === id)?.name;
  switch (e.coleccion) {
    case "patients": return patient(e.registro_id) ?? (prev.name as string) ?? "Paciente eliminado";
    case "appointments": { const a = db.appointments.find((x) => x.id === e.registro_id); return a ? `${patient(a.patientId) ?? ""} · ${fmtDate(a.date, { day: "numeric", month: "short" })} ${a.start}` : `${patient(prev.patientId) ?? "Cita"} (eliminada)`; }
    case "payments": { const x = db.payments.find((y) => y.id === e.registro_id) ?? (prev as { amount?: number; patientId?: string }); return `${patient(x.patientId) ?? ""} · ${mxn(Number(x.amount ?? 0))}`; }
    case "budgets": { const b = db.budgets.find((x) => x.id === e.registro_id); return b ? `Folio #${b.folio} · ${patient(b.patientId) ?? ""}` : `Folio #${prev.folio ?? "?"} (eliminado)`; }
    case "prescriptions": { const r = db.prescriptions.find((x) => x.id === e.registro_id); return r ? `Receta #${r.folio} · ${patient(r.patientId) ?? ""}` : "Receta eliminada"; }
    case "consents": { const c = db.consents.find((x) => x.id === e.registro_id); return c ? `${c.title} · ${patient(c.patientId) ?? ""}` : "Consentimiento eliminado"; }
    case "materials": return db.materials.find((x) => x.id === e.registro_id)?.name ?? (prev.name as string) ?? "Material";
    case "procedures": return db.procedures.find((x) => x.id === e.registro_id)?.name ?? (prev.name as string) ?? "Tratamiento";
    default: return collLabel[e.coleccion] ?? e.coleccion;
  }
}

function AuditPanel() {
  const { db, clinic } = useStore();
  const { toast } = useUI();
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [patientId, setPatientId] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (!clinic) return;
    setRows(null);
    loadAudit(clinic.id, { registroId: patientId || undefined, limit: 300 })
      .then(setRows)
      .catch((e) => { setRows([]); toast(/does not exist|relation/i.test(e.message) ? "La bitácora se activa al actualizar el esquema en Supabase." : e.message, "error"); });
  }, [clinic, patientId, toast]);

  return (
    <section className="card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Bitácora de cambios</h2>
          <p className="text-sm text-muted">Registro automático de quién creó, modificó o eliminó información. No se puede editar ni borrar.</p>
        </div>
        <select aria-label="Filtrar por paciente" className="input w-auto min-w-[220px]" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
          <option value="">Todos los cambios</option>
          {[...db.patients].sort((a, b) => a.name.localeCompare(b.name)).map((p) => <option key={p.id} value={p.id}>Expediente de {p.name}</option>)}
        </select>
      </div>
      {rows === null ? <p className="py-8 text-center text-sm text-muted">Cargando…</p> : rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead><tr><th className="th">Fecha</th><th className="th">Usuario</th><th className="th">Acción</th><th className="th">Registro</th><th className="th">Qué cambió</th></tr></thead>
            <tbody>{rows.map((e) => (
              <tr key={e.id} className="row-hover align-top">
                <td className="td whitespace-nowrap text-muted">{new Date(e.fecha).toLocaleString("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                <td className="td font-semibold">{e.usuario_nombre ?? "—"}</td>
                <td className="td"><span className={`badge ${accionStyle[e.accion]}`}>{e.accion === "crear" ? "Creó" : e.accion === "editar" ? "Editó" : "Eliminó"}</span></td>
                <td className="td"><span className="text-xs text-muted">{collLabel[e.coleccion] ?? e.coleccion}</span><br />{recordLabel(db, e)}</td>
                <td className="td">
                  {e.campos?.length ? e.campos.map((c) => fieldLabel[c] ?? c).join(", ") : e.accion === "eliminar" ? "Registro completo" : "—"}
                  {e.antes && (
                    <button className="ml-2 text-xs font-semibold text-brand hover:underline" onClick={() => setOpen(open === e.id ? null : e.id)}>{open === e.id ? "Ocultar" : "Ver valor anterior"}</button>
                  )}
                  {open === e.id && <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-bg p-2 text-[11px] leading-snug">{JSON.stringify(e.antes, null, 2)}</pre>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p className="py-8 text-center text-sm text-muted">Sin cambios registrados todavía.</p>}
    </section>
  );
}

/* ---------------- Profesionales ---------------- */
const proColors = ["#12A36A", "#3A7BD5", "#7B61FF", "#E8893A", "#D9483B", "#0F2A44", "#F2B33D", "#0E9AA7"];
function ProfessionalsEditor({ value, onChange }: { value: Professional[]; onChange: (v: Professional[]) => void }) {
  const setRow = (i: number, ch: Partial<Professional>) => onChange(value.map((p, j) => (j === i ? { ...p, ...ch } : p)));
  const add = () => onChange([...value, { id: `pr${uid()}`, name: "", color: proColors[value.length % proColors.length] }]);
  return (
    <section className="card flex flex-col gap-4 xl:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><Stethoscope size={20} className="text-brand" /> Profesionales que atienden</h2>
          <p className="text-sm text-muted">Con dos o más, la agenda se puede filtrar por doctor y los reportes muestran la productividad y comisión de cada uno.</p>
        </div>
        <button type="button" className="btn-outline" onClick={add}><Plus size={18} /> Agregar profesional</button>
      </div>
      <div className="flex flex-col gap-2">
        {value.map((p, i) => (
          <div key={p.id} className={`flex flex-wrap items-center gap-3 rounded-2xl border border-line p-3 ${p.active === false ? "opacity-60" : ""}`}>
            <div className="flex gap-1">
              {proColors.map((c) => (
                <button type="button" key={c} aria-label={`Color ${c}`} onClick={() => setRow(i, { color: c })}
                  className={`h-6 w-6 rounded-full ring-offset-2 ${p.color === c ? "ring-2 ring-navy" : ""}`} style={{ background: c }} />
              ))}
            </div>
            <input aria-label="Nombre" required className="input min-h-[38px] min-w-[180px] flex-1" placeholder="Dr. Nombre Apellido" value={p.name} onChange={(e) => setRow(i, { name: e.target.value })} />
            <label className="flex items-center gap-2 text-sm text-muted">Comisión
              <input aria-label="Comisión %" type="number" min={0} max={100} className="input min-h-[38px] w-20" value={p.commissionPct ?? ""} placeholder="0" onChange={(e) => setRow(i, { commissionPct: e.target.value === "" ? undefined : Math.min(100, Math.max(0, +e.target.value)) })} />%
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-brand" checked={p.active !== false} onChange={(e) => setRow(i, { active: e.target.checked ? undefined : false })} /> Activo
            </label>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">Para que alguien deje de aparecer en la agenda, desmárcalo como activo: sus citas anteriores conservan su nombre. Guarda con el botón &quot;Guardar cambios&quot;.</p>
    </section>
  );
}
