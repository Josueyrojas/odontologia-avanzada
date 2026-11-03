"use client";
import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { Modal, useUI } from "./ui";
import { Logo } from "./Logo";
import { nextConsentFolio, useCollection, useStore } from "@/lib/store";
import { age, fmtDate, today, uid } from "@/lib/format";
import type { Consent, Patient } from "@/lib/types";

/* ---------------- Panel de firma ---------------- */
export function SignaturePad({ onChange, height = 180 }: { onChange: (dataUrl: string) => void; height?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = canvas.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * dpr;
    c.height = height * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#0F2A44";
  }, [height]);

  const pos = (e: React.PointerEvent) => { const r = canvas.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  const down = (e: React.PointerEvent) => {
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = canvas.current!.getContext("2d")!; const [x, y] = pos(e);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.1, y + 0.1); ctx.stroke();
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvas.current!.getContext("2d")!; const [x, y] = pos(e);
    ctx.lineTo(x, y); ctx.stroke();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false; setEmpty(false);
    onChange(canvas.current!.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvas.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setEmpty(true); onChange("");
  };

  return (
    <div className="relative rounded-2xl border-2 border-dashed border-edge bg-white">
      <canvas ref={canvas} className="block w-full touch-none cursor-crosshair rounded-2xl" style={{ height }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} aria-label="Área de firma" />
      <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-[#C9D4DF]" />
      {empty && <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-[#9FB4C9]">Firme aquí con el dedo, stylus o mouse</p>}
      <button type="button" onClick={clear} className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-[#F3F6F9] px-2 py-1 text-xs font-semibold text-[#5B6B7B] hover:bg-[#E4EBF2]"><Eraser size={12} /> Limpiar</button>
    </div>
  );
}

/* ---------------- Plantillas ---------------- */
const intro = "Yo, {paciente}, en pleno uso de mis facultades, autorizo a {doctor} y a su equipo a realizar el procedimiento de {tratamiento}.";
const outro = "Declaro que se me explicó en lenguaje claro la naturaleza del procedimiento, sus beneficios, riesgos y alternativas; que tuve oportunidad de hacer preguntas y fueron respondidas a mi satisfacción; que proporcioné información veraz sobre mi estado de salud, y que puedo revocar este consentimiento en cualquier momento antes del procedimiento.";
export const consentTemplates: { id: string; title: string; treatment: string; body: string }[] = [
  {
    id: "general", title: "Consentimiento informado para tratamiento dental", treatment: "tratamiento dental general",
    body: `${intro}\n\nDescripción: procedimientos de diagnóstico, prevención y restauración (exploración, limpieza, resinas, radiografías) necesarios según el plan de tratamiento presentado.\n\nRiesgos posibles: sensibilidad dental transitoria, molestias en encías, reacciones a la anestesia local, necesidad de tratamientos adicionales si el daño es mayor al observado.\n\nAlternativas: no realizar el tratamiento, con el riesgo de progresión de la enfermedad.\n\n${outro}`,
  },
  {
    id: "anestesia", title: "Consentimiento para anestesia local", treatment: "aplicación de anestesia local",
    body: `${intro}\n\nDescripción: infiltración o bloqueo con anestésico local para eliminar el dolor durante el tratamiento.\n\nRiesgos posibles: dolor o hematoma en el sitio de punción, adormecimiento prolongado de labio o lengua, mordedura accidental mientras persiste el efecto, palpitaciones, reacción alérgica (rara) y lesión nerviosa transitoria (muy rara).\n\nMe comprometo a no masticar ni ingerir alimentos calientes hasta que desaparezca el efecto.\n\n${outro}`,
  },
  {
    id: "extraccion", title: "Consentimiento informado para extracción dental", treatment: "extracción dental",
    body: `${intro}\n\nDescripción: remoción de la(s) pieza(s) dental(es) indicada(s), que puede requerir separar raíces, levantar encía o retirar hueso.\n\nRiesgos posibles: dolor, inflamación, sangrado, hematoma, infección o alveolitis, limitación para abrir la boca, fractura de raíces o de la tabla ósea, comunicación con el seno maxilar (piezas superiores) y adormecimiento temporal o, rara vez, permanente de labio, lengua o mentón (piezas inferiores).\n\nAlternativas: tratamiento de conductos o restauración cuando sea viable; no tratar, con riesgo de infección.\n\nMe comprometo a seguir las indicaciones postoperatorias.\n\n${outro}`,
  },
  {
    id: "endodoncia", title: "Consentimiento informado para endodoncia", treatment: "tratamiento de conductos (endodoncia)",
    body: `${intro}\n\nDescripción: eliminación del tejido pulpar, limpieza, conformación y obturación de los conductos radiculares.\n\nRiesgos posibles: molestia o inflamación posterior, fractura de instrumentos dentro del conducto, perforación, imposibilidad de localizar o tratar todos los conductos, fractura de la pieza tratada y fracaso del tratamiento que requiera retratamiento, cirugía o extracción.\n\nEntiendo que el diente tratado puede requerir una corona para evitar su fractura.\n\nAlternativas: extracción de la pieza.\n\n${outro}`,
  },
  {
    id: "implante", title: "Consentimiento informado para implante dental", treatment: "colocación de implante dental",
    body: `${intro}\n\nDescripción: colocación quirúrgica de un implante de titanio en el hueso maxilar o mandibular; puede requerir injerto óseo y un periodo de integración de varios meses antes de la prótesis.\n\nRiesgos posibles: dolor, inflamación, hematoma, infección, falta de integración o pérdida del implante, lesión de dientes vecinos, afectación del nervio dentario (adormecimiento) o del seno maxilar.\n\nEntiendo que el tabaquismo, la diabetes no controlada, el bruxismo y la mala higiene aumentan el riesgo de fracaso.\n\nAlternativas: prótesis fija (puente) o removible, o no reponer la pieza.\n\n${outro}`,
  },
  {
    id: "blanqueamiento", title: "Consentimiento informado para blanqueamiento dental", treatment: "blanqueamiento dental",
    body: `${intro}\n\nDescripción: aplicación de un agente blanqueador (peróxido) sobre los dientes en consultorio y/o en casa.\n\nRiesgos posibles: sensibilidad dental temporal, irritación de encías, resultados variables según el tipo de mancha. Las resinas, coronas y carillas no cambian de color.\n\nEntiendo que el resultado no es permanente y depende de mis hábitos (café, té, vino, tabaco).\n\n${outro}`,
  },
  {
    id: "ortodoncia", title: "Consentimiento informado para ortodoncia", treatment: "tratamiento de ortodoncia",
    body: `${intro}\n\nDescripción: uso de aparatos fijos o removibles para corregir la posición de los dientes y la mordida, con citas periódicas de control.\n\nRiesgos posibles: molestias tras los ajustes, lesiones en mucosas, descalcificación o caries por higiene deficiente, reabsorción radicular, problemas de articulación temporomandibular y recidiva si no se usan los retenedores.\n\nEntiendo que la duración estimada puede variar y que mi cooperación es indispensable.\n\n${outro}`,
  },
];

const fill = (text: string, p: Patient, doctor: string, treatment: string) =>
  text.replaceAll("{paciente}", p.name).replaceAll("{doctor}", doctor).replaceAll("{tratamiento}", treatment);

/* ---------------- Modal para crear y firmar ---------------- */
export function ConsentModal({ open, onClose, patient, onSaved }: { open: boolean; onClose: () => void; patient: Patient; onSaved?: (c: Consent) => void }) {
  const { db } = useStore();
  const consents = useCollection("consents");
  const { toast } = useUI();
  const [tpl, setTpl] = useState(consentTemplates[0].id);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [signature, setSignature] = useState("");
  const [signer, setSigner] = useState("");
  const [witness, setWitness] = useState("");
  const [read, setRead] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const minor = patient.birthDate ? age(patient.birthDate) < 18 : false;

  const load = (id: string) => {
    const t = consentTemplates.find((x) => x.id === id)!;
    setTpl(id); setTitle(t.title); setBody(fill(t.body, patient, db.settings.doctorName, t.treatment));
  };
  useEffect(() => {
    if (!open) return;
    load(consentTemplates[0].id);
    setSignature(""); setSigner(minor ? "" : patient.name); setWitness(""); setRead(false); setStep(1);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    if (!signature) return toast("Falta la firma del paciente", "error");
    if (!signer.trim()) return toast("Indica el nombre de quien firma", "error");
    const c: Consent = { id: `cs${uid()}`, folio: nextConsentFolio(db), patientId: patient.id, date: today(), template: tpl, title, body, signature, signerName: signer.trim(), witness: witness.trim() || undefined };
    consents.add(c);
    toast("Consentimiento firmado y guardado");
    onSaved?.(c);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={step === 1 ? "Consentimiento informado" : "Firma del paciente"} subtitle={`${patient.name} · Paso ${step} de 2`} size="lg"
      footer={step === 1 ? (
        <><button className="btn-outline" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={!read} onClick={() => setStep(2)}>Continuar a firma</button></>
      ) : (
        <><button className="btn-outline mr-auto" onClick={() => setStep(1)}>Volver</button><button className="btn-primary" onClick={submit}>Guardar e imprimir</button></>
      )}>
      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <label className="label">Procedimiento
            <select className="input" value={tpl} onChange={(e) => load(e.target.value)}>
              {consentTemplates.map((t) => <option key={t.id} value={t.id}>{t.title.replace("Consentimiento informado para ", "").replace("Consentimiento para ", "")}</option>)}
            </select>
          </label>
          <label className="label">Título<input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="label">Texto (puedes ajustarlo antes de firmar)<textarea className="input min-h-[260px] text-sm leading-relaxed" value={body} onChange={(e) => setBody(e.target.value)} /></label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={read} onChange={(e) => setRead(e.target.checked)} />
            El paciente leyó el documento (o se le leyó) y sus dudas fueron resueltas.
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">Entrega el dispositivo al paciente para que firme.</p>
          <SignaturePad onChange={setSignature} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="label">{minor ? "Nombre del padre, madre o tutor *" : "Nombre de quien firma *"}<input className="input" value={signer} onChange={(e) => setSigner(e.target.value)} /></label>
            <label className="label">Testigo (opcional)<input className="input" value={witness} onChange={(e) => setWitness(e.target.value)} /></label>
          </div>
          {minor && <p className="rounded-xl bg-[#FDF1D8] p-3 text-sm text-[#855A06]">El paciente es menor de edad: debe firmar su madre, padre o tutor legal.</p>}
        </div>
      )}
    </Modal>
  );
}

/** Documento imprimible (solo visible al imprimir). */
export function ConsentPrint({ consent, patient }: { consent: Consent; patient: Patient }) {
  const { db } = useStore();
  const s = db.settings;
  return (
    <article className="hidden text-[12.5px] leading-relaxed text-black print:block">
      <header className="flex items-start justify-between border-b-2 border-navy pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand"><Logo size={26} /></div>
          <div><p className="text-xl font-extrabold text-navy">{s.clinicName}</p><p>{s.doctorName} · {s.specialty} · {s.license}</p><p className="text-xs">{s.address} · Tel. {s.phone}</p></div>
        </div>
        <div className="text-right"><p>Folio CI-{consent.folio}</p><p>{fmtDate(consent.date, { day: "numeric", month: "long", year: "numeric" })}</p></div>
      </header>
      <h1 className="my-4 text-center text-lg font-extrabold uppercase text-navy">{consent.title}</h1>
      <p className="mb-3"><b>Paciente:</b> {patient.name}{patient.birthDate ? ` · ${age(patient.birthDate)} años` : ""}{patient.allergies ? ` · Alergias: ${patient.allergies}` : ""}</p>
      {consent.body.split("\n").filter(Boolean).map((para, i) => <p key={i} className="mb-2 text-justify">{para}</p>)}
      <div className="mt-10 grid grid-cols-2 gap-12 text-center text-xs">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={consent.signature} alt="Firma" className="mx-auto h-24 object-contain" />
          <div className="border-t border-black pt-1">{consent.signerName}<br />{consent.signerName === patient.name ? "Paciente" : "Padre, madre o tutor"}</div>
        </div>
        <div className="flex flex-col justify-end">
          <div className="border-t border-black pt-1">{s.doctorName}<br />{s.license}</div>
        </div>
        {consent.witness && <div className="col-span-2 mx-auto mt-8 w-64 border-t border-black pt-1">Testigo: {consent.witness}</div>}
      </div>
    </article>
  );
}
