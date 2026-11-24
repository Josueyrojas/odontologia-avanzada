"use client";
// Recibo de pago: se imprime (solo el recibo) o se envía por WhatsApp.
import { MessageCircle, Printer } from "lucide-react";
import { Modal } from "./ui";
import { Logo } from "./Logo";
import { methodLabel } from "./status";
import { budgetTotals, useStore } from "@/lib/store";
import { fmtDate, mxn, whatsappLink } from "@/lib/format";
import { montoEnLetra } from "@/lib/letras";
import type { Payment } from "@/lib/types";

/** Folio visible: consecutivo si lo tiene; los pagos anteriores al folio usan parte de su identificador. */
export const receiptFolio = (p: Payment) => (p.folio ? `R-${String(p.folio).padStart(5, "0")}` : `R-${p.id.slice(-5).toUpperCase()}`);

export function ReceiptModal({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  const { db } = useStore();
  if (!payment) return null;
  const s = db.settings;
  const patient = db.patients.find((p) => p.id === payment.patientId);
  const budget = db.budgets.find((b) => b.id === payment.budgetId);
  // Saldo del presupuesto después de este pago (incluye pagos anteriores, no posteriores)
  const paidUntil = budget ? db.payments.filter((x) => x.budgetId === budget.id && (x.date < payment.date || (x.date === payment.date && (x.folio ?? 0) <= (payment.folio ?? 0)))).reduce((a, x) => a + x.amount, 0) : 0;
  const balance = budget ? Math.max(0, budgetTotals(budget).total - Math.max(paidUntil, payment.amount)) : 0;
  const folio = receiptFolio(payment);

  const wa = [
    `*Recibo de pago ${folio}* — ${s.clinicName}`,
    `Paciente: ${patient?.name ?? ""}`,
    `Fecha: ${fmtDate(payment.date, { day: "numeric", month: "long", year: "numeric" })}`,
    `Concepto: ${payment.concept}`,
    `Monto: *${mxn(payment.amount)}* (${methodLabel[payment.method].toLowerCase()})`,
    budget ? `Presupuesto #${budget.folio}: saldo pendiente ${mxn(balance)}` : "",
    "", "¡Gracias por su pago! 🦷",
  ].filter((l, i, a) => l || a[i - 1]).join("\n");

  return (
    <Modal open onClose={onClose} title={`Recibo ${folio}`} subtitle={patient?.name} printable
      footer={<>
        <button className="btn-outline mr-auto" onClick={onClose}>Cerrar</button>
        {patient?.phone && <a className="btn-outline" target="_blank" rel="noreferrer" href={whatsappLink(patient.phone, wa)}><MessageCircle size={18} /> WhatsApp</a>}
        <button className="btn-dark" onClick={() => window.print()}><Printer size={18} /> Imprimir</button>
      </>}>
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-6 text-[13px] text-[#13202D] print:max-w-none print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-4 border-b-2 border-[#0F2A44] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#12A36A]"><Logo size={20} /></div>
            <div>
              <p className="text-base font-extrabold text-[#0F2A44]">{s.clinicName}</p>
              <p className="text-[11px] text-[#5B6B7B]">{s.doctorName}{s.rfc ? ` · RFC ${s.rfc}` : ""}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wider text-[#5B6B7B]">Recibo</p>
            <p className="font-mono text-sm font-bold">{folio}</p>
          </div>
        </header>
        <dl className="my-4 grid grid-cols-[110px_1fr] gap-y-1.5">
          <dt className="text-[#5B6B7B]">Fecha</dt><dd>{fmtDate(payment.date, { day: "numeric", month: "long", year: "numeric" })}</dd>
          <dt className="text-[#5B6B7B]">Recibí de</dt><dd className="font-semibold">{patient?.name ?? "—"}</dd>
          <dt className="text-[#5B6B7B]">Concepto</dt><dd>{payment.concept}</dd>
          <dt className="text-[#5B6B7B]">Forma de pago</dt><dd>{methodLabel[payment.method]}</dd>
        </dl>
        <div className="rounded-xl bg-[#EEF8F3] p-4 text-center">
          <p className="text-3xl font-extrabold tracking-tight text-[#0A6B46]">{mxn(payment.amount)}</p>
          <p className="mt-1 text-[11px] font-semibold text-[#0A6B46]">({montoEnLetra(payment.amount)})</p>
        </div>
        {budget && (
          <div className="mt-3 flex justify-between rounded-xl border border-[#E4EBF2] px-4 py-2.5 text-xs">
            <span>Presupuesto #{budget.folio} · total {mxn(budgetTotals(budget).total)}</span>
            <b>Saldo: {mxn(balance)}</b>
          </div>
        )}
        <div className="mt-10 flex justify-center">
          <div className="w-56 border-t border-black pt-1 text-center text-[11px]">Recibió: {s.doctorName}</div>
        </div>
        <p className="mt-6 text-center text-[10px] text-[#8A99A8]">{s.address}{s.phone ? ` · Tel. ${s.phone}` : ""}<br />Este recibo no es un comprobante fiscal (CFDI).</p>
      </div>
    </Modal>
  );
}

