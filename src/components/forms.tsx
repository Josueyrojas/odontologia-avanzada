"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Modal, useUI } from "./ui";
import { apptLabel, expenseCategories, methodLabel } from "./status";
import { budgetTotals, consumeMaterials, paidForBudget, useCollection, useStore } from "@/lib/store";
import { fmtQty, fromMin, mxn, today, toMin, uid } from "@/lib/format";
import type { Appointment, AppointmentStatus, Patient, Payment, PaymentMethod } from "@/lib/types";

/* ---------------- Paciente ---------------- */
export function PatientFormModal({ open, onClose, patient, onSaved }: {
  open: boolean; onClose: () => void; patient?: Patient; onSaved?: (p: Patient) => void;
}) {
  const { save } = useCollection("patients");
  const { toast } = useUI();
  const blank: Patient = { id: "", name: "", birthDate: "", phone: "", email: "", gender: undefined, allergies: "", conditions: "", notes: "", createdAt: today(), teeth: {}, clinicalNotes: [] };
  const [f, setF] = useState<Patient>(patient ?? blank);
  useEffect(() => { if (open) setF(patient ?? blank); }, [open, patient]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof Patient>(k: K, v: Patient[K]) => setF((x) => ({ ...x, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = { ...f, id: f.id || `p${uid()}`, name: f.name.trim() };
    save(p);
    toast(patient ? "Paciente actualizado" : "Paciente registrado");
    onSaved?.(p);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={patient ? "Editar paciente" : "Nuevo paciente"} subtitle="Datos generales e historia clínica básica" size="lg"
      footer={<><button type="button" className="btn-outline" onClick={onClose}>Cancelar</button><button form="patient-form" className="btn-primary">Guardar paciente</button></>}>
      <form id="patient-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="label sm:col-span-2">Nombre completo *<input required className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Nombre y apellidos" /></label>
        <label className="label">Teléfono *<input required className="input" type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="55 1234 5678" /></label>
        <label className="label">Correo<input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="correo@ejemplo.com" /></label>
        <label className="label">Fecha de nacimiento<input className="input" type="date" max={today()} value={f.birthDate} onChange={(e) => set("birthDate", e.target.value)} /></label>
        <label className="label">Sexo
          <select className="input" value={f.gender ?? ""} onChange={(e) => set("gender", (e.target.value || undefined) as Patient["gender"])}>
            <option value="">Sin especificar</option><option value="F">Femenino</option><option value="M">Masculino</option><option value="O">Otro</option>
          </select>
        </label>
        <label className="label">Alergias<input className="input" value={f.allergies} onChange={(e) => set("allergies", e.target.value)} placeholder="Ej. penicilina, látex" /></label>
        <label className="label">Padecimientos / antecedentes<input className="input" value={f.conditions} onChange={(e) => set("conditions", e.target.value)} placeholder="Ej. diabetes, hipertensión" /></label>
        <label className="label sm:col-span-2">Notas<textarea className="input min-h-[80px]" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Observaciones generales" /></label>
      </form>
    </Modal>
  );
}

/* ---------------- Cita ---------------- */
export function AppointmentFormModal({ open, onClose, appt, defaults }: {
  open: boolean; onClose: () => void; appt?: Appointment; defaults?: Partial<Appointment>;
}) {
  const { db } = useStore();
  const appts = useCollection("appointments");
  const { toast, confirm } = useUI();
  const [newPatient, setNewPatient] = useState(false);
  const blank = (): Appointment => ({
    id: "", patientId: db.patients[0]?.id ?? "", procedureId: db.procedures[0]?.id, treatment: db.procedures[0]?.name ?? "",
    date: today(), start: "09:00", durationMin: db.procedures[0]?.durationMin ?? 30, status: "pendiente", notes: "", ...defaults,
  });
  const [f, setF] = useState<Appointment>(appt ?? blank());
  useEffect(() => { if (open) setF(appt ?? blank()); }, [open, appt]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof Appointment>(k: K, v: Appointment[K]) => setF((x) => ({ ...x, [k]: v }));

  const overlap = db.appointments.find((a) =>
    a.id !== f.id && a.date === f.date && a.status !== "cancelada" &&
    toMin(a.start) < toMin(f.start) + f.durationMin && toMin(f.start) < toMin(a.start) + a.durationMin);

  const slots: string[] = [];
  for (let m = db.settings.startHour * 60; m < db.settings.endHour * 60; m += 15) slots.push(fromMin(m));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.patientId) return toast("Selecciona un paciente", "error");
    if (overlap && !(await confirm({ title: "Horario ocupado", text: `Se empalma con la cita de ${db.patients.find((p) => p.id === overlap.patientId)?.name} a las ${overlap.start}. ¿Agendar de todos modos?`, confirmLabel: "Agendar" }))) return;
    appts.save({ ...f, id: f.id || `a${uid()}` });
    toast(appt ? "Cita actualizada" : "Cita agendada");
    onClose();
  };
  const del = async () => {
    if (!appt) return;
    if (await confirm({ title: "Eliminar cita", text: "Esta acción no se puede deshacer.", danger: true, confirmLabel: "Eliminar" })) {
      appts.remove(appt.id); toast("Cita eliminada", "info"); onClose();
    }
  };

  return (
    <>
      <Modal open={open && !newPatient} onClose={onClose} title={appt ? "Editar cita" : "Nueva cita"} subtitle={appt ? db.patients.find((p) => p.id === appt.patientId)?.name : "Agenda un tratamiento"}
        footer={<>
          {appt && <button type="button" className="btn-ghost mr-auto text-danger" onClick={del}>Eliminar</button>}
          <button type="button" className="btn-outline" onClick={onClose}>Cancelar</button>
          <button form="appt-form" className="btn-primary">{appt ? "Guardar cambios" : "Agendar cita"}</button>
        </>}>
        <form id="appt-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="label sm:col-span-2">
            <span className="flex justify-between">Paciente *<button type="button" className="text-xs font-bold text-brand" onClick={() => setNewPatient(true)}>+ Nuevo paciente</button></span>
            <select required className="input" value={f.patientId} onChange={(e) => set("patientId", e.target.value)}>
              <option value="">Selecciona…</option>
              {[...db.patients].sort((a, b) => a.name.localeCompare(b.name)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <label className="label sm:col-span-2">Tratamiento
            <select className="input" value={f.procedureId ?? ""} onChange={(e) => {
              const p = db.procedures.find((x) => x.id === e.target.value);
              setF((x) => ({ ...x, procedureId: p?.id, treatment: p?.name ?? "Consulta", durationMin: p?.durationMin ?? x.durationMin }));
            }}>
              {db.procedures.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.durationMin} min</option>)}
              <option value="">Otro / consulta general</option>
            </select>
          </label>
          <label className="label">Fecha<input required type="date" className="input" value={f.date} onChange={(e) => set("date", e.target.value)} /></label>
          <label className="label">Hora
            <select className="input" value={f.start} onChange={(e) => set("start", e.target.value)}>
              {!slots.includes(f.start) && <option>{f.start}</option>}
              {slots.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="label">Duración
            <select className="input" value={f.durationMin} onChange={(e) => set("durationMin", +e.target.value)}>
              {[15, 30, 45, 60, 75, 90, 120, 150, 180].map((m) => <option key={m} value={m}>{m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ""}` : `${m} min`}</option>)}
            </select>
          </label>
          <label className="label">Estado
            <select className="input" value={f.status} onChange={(e) => set("status", e.target.value as AppointmentStatus)}>
              {(Object.keys(apptLabel) as AppointmentStatus[]).map((s) => <option key={s} value={s}>{apptLabel[s]}</option>)}
            </select>
          </label>
          <label className="label sm:col-span-2">Notas<textarea className="input min-h-[70px]" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Indicaciones, motivo de consulta…" /></label>
          {overlap && (
            <p className="flex items-center gap-2 rounded-xl bg-[#FDF1D8] p-3 text-sm text-[#855A06] sm:col-span-2">
              <AlertTriangle size={16} /> Se empalma con {db.patients.find((p) => p.id === overlap.patientId)?.name} ({overlap.start}, {overlap.durationMin} min)
            </p>
          )}
        </form>
      </Modal>
      <PatientFormModal open={newPatient} onClose={() => setNewPatient(false)} onSaved={(p) => set("patientId", p.id)} />
    </>
  );
}

/* ---------------- Pago ---------------- */
export function PaymentFormModal({ open, onClose, patientId, budgetId }: { open: boolean; onClose: () => void; patientId?: string; budgetId?: string }) {
  const { db } = useStore();
  const payments = useCollection("payments");
  const { toast } = useUI();
  const blank = (): Payment => ({ id: "", patientId: patientId ?? "", budgetId, amount: 0, method: "efectivo", date: today(), concept: "" });
  const [f, setF] = useState<Payment>(blank());
  useEffect(() => {
    if (!open) return;
    const b = blank();
    const bud = db.budgets.find((x) => x.id === budgetId);
    if (bud) { b.amount = Math.max(0, budgetTotals(bud).total - paidForBudget(db, bud.id)); b.concept = `Abono presupuesto #${bud.folio}`; }
    setF(b);
  }, [open, patientId, budgetId]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof Payment>(k: K, v: Payment[K]) => setF((x) => ({ ...x, [k]: v }));
  const patientBudgets = db.budgets.filter((b) => b.patientId === f.patientId && b.status !== "rechazado");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.patientId || f.amount <= 0) return toast("Indica paciente y monto", "error");
    payments.add({ ...f, id: `pay${uid()}`, concept: f.concept || "Pago de tratamiento", budgetId: f.budgetId || undefined });
    toast(`Pago de ${mxn(f.amount)} registrado`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Registrar pago" subtitle="Ingreso por tratamiento"
      footer={<><button type="button" className="btn-outline" onClick={onClose}>Cancelar</button><button form="pay-form" className="btn-primary">Registrar pago</button></>}>
      <form id="pay-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="label sm:col-span-2">Paciente *
          <select required className="input" value={f.patientId} onChange={(e) => setF((x) => ({ ...x, patientId: e.target.value, budgetId: undefined }))}>
            <option value="">Selecciona…</option>
            {[...db.patients].sort((a, b) => a.name.localeCompare(b.name)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="label sm:col-span-2">Aplicar a presupuesto
          <select className="input" value={f.budgetId ?? ""} onChange={(e) => set("budgetId", e.target.value || undefined)}>
            <option value="">Ninguno (pago suelto)</option>
            {patientBudgets.map((b) => { const owed = budgetTotals(b).total - paidForBudget(db, b.id); return (
              <option key={b.id} value={b.id}>#{b.folio} · {mxn(budgetTotals(b).total)} · resta {mxn(Math.max(0, owed))}</option>
            ); })}
          </select>
        </label>
        <label className="label">Monto *<input required type="number" min={1} className="input text-lg font-bold" value={f.amount || ""} onChange={(e) => set("amount", +e.target.value)} /></label>
        <label className="label">Fecha<input type="date" className="input" value={f.date} onChange={(e) => set("date", e.target.value)} /></label>
        <div className="label sm:col-span-2">Método
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(methodLabel) as PaymentMethod[]).map((m) => (
              <button type="button" key={m} onClick={() => set("method", m)} className={`btn border ${f.method === m ? "border-brand bg-brand-soft text-brand-dark" : "border-line bg-surface"}`}>{methodLabel[m]}</button>
            ))}
          </div>
        </div>
        <label className="label sm:col-span-2">Concepto<input className="input" value={f.concept} onChange={(e) => set("concept", e.target.value)} placeholder="Ej. Limpieza profunda" /></label>
      </form>
    </Modal>
  );
}

/* ---------------- Egreso / compra ---------------- */
export function ExpenseFormModal({ open, onClose, materialId }: { open: boolean; onClose: () => void; materialId?: string }) {
  const { db, update } = useStore();
  const { toast } = useUI();
  const blank = () => {
    const m = db.materials.find((x) => x.id === materialId);
    return { supplier: "", category: "Materiales dentales", materialId: materialId ?? "", qty: m ? Math.max(1, m.alertLevel * 2 - m.stock) : 1, cost: m?.lastCost ?? 0, amount: 0, invoice: "", date: today(), notes: "" };
  };
  const [f, setF] = useState(blank());
  useEffect(() => { if (open) setF(blank()); }, [open, materialId]); // eslint-disable-line react-hooks/exhaustive-deps
  const withMaterial = !!f.materialId;
  const total = withMaterial ? f.qty * f.cost : f.amount;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (total <= 0) return toast("El monto debe ser mayor a cero", "error");
    const mat = db.materials.find((m) => m.id === f.materialId);
    update((d) => ({
      ...d,
      materials: mat ? d.materials.map((m) => m.id === mat.id ? { ...m, stock: m.stock + f.qty, lastCost: f.cost } : m) : d.materials,
      expenses: [{
        id: `e${uid()}`, date: f.date, supplier: f.supplier || "Sin proveedor", category: f.category, amount: total,
        invoice: f.invoice || undefined, notes: f.notes || undefined, ...(mat ? { materialId: mat.id, qty: f.qty } : {}),
      }, ...d.expenses],
    }));
    toast(mat ? `Compra registrada: +${f.qty} ${mat.unit} de ${mat.name}` : `Egreso de ${mxn(total)} registrado`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo egreso / compra" subtitle="Si eliges un material, se suma al inventario"
      footer={<><button type="button" className="btn-outline" onClick={onClose}>Cancelar</button><button form="exp-form" className="btn-primary">Registrar {mxn(total)}</button></>}>
      <form id="exp-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="label">Proveedor<input className="input" list="suppliers" value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} placeholder="Ej. Depósito Dental" />
          <datalist id="suppliers">{[...new Set(db.expenses.map((x) => x.supplier))].map((s) => <option key={s} value={s} />)}</datalist>
        </label>
        <label className="label">Categoría
          <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {expenseCategories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="label sm:col-span-2">Material (opcional)
          <select className="input" value={f.materialId} onChange={(e) => { const m = db.materials.find((x) => x.id === e.target.value); setF({ ...f, materialId: e.target.value, cost: m?.lastCost ?? f.cost, category: m ? "Materiales dentales" : f.category }); }}>
            <option value="">— Gasto general, sin material —</option>
            {db.materials.map((m) => <option key={m.id} value={m.id}>{m.name} (stock {fmtQty(m.stock)} {m.unit})</option>)}
          </select>
        </label>
        {withMaterial ? (
          <>
            <label className="label">Cantidad<input type="number" min={1} className="input" value={f.qty} onChange={(e) => setF({ ...f, qty: Math.max(1, +e.target.value) })} /></label>
            <label className="label">Costo unitario<input type="number" min={0} className="input" value={f.cost} onChange={(e) => setF({ ...f, cost: +e.target.value })} /></label>
          </>
        ) : (
          <label className="label sm:col-span-2">Monto<input type="number" min={1} className="input text-lg font-bold" value={f.amount || ""} onChange={(e) => setF({ ...f, amount: +e.target.value })} /></label>
        )}
        <label className="label">Fecha<input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        <label className="label">Factura / referencia<input className="input" placeholder="FAC-0000" value={f.invoice} onChange={(e) => setF({ ...f, invoice: e.target.value })} /></label>
        <div className="flex items-center justify-between rounded-xl bg-navy p-4 text-white sm:col-span-2">
          <span className="text-sm text-[#B8C9DA]">Total</span><span className="text-2xl font-extrabold">{mxn(total)}</span>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- Cerrar consulta: cobro + plan + inventario + nota ---------------- */
export function CheckoutModal({ appt, onClose }: { appt?: Appointment; onClose: () => void }) {
  const { db, update, profile } = useStore();
  const { toast } = useUI();
  const patient = db.patients.find((p) => p.id === appt?.patientId);
  const [procId, setProcId] = useState("");
  const [charge, setCharge] = useState(true);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const [budgetId, setBudgetId] = useState("");
  const [doneItems, setDoneItems] = useState<string[]>([]);
  const [deduct, setDeduct] = useState(true);
  const [note, setNote] = useState("");

  // Conceptos pendientes de presupuestos aceptados del paciente
  const pendingItems = db.budgets
    .filter((b) => b.patientId === appt?.patientId && b.status === "aceptado")
    .flatMap((b) => b.items.filter((i) => !i.doneDate).map((i) => ({ ...i, budgetId: b.id, folio: b.folio })));

  useEffect(() => {
    if (!appt) return;
    const proc = db.procedures.find((p) => p.id === appt.procedureId);
    const match = pendingItems.filter((i) => i.procedureId === appt.procedureId);
    setProcId(appt.procedureId ?? "");
    setDoneItems(match.slice(0, 1).map((i) => i.id));
    setBudgetId(match[0]?.budgetId ?? "");
    setAmount(match[0] ? match[0].price * match[0].qty : proc?.price ?? 0);
    setCharge(true); setMethod("efectivo"); setDeduct(true);
    setNote(`Se realiza ${appt.treatment.toLowerCase()}.`);
  }, [appt?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!appt || !patient) return null;
  const toggleItem = (id: string) => setDoneItems((x) => x.includes(id) ? x.filter((y) => y !== id) : [...x, id]);
  const checked = pendingItems.filter((i) => doneItems.includes(i.id));
  // Materiales a descontar: los de los conceptos marcados o, si no hay, el tratamiento de la cita
  const uses: { procedureId: string; times: number }[] = checked.length
    ? checked.map((i) => ({ procedureId: i.procedureId, times: i.qty }))
    : procId ? [{ procedureId: procId, times: 1 }] : [];
  const preview = uses
    .flatMap(({ procedureId, times }) => (db.procedures.find((p) => p.id === procedureId)?.materials ?? []).map((m) => ({ ...m, qty: m.qty * times })))
    .reduce<{ materialId: string; qty: number }[]>((acc, m) => {
      const e = acc.find((x) => x.materialId === m.materialId);
      if (e) e.qty += m.qty; else acc.push({ ...m });
      return acc;
    }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = today();
    const proc = db.procedures.find((p) => p.id === procId);
    const teeth = { ...patient.teeth };
    checked.forEach((i) => { if (i.tooth) teeth[i.tooth] = i.procedureId === "extraccion" ? "ausente" : "tratado"; });
    update((d0) => {
      let d = {
        ...d0,
        appointments: d0.appointments.map((a) => a.id === appt.id
          ? { ...a, status: "completada" as const, procedureId: proc?.id ?? a.procedureId, treatment: proc?.name ?? a.treatment } : a),
        budgets: d0.budgets.map((b) => ({ ...b, items: b.items.map((i) => doneItems.includes(i.id) ? { ...i, doneDate: t } : i) })),
        patients: d0.patients.map((p) => p.id === patient.id ? {
          ...p, teeth,
          clinicalNotes: note.trim() ? [{ id: uid(), date: t, text: note.trim(), tooth: checked.find((i) => i.tooth)?.tooth, author: profile?.nombre ?? d0.settings.doctorName, createdAt: new Date().toISOString() }, ...p.clinicalNotes] : p.clinicalNotes,
        } : p),
      };
      if (deduct) uses.forEach((u) => { d = consumeMaterials(d, u.procedureId, u.times); });
      if (charge && amount > 0) {
        d = { ...d, payments: [{ id: `pay${uid()}`, patientId: patient.id, budgetId: budgetId || undefined, amount, method, date: t, concept: proc?.name ?? appt.treatment }, ...d.payments] };
      }
      return d;
    });
    const low = deduct && preview.some((m) => { const mat = db.materials.find((x) => x.id === m.materialId); return mat && mat.stock - m.qty < mat.alertLevel; });
    toast(charge && amount > 0 ? `Consulta cerrada · cobrado ${mxn(amount)}` : "Consulta cerrada");
    if (low) setTimeout(() => toast("Algún material quedó por debajo del mínimo", "error"), 300);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Cerrar consulta" subtitle={`${patient.name} · ${appt.start}`} size="lg"
      footer={<><button type="button" className="btn-outline" onClick={onClose}>Cancelar</button><button form="checkout-form" className="btn-primary"><CheckCircle2 size={18} /> Terminar{charge && amount > 0 ? ` y cobrar ${mxn(amount)}` : ""}</button></>}>
      <form id="checkout-form" onSubmit={submit} className="flex flex-col gap-5">
        <label className="label">Tratamiento realizado
          <select className="input" value={procId} onChange={(e) => { setProcId(e.target.value); if (!checked.length) setAmount(db.procedures.find((p) => p.id === e.target.value)?.price ?? 0); }}>
            {db.procedures.map((p) => <option key={p.id} value={p.id}>{p.name} · {mxn(p.price)}</option>)}
            <option value="">Consulta sin tratamiento</option>
          </select>
        </label>

        {pendingItems.length > 0 && (
          <div className="rounded-2xl border border-line p-4">
            <p className="mb-2 text-sm font-bold">Avance del plan de tratamiento</p>
            <div className="flex flex-col gap-1.5">
              {pendingItems.map((i) => (
                <label key={i.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-bg">
                  <input type="checkbox" className="h-4 w-4 accent-brand" checked={doneItems.includes(i.id)} onChange={() => toggleItem(i.id)} />
                  <span className="flex-1">{i.name}{i.tooth ? ` · diente ${i.tooth}` : ""}{i.qty > 1 ? ` ×${i.qty}` : ""}</span>
                  <span className="text-xs text-muted">#{i.folio}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-bg p-4">
          <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm font-bold"><input type="checkbox" className="h-4 w-4 accent-brand" checked={charge} onChange={(e) => setCharge(e.target.checked)} /> Registrar cobro</label>
          {charge && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="label">Monto<input type="number" min={0} className="input text-lg font-bold" value={amount || ""} onChange={(e) => setAmount(+e.target.value)} /></label>
              <label className="label">Aplicar a presupuesto
                <select className="input" value={budgetId} onChange={(e) => setBudgetId(e.target.value)}>
                  <option value="">Ninguno</option>
                  {db.budgets.filter((b) => b.patientId === patient.id && b.status === "aceptado").map((b) => (
                    <option key={b.id} value={b.id}>#{b.folio} · resta {mxn(Math.max(0, budgetTotals(b).total - paidForBudget(db, b.id)))}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                {(Object.keys(methodLabel) as PaymentMethod[]).map((m) => (
                  <button type="button" key={m} onClick={() => setMethod(m)} className={`btn border ${method === m ? "border-brand bg-brand-soft text-brand-dark" : "border-line bg-surface"}`}>{methodLabel[m]}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-line p-4">
          <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-bold"><input type="checkbox" className="h-4 w-4 accent-brand" checked={deduct} onChange={(e) => setDeduct(e.target.checked)} /> Descontar materiales del inventario</label>
          {preview.length ? (
            <ul className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
              {preview.map((m) => { const mat = db.materials.find((x) => x.id === m.materialId); return mat && (
                <li key={m.materialId} className={`flex justify-between gap-2 ${deduct ? "" : "opacity-50"}`}><span className="truncate">{mat.name}</span><b className="whitespace-nowrap">−{fmtQty(m.qty)} {mat.unit}</b></li>
              ); })}
            </ul>
          ) : <p className="text-xs text-muted">Este tratamiento no tiene materiales configurados (Configuración › Tratamientos).</p>}
        </div>

        <label className="label">Nota clínica<textarea className="input min-h-[80px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Evolución, indicaciones, próxima cita…" /></label>
      </form>
    </Modal>
  );
}
