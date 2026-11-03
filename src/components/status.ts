import type { AppointmentStatus, BudgetStatus, PaymentMethod } from "@/lib/types";

export const apptLabel: Record<AppointmentStatus, string> = {
  pendiente: "Pendiente", confirmada: "Confirmada", en_sala: "En sala", urgencia: "Urgencia", completada: "Completada", cancelada: "Cancelada",
};
/** Bloque de calendario: fondo suave + barra lateral de color. */
export const apptBlock: Record<AppointmentStatus, string> = {
  confirmada: "bg-[#E3F5EC] shadow-[inset_4px_0_0_#12A36A]",
  en_sala: "bg-[#FDF1D8] shadow-[inset_4px_0_0_#F2B33D]",
  urgencia: "bg-[#FBE3E0] shadow-[inset_4px_0_0_#D9483B]",
  pendiente: "bg-[#E6EEF8] shadow-[inset_4px_0_0_#3A7BD5]",
  completada: "bg-[#EEF2F6] shadow-[inset_4px_0_0_#9FB4C9] text-muted",
  cancelada: "bg-surface shadow-[inset_4px_0_0_#C9D4DF] text-muted line-through opacity-70",
};
export const apptBadge: Record<AppointmentStatus, string> = {
  confirmada: "bg-brand-soft text-brand-dark",
  en_sala: "bg-[#FDF1D8] text-[#855A06]",
  urgencia: "bg-[#FBE3E0] text-[#9E2A20]",
  pendiente: "bg-[#E6EEF8] text-[#22508F]",
  completada: "bg-[#EEF2F6] text-muted",
  cancelada: "bg-[#EEF2F6] text-muted line-through",
};

export const budgetLabel: Record<BudgetStatus, string> = { borrador: "Borrador", enviado: "Enviado", aceptado: "Aceptado", rechazado: "Rechazado" };
export const budgetBadge: Record<BudgetStatus, string> = {
  borrador: "bg-[#EEF2F6] text-ink-soft",
  enviado: "bg-[#E6EEF8] text-[#22508F]",
  aceptado: "bg-brand-soft text-brand-dark",
  rechazado: "bg-[#FBE3E0] text-[#9E2A20]",
};

export const methodLabel: Record<PaymentMethod, string> = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia" };

export const expenseCategories = ["Materiales dentales", "Medicamentos", "Equipo", "Renta y servicios", "Nómina", "Laboratorio", "Publicidad", "Otros"];
