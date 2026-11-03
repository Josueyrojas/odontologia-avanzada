"use client";
import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CalendarPlus, CircleDollarSign, FilePlus2, FileText, HeartPulse, Mail, MessageCircle, Pencil, PenLine, Phone, Pill, Plus, Printer, ShieldAlert, StickyNote, Trash2, Users } from "lucide-react";
import Odontogram, { statusLabel, ToothStatusPicker } from "@/components/Odontogram";
import SurfaceOdontogram, { findingLabel, surfaceSummary } from "@/components/SurfaceOdontogram";
import { Avatar, EmptyState, StatCard, Tabs, useUI } from "@/components/ui";
import { AppointmentFormModal, PatientFormModal, PaymentFormModal } from "@/components/forms";
import { ConsentModal, ConsentPrint } from "@/components/consent";
import { activeRisks, isCritical, MedicalHistoryForm, PrescriptionModal, PrescriptionPrint, riskLabel } from "@/components/clinical";
import { apptBadge, apptLabel, budgetBadge, budgetLabel, methodLabel } from "@/components/status";
import { budgetTotals, nextFolio, paidForBudget, patientBalance, useCollection, useStore } from "@/lib/store";
import { age, fmtDate, mxn, today, uid, whatsappLink } from "@/lib/format";
import type { Appointment, Consent, Prescription, ToothStatus } from "@/lib/types";

type Tab = "odontograma" | "historia" | "citas" | "presupuestos" | "pagos" | "notas" | "recetas" | "consentimientos";

export default function PacienteDetalle() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { db, update } = useStore();
  const patients = useCollection("patients");
  const budgets = useCollection("budgets");
  const { toast, confirm } = useUI();
  const [tab, setTab] = useState<Tab>("odontograma");
  const [modal, setModal] = useState<"editar" | "cita" | "pago" | null>(null);
  const [editAppt, setEditAppt] = useState<Appointment | undefined>();
  const [tooth, setTooth] = useState<number | null>(null);
  const [odoView, setOdoView] = useState<"diente" | "superficies">("diente");
  const [note, setNote] = useState("");
  const [noteTooth, setNoteTooth] = useState("");
  const [rxOpen, setRxOpen] = useState(false);
  const [printRx, setPrintRx] = useState<Prescription | null>(null);
  const [csOpen, setCsOpen] = useState(false);
  const [printCs, setPrintCs] = useState<Consent | null>(null);
  const print = (rx: Prescription) => { setPrintCs(null); setPrintRx(rx); setTimeout(() => window.print(), 80); };
  const printConsent = (c: Consent) => { setPrintRx(null); setPrintCs(c); setTimeout(() => window.print(), 80); };

  const p = patients.get(id);
  if (!p) return <EmptyState icon={Users} title="Paciente no encontrado" action={<Link href="/pacientes" className="btn-primary">Volver a pacientes</Link>} />;

  const t = today();
  const appts = db.appointments.filter((a) => a.patientId === p.id).sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
  const next = [...appts].reverse().find((a) => a.date >= t && !["completada", "cancelada"].includes(a.status));
  const myBudgets = db.budgets.filter((b) => b.patientId === p.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const myPayments = db.payments.filter((x) => x.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const paid = myPayments.reduce((a, x) => a + x.amount, 0);
  const balance = patientBalance(db, p.id);
  const risks = activeRisks(p);
  const myConsents = db.consents.filter((c) => c.patientId === p.id).sort((a, b) => b.folio - a.folio);
  const myRx = db.prescriptions.filter((r) => r.patientId === p.id).sort((a, b) => b.folio - a.folio);
  const rxText = (r: Prescription) =>
    `Receta #${r.folio} — ${db.settings.doctorName}\n\n` +
    r.items.map((i, n) => `${n + 1}. ${i.drug}: ${i.dose}, ${i.frequency}, durante ${i.duration}`).join("\n") +
    (r.indications ? `\n\nIndicaciones: ${r.indications}` : "");
  const pending = Object.entries(p.teeth).filter(([, s]) => s === "pendiente" || s === "problema");

  const setToothStatus = (s: ToothStatus) => {
    if (tooth == null) return;
    patients.patch(p.id, { teeth: { ...p.teeth, [tooth]: s } });
    toast(`Diente ${tooth}: ${statusLabel[s]}`);
  };
  const addNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    patients.patch(p.id, { clinicalNotes: [{ id: uid(), date: t, text: note.trim(), tooth: noteTooth ? +noteTooth : undefined }, ...p.clinicalNotes] });
    setNote(""); setNoteTooth(""); toast("Nota agregada al expediente");
  };
  const newBudget = () => {
    const id = `b${uid()}`;
    budgets.add({ id, folio: nextFolio(db), patientId: p.id, items: [], discount: 0, status: "borrador", createdAt: t });
    router.push(`/presupuestos/${id}`);
  };
  const del = async () => {
    if (!(await confirm({ title: "Eliminar paciente", text: `Se eliminará a ${p.name} junto con su expediente completo (citas, presupuestos, pagos, recetas y consentimientos). Esta acción no se puede deshacer.`, danger: true, confirmLabel: "Eliminar" }))) return;
    update((d) => ({
      ...d,
      patients: d.patients.filter((x) => x.id !== p.id),
      appointments: d.appointments.filter((x) => x.patientId !== p.id),
      budgets: d.budgets.filter((x) => x.patientId !== p.id),
      payments: d.payments.filter((x) => x.patientId !== p.id),
      prescriptions: d.prescriptions.filter((x) => x.patientId !== p.id),
      consents: d.consents.filter((x) => x.patientId !== p.id),
    }));
    toast("Paciente eliminado", "info");
    router.push("/pacientes");
  };

  return (
    <>
      <div className="print:hidden">
      <Link href="/pacientes" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft size={16} /> Pacientes</Link>

      <div className="card mb-5 flex flex-wrap items-center gap-5">
        <Avatar name={p.name} size={72} />
        <div className="min-w-[220px] flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight">{p.name}</h1>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            {p.birthDate && <span>{age(p.birthDate)} años · {fmtDate(p.birthDate)}</span>}
            <span className="flex items-center gap-1"><Phone size={14} /> {p.phone}</span>
            {p.email && <span className="flex items-center gap-1"><Mail size={14} /> {p.email}</span>}
            <span>Paciente desde {fmtDate(p.createdAt, { month: "short", year: "numeric" })}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {p.allergies && <span className="badge bg-[#FBE3E0] text-[#9E2A20]"><AlertTriangle size={12} /> Alergia: {p.allergies}</span>}
            {p.conditions && <span className="badge bg-[#E6EEF8] text-[#22508F]"><HeartPulse size={12} /> {p.conditions}</span>}
            {next && <span className="badge bg-brand-soft text-brand-dark">Próxima cita: {fmtDate(next.date, { day: "numeric", month: "short" })} {next.start}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn-outline" target="_blank" rel="noreferrer" href={whatsappLink(p.phone, `Hola ${p.name.split(" ")[0]}, le saludamos de ${db.settings.clinicName}.`)}><MessageCircle size={18} /> WhatsApp</a>
          <button className="btn-outline" onClick={() => setModal("editar")}><Pencil size={18} /> Editar</button>
          <button className="btn-outline" onClick={() => setCsOpen(true)}><PenLine size={18} /> Consentimiento</button>
          <button className="btn-outline" onClick={() => setRxOpen(true)}><Pill size={18} /> Receta</button>
          <button className="btn-outline" onClick={() => setModal("pago")}><CircleDollarSign size={18} /> Cobrar</button>
          <button className="btn-primary" onClick={() => { setEditAppt(undefined); setModal("cita"); }}><CalendarPlus size={18} /> Agendar</button>
        </div>
      </div>

      {(risks.length > 0 || p.allergies) && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-[#F5C9C3] bg-[#FDF3F2] p-4">
          <ShieldAlert size={20} className="text-danger" />
          <b className="mr-1 text-sm text-[#9E2A20]">Alertas médicas:</b>
          {p.allergies && <span className="badge bg-danger text-white">Alergia: {p.allergies}</span>}
          {risks.map((k) => <span key={k} className={`badge ${isCritical(k) ? "bg-[#FBE3E0] text-[#9E2A20]" : "bg-[#FDF1D8] text-[#855A06]"}`}>{riskLabel[k]}</span>)}
          {p.history?.medications && <span className="text-xs text-ink-soft">· Medicación: {p.history.medications}</span>}
        </div>
      )}
      {!p.history && (
        <button onClick={() => setTab("historia")} className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-dashed border-[#3A7BD5] bg-[#E6EEF8] p-4 text-left text-sm text-[#22508F] transition hover:bg-[#DCE7F6]">
          <HeartPulse size={20} /> <span className="flex-1"><b>Historia clínica pendiente.</b> Registra antecedentes, medicamentos y factores de riesgo antes del tratamiento.</span><span className="font-bold">Completar →</span>
        </button>
      )}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Visitas completadas" value={String(appts.filter((a) => a.status === "completada").length)} />
        <StatCard label="Tratamientos pendientes" value={String(pending.length)} tone={pending.length ? "amber" : "white"} note={pending.length ? `Dientes ${pending.map(([n]) => n).join(", ")}` : "Sin pendientes"} />
        <StatCard label="Total pagado" value={mxn(paid)} tone="green" />
        <StatCard label="Saldo pendiente" value={mxn(balance)} tone={balance ? "red" : "white"} />
      </div>

      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: "odontograma", label: "Odontograma" },
        { id: "historia", label: "Historia clínica" },
        { id: "citas", label: "Citas", count: appts.length },
        { id: "presupuestos", label: "Presupuestos", count: myBudgets.length },
        { id: "pagos", label: "Pagos", count: myPayments.length },
        { id: "notas", label: "Notas clínicas", count: p.clinicalNotes.length },
        { id: "recetas", label: "Recetas", count: myRx.length },
        { id: "consentimientos", label: "Consentimientos", count: myConsents.length },
      ]} />

      {tab === "odontograma" && (
        <div className="grid gap-5 xl:grid-cols-[3fr_1fr]">
          <section className="card">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Odontograma</h2>
                <p className="text-sm text-muted">{odoView === "diente" ? "Selecciona un diente para cambiar su estado." : "Elige un hallazgo y toca la cara del diente."} Se guarda automáticamente.</p>
              </div>
              <div className="flex rounded-xl border border-edge p-1">
                {(["diente", "superficies"] as const).map((v) => (
                  <button key={v} onClick={() => setOdoView(v)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${odoView === v ? "bg-navy text-white" : "hover:bg-bg"}`}>{v === "diente" ? "Diente completo" : "Superficies"}</button>
                ))}
              </div>
            </div>
            {odoView === "superficies" ? (
              <SurfaceOdontogram teeth={p.teeth} surfaces={p.surfaces ?? {}} onChange={(surfaces) => patients.patch(p.id, { surfaces })} />
            ) : (
              <Odontogram teeth={p.teeth} selected={tooth} onSelect={(n) => setTooth(tooth === n ? null : n)} />
            )}
            {odoView === "diente" && tooth != null && (
              <div className="mt-5 animate-rise rounded-2xl bg-bg p-4">
                <p className="mb-3 font-bold">Diente {tooth} · <span className="font-semibold text-muted">{statusLabel[p.teeth[tooth] ?? "sano"]}</span></p>
                <ToothStatusPicker value={p.teeth[tooth] ?? "sano"} onChange={setToothStatus} />
              </div>
            )}
          </section>
          <aside className="card h-fit">
            <h2 className="mb-3 text-lg font-bold">Plan de tratamiento</h2>
            {pending.length ? (
              <ul className="mb-4 space-y-2">
                {pending.map(([n, s]) => (
                  <li key={n} className="flex items-center gap-2 text-sm">
                    <span className={`h-2.5 w-2.5 rounded-full ${s === "problema" ? "bg-danger" : "bg-warn"}`} />
                    <b>Diente {n}</b><span className="text-muted">{statusLabel[s]}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mb-4 text-sm text-muted">No hay dientes marcados como pendientes.</p>}
            {surfaceSummary(p.surfaces).filter((x) => x.finding === "caries" || x.finding === "fractura").length > 0 && (
              <div className="mb-4 rounded-xl bg-bg p-3 text-sm">
                <p className="mb-1 font-bold">Hallazgos por superficie</p>
                {surfaceSummary(p.surfaces).filter((x) => x.finding === "caries" || x.finding === "fractura").map((x) => (
                  <p key={`${x.tooth}${x.finding}`} className="text-ink-soft">Diente {x.tooth}: {findingLabel[x.finding].toLowerCase()} {x.faces.join("-")}</p>
                ))}
              </div>
            )}
            <button className="btn-primary w-full" onClick={newBudget}><FilePlus2 size={18} /> Crear presupuesto</button>
          </aside>
        </div>
      )}

      {tab === "citas" && (
        <section className="card">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Historial de citas</h2><button className="btn-primary btn-sm" onClick={() => { setEditAppt(undefined); setModal("cita"); }}><Plus size={14} /> Nueva</button></div>
          {appts.length ? (
            <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
              <thead><tr><th className="th">Fecha</th><th className="th">Hora</th><th className="th">Tratamiento</th><th className="th">Estado</th><th className="th" /></tr></thead>
              <tbody>{appts.map((a) => (
                <tr key={a.id} className="row-hover">
                  <td className="td font-semibold">{fmtDate(a.date)}</td><td className="td">{a.start}</td>
                  <td className="td">{a.treatment}{a.notes && <span className="block text-xs text-muted">{a.notes}</span>}</td>
                  <td className="td"><span className={`badge ${apptBadge[a.status]}`}>{apptLabel[a.status]}</span></td>
                  <td className="td text-right"><button className="icon-btn" aria-label="Editar cita" onClick={() => { setEditAppt(a); setModal("cita"); }}><Pencil size={15} /></button></td>
                </tr>
              ))}</tbody>
            </table></div>
          ) : <EmptyState icon={CalendarPlus} title="Sin citas registradas" />}
        </section>
      )}

      {tab === "presupuestos" && (
        <section className="card">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Presupuestos</h2><button className="btn-primary btn-sm" onClick={newBudget}><Plus size={14} /> Nuevo</button></div>
          {myBudgets.length ? myBudgets.map((b) => {
            const tot = budgetTotals(b).total, pd = paidForBudget(db, b.id);
            return (
              <Link key={b.id} href={`/presupuestos/${b.id}`} className="row-hover -mx-2 flex flex-wrap items-center gap-3 rounded-xl border-t border-line px-2 py-3 first:border-0">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-bg text-navy"><FileText size={18} /></span>
                <div className="min-w-[160px] flex-1"><p className="font-bold">Folio #{b.folio}</p><p className="text-xs text-muted">{fmtDate(b.createdAt)} · {b.items.map((i) => i.name).join(", ") || "Sin conceptos"}</p></div>
                <span className={`badge ${budgetBadge[b.status]}`}>{budgetLabel[b.status]}</span>
                <div className="w-32 text-right"><p className="font-bold">{mxn(tot)}</p>{b.status === "aceptado" && <p className="text-xs text-muted">Pagado {mxn(pd)}</p>}</div>
              </Link>
            );
          }) : <EmptyState icon={FileText} title="Sin presupuestos" action={<button className="btn-primary" onClick={newBudget}>Crear presupuesto</button>} />}
        </section>
      )}

      {tab === "pagos" && (
        <section className="card">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Pagos recibidos</h2><button className="btn-primary btn-sm" onClick={() => setModal("pago")}><Plus size={14} /> Registrar pago</button></div>
          {myPayments.length ? (
            <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm">
              <thead><tr><th className="th">Fecha</th><th className="th">Concepto</th><th className="th">Método</th><th className="th text-right">Monto</th></tr></thead>
              <tbody>{myPayments.map((x) => (
                <tr key={x.id}><td className="td">{fmtDate(x.date)}</td><td className="td">{x.concept}</td><td className="td text-muted">{methodLabel[x.method]}</td><td className="td text-right font-bold text-brand-dark">{mxn(x.amount)}</td></tr>
              ))}</tbody>
            </table></div>
          ) : <EmptyState icon={CircleDollarSign} title="Sin pagos registrados" />}
        </section>
      )}

      {tab === "historia" && <MedicalHistoryForm patient={p} />}

      {tab === "recetas" && (
        <section className="card">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Recetas emitidas</h2><button className="btn-primary btn-sm" onClick={() => setRxOpen(true)}><Plus size={14} /> Nueva receta</button></div>
          {myRx.length ? myRx.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 border-t border-line py-3 first:border-0">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand-dark"><Pill size={18} /></span>
              <div className="min-w-[200px] flex-1">
                <p className="font-bold">Receta #{r.folio} <span className="font-normal text-muted">· {fmtDate(r.date)}</span></p>
                <p className="text-sm text-ink-soft">{r.items.map((i) => i.drug).join(" · ")}</p>
              </div>
              <button className="btn-outline btn-sm" onClick={() => print(r)}><Printer size={14} /> Imprimir</button>
              <a className="btn-outline btn-sm" target="_blank" rel="noreferrer" href={whatsappLink(p.phone, rxText(r))}><MessageCircle size={14} /> Enviar</a>
            </div>
          )) : <EmptyState icon={Pill} title="Sin recetas" text="Las recetas se imprimen con tu membrete y cédula." action={<button className="btn-primary" onClick={() => setRxOpen(true)}>Crear receta</button>} />}
        </section>
      )}

      {tab === "consentimientos" && (
        <section className="card">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Consentimientos informados</h2><button className="btn-primary btn-sm" onClick={() => setCsOpen(true)}><Plus size={14} /> Nuevo</button></div>
          {myConsents.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {myConsents.map((c) => (
                <div key={c.id} className="flex flex-col gap-3 rounded-2xl border border-line p-4">
                  <div>
                    <p className="font-bold">{c.title}</p>
                    <p className="text-xs text-muted">CI-{c.folio} · {fmtDate(c.date)} · firmó {c.signerName}{c.witness ? ` · testigo ${c.witness}` : ""}</p>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.signature} alt={`Firma de ${c.signerName}`} className="h-16 rounded-xl bg-white object-contain p-1" />
                  <button className="btn-outline btn-sm mt-auto" onClick={() => printConsent(c)}><Printer size={14} /> Imprimir</button>
                </div>
              ))}
            </div>
          ) : <EmptyState icon={PenLine} title="Sin consentimientos" text="Genera el consentimiento desde una plantilla y el paciente firma en pantalla." action={<button className="btn-primary" onClick={() => setCsOpen(true)}>Crear consentimiento</button>} />}
        </section>
      )}

      {tab === "notas" && (
        <div className="grid gap-5 lg:grid-cols-[2fr_3fr]">
          <form onSubmit={addNote} className="card flex h-fit flex-col gap-3">
            <h2 className="text-lg font-bold">Nueva nota clínica</h2>
            <textarea className="input min-h-[120px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Evolución, diagnóstico, indicaciones…" />
            <label className="label">Diente (opcional)<input className="input" type="number" min={11} max={48} value={noteTooth} onChange={(e) => setNoteTooth(e.target.value)} placeholder="Ej. 36" /></label>
            <button className="btn-primary"><StickyNote size={18} /> Guardar nota</button>
            {p.notes && <p className="rounded-xl bg-bg p-3 text-sm text-ink-soft"><b>Notas generales:</b> {p.notes}</p>}
          </form>
          <section className="card">
            <h2 className="mb-3 text-lg font-bold">Evolución</h2>
            {p.clinicalNotes.length ? (
              <ol className="relative space-y-4 border-l-2 border-line pl-5">
                {p.clinicalNotes.map((n) => (
                  <li key={n.id} className="relative">
                    <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-brand ring-4 ring-surface" />
                    <div className="flex items-center gap-2 text-xs font-bold text-muted">
                      {fmtDate(n.date)}{n.tooth && <span className="badge bg-bg text-ink-soft">Diente {n.tooth}</span>}
                      <button className="ml-auto text-muted hover:text-danger" aria-label="Eliminar nota" onClick={() => patients.patch(p.id, { clinicalNotes: p.clinicalNotes.filter((x) => x.id !== n.id) })}><Trash2 size={14} /></button>
                    </div>
                    <p className="mt-1 text-sm">{n.text}</p>
                  </li>
                ))}
              </ol>
            ) : <EmptyState icon={StickyNote} title="Sin notas todavía" />}
          </section>
        </div>
      )}

      <div className="mt-8 text-right"><button className="btn-ghost text-sm text-danger" onClick={del}><Trash2 size={16} /> Eliminar paciente</button></div>

      </div>
      {printRx && <PrescriptionPrint rx={printRx} patient={p} />}
      {printCs && <ConsentPrint consent={printCs} patient={p} />}
      <ConsentModal open={csOpen} onClose={() => setCsOpen(false)} patient={p} onSaved={printConsent} />
      <PrescriptionModal open={rxOpen} onClose={() => setRxOpen(false)} patient={p} onSaved={print} />
      <PatientFormModal open={modal === "editar"} onClose={() => setModal(null)} patient={p} />
      <AppointmentFormModal open={modal === "cita"} onClose={() => setModal(null)} appt={editAppt} defaults={{ patientId: p.id }} />
      <PaymentFormModal open={modal === "pago"} onClose={() => setModal(null)} patientId={p.id} />
    </>
  );
}
