"use client";
import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Modal, useUI } from "./ui";
import { Logo } from "./Logo";
import { nextRxFolio, useCollection, useStore } from "@/lib/store";
import { age, fmtDate, today, uid } from "@/lib/format";
import type { MedicalHistory, Patient, Prescription, PrescriptionItem, RiskFlag } from "@/lib/types";

export const riskLabel: Record<RiskFlag, string> = {
  diabetes: "Diabetes", hipertension: "Hipertensión", cardiopatia: "Cardiopatía", coagulacion: "Trastorno de coagulación",
  embarazo: "Embarazo / lactancia", asma: "Asma", epilepsia: "Epilepsia", vih_hepatitis: "VIH / hepatitis",
  tabaquismo: "Tabaquismo", bruxismo: "Bruxismo", anticoagulantes: "Toma anticoagulantes", bifosfonatos: "Toma bifosfonatos",
};
/** Factores que cambian la conducta clínica (anestesia, extracciones, sangrado). */
const critical: RiskFlag[] = ["cardiopatia", "coagulacion", "embarazo", "anticoagulantes", "bifosfonatos", "hipertension", "diabetes"];
export const activeRisks = (p: Patient) =>
  (Object.keys(riskLabel) as RiskFlag[]).filter((k) => p.history?.flags[k]).sort((a, b) => +critical.includes(b) - +critical.includes(a));
export const isCritical = (k: RiskFlag) => critical.includes(k);

/* ---------------- Historia clínica ---------------- */
export function MedicalHistoryForm({ patient }: { patient: Patient }) {
  const patients = useCollection("patients");
  const { toast } = useUI();
  const blank: MedicalHistory = { flags: {} };
  const [h, setH] = useState<MedicalHistory>(patient.history ?? blank);
  const [allergies, setAllergies] = useState(patient.allergies ?? "");
  useEffect(() => { setH(patient.history ?? blank); setAllergies(patient.allergies ?? ""); }, [patient.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof MedicalHistory>(k: K, v: MedicalHistory[K]) => setH((x) => ({ ...x, [k]: v }));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const conditions = (Object.keys(riskLabel) as RiskFlag[]).filter((k) => h.flags[k] && k !== "bruxismo" && k !== "tabaquismo").map((k) => riskLabel[k]).join(", ");
    patients.patch(patient.id, { history: { ...h, updatedAt: today() }, allergies, conditions: conditions || patient.conditions });
    toast("Historia clínica guardada");
  };

  return (
    <form onSubmit={save} className="grid gap-5 xl:grid-cols-[3fr_2fr]">
      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-bold sm:col-span-2">Anamnesis</h2>
        <label className="label sm:col-span-2">Motivo de consulta<input className="input" value={h.reason ?? ""} onChange={(e) => set("reason", e.target.value)} placeholder="Ej. dolor en molar inferior" /></label>
        <label className="label">Alergias<input className="input" value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Medicamentos, látex, alimentos…" /></label>
        <label className="label">Tipo de sangre
          <select className="input" value={h.bloodType ?? ""} onChange={(e) => set("bloodType", e.target.value)}>
            <option value="">No sabe</option>{["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="label sm:col-span-2">Medicamentos actuales<textarea className="input min-h-[64px]" value={h.medications ?? ""} onChange={(e) => set("medications", e.target.value)} placeholder="Nombre, dosis y frecuencia" /></label>
        <label className="label sm:col-span-2">Cirugías u hospitalizaciones<input className="input" value={h.surgeries ?? ""} onChange={(e) => set("surgeries", e.target.value)} /></label>
        <label className="label">Presión arterial<input className="input" value={h.bloodPressure ?? ""} onChange={(e) => set("bloodPressure", e.target.value)} placeholder="120/80" /></label>
        <label className="label">Última visita al dentista<input className="input" value={h.lastDentalVisit ?? ""} onChange={(e) => set("lastDentalVisit", e.target.value)} placeholder="Ej. hace 1 año" /></label>
        <div className="label sm:col-span-2">Higiene oral
          <div className="grid grid-cols-3 gap-2">
            {(["buena", "regular", "mala"] as const).map((v) => (
              <button type="button" key={v} onClick={() => set("hygiene", v)} className={`btn border capitalize ${h.hygiene === v ? "border-brand bg-brand-soft text-brand-dark" : "border-line bg-surface"}`}>{v}</button>
            ))}
          </div>
        </div>
      </section>
      <section className="card flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold">Antecedentes y factores de riesgo</h2>
          <p className="text-sm text-muted">Los marcados en rojo aparecen como alerta en el expediente y la agenda.</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(riskLabel) as RiskFlag[]).map((k) => {
            const on = !!h.flags[k];
            return (
              <label key={k} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition ${on ? (isCritical(k) ? "border-danger bg-[#FBE3E0] font-semibold text-[#9E2A20]" : "border-warn bg-[#FDF1D8] font-semibold text-[#855A06]") : "border-line hover:bg-bg"}`}>
                <input type="checkbox" className="h-4 w-4 accent-brand" checked={on} onChange={(e) => set("flags", { ...h.flags, [k]: e.target.checked })} />
                {riskLabel[k]}
              </label>
            );
          })}
        </div>
        {patient.history?.updatedAt && <p className="text-xs text-muted">Última actualización: {fmtDate(patient.history.updatedAt)}</p>}
        <button className="btn-primary mt-auto"><Save size={18} /> Guardar historia clínica</button>
      </section>
    </form>
  );
}

/* ---------------- Recetas ---------------- */
const commonDrugs: PrescriptionItem[] = [
  { drug: "Ibuprofeno 400 mg tabletas", dose: "1 tableta", frequency: "cada 8 horas", duration: "3 días" },
  { drug: "Paracetamol 500 mg tabletas", dose: "1 tableta", frequency: "cada 6 horas", duration: "3 días" },
  { drug: "Ketorolaco 10 mg tabletas", dose: "1 tableta", frequency: "cada 8 horas", duration: "3 días" },
  { drug: "Amoxicilina 500 mg cápsulas", dose: "1 cápsula", frequency: "cada 8 horas", duration: "7 días" },
  { drug: "Clindamicina 300 mg cápsulas", dose: "1 cápsula", frequency: "cada 8 horas", duration: "7 días" },
  { drug: "Clorhexidina 0.12% enjuague", dose: "15 ml", frequency: "cada 12 horas", duration: "10 días" },
];

export function PrescriptionModal({ open, onClose, patient, onSaved }: { open: boolean; onClose: () => void; patient: Patient; onSaved?: (rx: Prescription) => void }) {
  const { db } = useStore();
  const rxs = useCollection("prescriptions");
  const { toast } = useUI();
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [indications, setIndications] = useState("");
  useEffect(() => { if (open) { setItems([{ drug: "", dose: "", frequency: "", duration: "" }]); setIndications(""); } }, [open]);
  const setRow = (i: number, ch: Partial<PrescriptionItem>) => setItems(items.map((x, j) => j === i ? { ...x, ...ch } : x));
  const addCommon = (d: PrescriptionItem) => setItems([...items.filter((x) => x.drug.trim()), d]);
  const allergy = patient.allergies?.toLowerCase().trim();
  const clash = allergy ? items.find((i) => allergy.split(/[,\s]+/).some((w) => w.length > 3 && i.drug.toLowerCase().includes(w.slice(0, 5)))) : undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const valid = items.filter((i) => i.drug.trim());
    if (!valid.length) return toast("Agrega al menos un medicamento", "error");
    const rx: Prescription = { id: `rx${uid()}`, folio: nextRxFolio(db), patientId: patient.id, date: today(), items: valid, indications: indications.trim() || undefined };
    rxs.add(rx);
    toast(`Receta #${rx.folio} creada`);
    onSaved?.(rx);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Nueva receta" subtitle={patient.name} size="lg"
      footer={<><button type="button" className="btn-outline" onClick={onClose}>Cancelar</button><button form="rx-form" className="btn-primary">Guardar e imprimir</button></>}>
      <form id="rx-form" onSubmit={submit} className="flex flex-col gap-4">
        {patient.allergies && <p className="rounded-xl bg-[#FBE3E0] p-3 text-sm font-semibold text-[#9E2A20]">⚠ Alergias: {patient.allergies}</p>}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Frecuentes</p>
          <div className="flex flex-wrap gap-1.5">
            {commonDrugs.map((d) => <button type="button" key={d.drug} className="btn btn-sm border border-line bg-surface hover:bg-bg" onClick={() => addCommon(d)}>+ {d.drug.split(" ").slice(0, 2).join(" ")}</button>)}
          </div>
        </div>
        {items.map((it, i) => (
          <div key={i} className="grid gap-2 rounded-2xl border border-line p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
            <input aria-label="Medicamento" className="input" placeholder="Medicamento y presentación" value={it.drug} onChange={(e) => setRow(i, { drug: e.target.value })} />
            <input aria-label="Dosis" className="input" placeholder="Dosis" value={it.dose} onChange={(e) => setRow(i, { dose: e.target.value })} />
            <input aria-label="Frecuencia" className="input" placeholder="Frecuencia" value={it.frequency} onChange={(e) => setRow(i, { frequency: e.target.value })} />
            <input aria-label="Duración" className="input" placeholder="Duración" value={it.duration} onChange={(e) => setRow(i, { duration: e.target.value })} />
            <button type="button" aria-label="Quitar" className="icon-btn self-center hover:text-danger" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
          </div>
        ))}
        <button type="button" className="btn-outline self-start" onClick={() => setItems([...items, { drug: "", dose: "", frequency: "", duration: "" }])}><Plus size={16} /> Otro medicamento</button>
        {clash && <p className="rounded-xl bg-[#FDF1D8] p-3 text-sm text-[#855A06]">Revisa: <b>{clash.drug}</b> podría coincidir con la alergia registrada.</p>}
        <label className="label">Indicaciones generales<textarea className="input min-h-[80px]" value={indications} onChange={(e) => setIndications(e.target.value)} placeholder="Cuidados, dieta, signos de alarma…" /></label>
      </form>
    </Modal>
  );
}

/** Hoja de receta para imprimir (solo visible al imprimir). */
export function PrescriptionPrint({ rx, patient }: { rx: Prescription; patient: Patient }) {
  const { db } = useStore();
  const s = db.settings;
  return (
    <article className="hidden text-[13px] text-black print:block">
      <header className="flex items-start justify-between border-b-2 border-navy pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand"><Logo size={26} /></div>
          <div><p className="text-xl font-extrabold text-navy">{s.doctorName}</p><p>{s.specialty} · {s.license}</p><p className="text-xs">{s.clinicName} · {s.address} · Tel. {s.phone}</p></div>
        </div>
        <div className="text-right"><p className="text-lg font-extrabold text-navy">RECETA MÉDICA</p><p>Folio #{rx.folio}</p><p>{fmtDate(rx.date, { day: "numeric", month: "long", year: "numeric" })}</p></div>
      </header>
      <section className="my-4 grid grid-cols-3 gap-2 rounded-lg bg-bg p-3">
        <p className="col-span-2"><b>Paciente:</b> {patient.name}</p>
        <p><b>Edad:</b> {patient.birthDate ? `${age(patient.birthDate)} años` : "—"}</p>
        {patient.allergies && <p className="col-span-3"><b>Alergias:</b> {patient.allergies}</p>}
      </section>
      <p className="mb-2 text-2xl font-extrabold text-navy">Rx</p>
      <ol className="space-y-3">
        {rx.items.map((i, n) => (
          <li key={n} className="border-b border-line pb-2"><p className="font-bold">{n + 1}. {i.drug}</p><p>{[i.dose, i.frequency, i.duration && `durante ${i.duration}`].filter(Boolean).join(", ")}.</p></li>
        ))}
      </ol>
      {rx.indications && <p className="mt-4 rounded-lg border border-line p-3"><b>Indicaciones:</b> {rx.indications}</p>}
      <div className="mt-20 flex justify-end"><div className="w-64 border-t border-black pt-1 text-center text-xs">{s.doctorName}<br />{s.license}</div></div>
    </article>
  );
}
