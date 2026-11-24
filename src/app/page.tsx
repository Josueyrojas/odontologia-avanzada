"use client";
import Link from "next/link";
import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { AlertTriangle, ArrowRight, CalendarCheck, CalendarPlus, CircleDollarSign, FilePlus2, TrendingUp, UserPlus, Users, Wallet } from "lucide-react";
import { useStore, budgetTotals, patientBalance, useCollection } from "@/lib/store";
import { addDays, fmtLong, fmtQty, greeting, monthKey, mxn, nowTime, toMin, today } from "@/lib/format";
import { Avatar, EmptyState, StatCard, useUI } from "@/components/ui";
import type { Appointment } from "@/lib/types";
import { apptBadge, apptLabel, budgetBadge, budgetLabel } from "@/components/status";
import { AppointmentFormModal, CheckoutModal, PatientFormModal, PaymentFormModal } from "@/components/forms";

export default function Dashboard() {
  const { db, role } = useStore();
  const appts = useCollection("appointments");
  const { toast } = useUI();
  const [modal, setModal] = useState<"cita" | "paciente" | "pago" | null>(null);
  const [checkout, setCheckout] = useState<Appointment | undefined>();
  const t = today();
  const mk = monthKey(t);

  const todays = db.appointments.filter((a) => a.date === t && a.status !== "cancelada").sort((a, b) => a.start.localeCompare(b.start));
  const done = todays.filter((a) => a.status === "completada").length;
  const nowM = toMin(nowTime());
  const next = todays.find((a) => !["completada", "en_sala"].includes(a.status) && toMin(a.start) + a.durationMin > nowM);

  const incomeMonth = db.payments.filter((p) => monthKey(p.date) === mk).reduce((a, p) => a + p.amount, 0);
  const incomeToday = db.payments.filter((p) => p.date === t).reduce((a, p) => a + p.amount, 0);
  const expMonth = db.expenses.filter((e) => monthKey(e.date) === mk).reduce((a, e) => a + e.amount, 0);
  const owed = db.patients.reduce((a, p) => a + patientBalance(db, p.id), 0);
  const lowStock = db.materials.filter((m) => m.stock < m.alertLevel);
  const openBudgets = db.budgets.filter((b) => b.status === "enviado" || b.status === "borrador");

  // últimos 7 días de ingresos
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(t, i - 6);
    return { d: shortDay(d), v: db.payments.filter((p) => p.date === d).reduce((a, p) => a + p.amount, 0) };
  });
  const upcoming = db.appointments.filter((a) => a.date > t && a.date <= addDays(t, 7) && a.status !== "cancelada")
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).slice(0, 5);
  const name = (id: string) => db.patients.find((p) => p.id === id)?.name ?? "Paciente";

  return (
    <>
      <div className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-navy via-navy-700 to-[#0E4D57] p-6 text-white md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm font-semibold capitalize text-[#9FD9C0]">{fmtLong(t)}</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl">{greeting()}, {db.settings.doctorName.split(" ").slice(0, 2).join(" ")} 👋</h1>
            <p className="mt-2 max-w-lg text-sm text-[#B8C9DA]">
              Hoy tienes <b className="text-white">{todays.length} citas</b>{done ? `, ${done} ya atendidas` : ""}.
              {next ? <> La siguiente es <b className="text-white">{name(next.patientId)}</b> a las <b className="text-white">{next.start}</b>.</> : " No hay más citas pendientes hoy."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn bg-white/10 text-white hover:bg-white/20" onClick={() => setModal("paciente")}><UserPlus size={18} /> Paciente</button>
            <button className="btn bg-white/10 text-white hover:bg-white/20" onClick={() => setModal("pago")}><CircleDollarSign size={18} /> Cobrar</button>
            <button className="btn-primary" onClick={() => setModal("cita")}><CalendarPlus size={18} /> Nueva cita</button>
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Citas de hoy" value={`${done}/${todays.length}`} note="atendidas" icon={CalendarCheck} />
        <StatCard label="Cobrado hoy" value={mxn(incomeToday)} note={`${mxn(incomeMonth)} en el mes`} icon={Wallet} />
        {role !== "recepcion" && <StatCard label="Utilidad del mes" value={mxn(incomeMonth - expMonth)} note={`Egresos ${mxn(expMonth)}`} icon={TrendingUp} tone={incomeMonth - expMonth >= 0 ? "green" : "red"} />}
        <StatCard label="Por cobrar" value={mxn(owed)} note="presupuestos aceptados" icon={CircleDollarSign} tone={owed ? "amber" : "white"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
        <section className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Agenda de hoy</h2>
            <Link href="/agenda" className="flex items-center gap-1 text-sm font-bold text-brand hover:underline">Ver agenda <ArrowRight size={14} /></Link>
          </div>
          {todays.length ? (
            <ol className="relative space-y-2 before:absolute before:bottom-3 before:left-[46px] before:top-3 before:w-0.5 before:bg-line">
              {todays.map((a) => {
                const isNext = a.id === next?.id;
                return (
                  <li key={a.id} className={`relative flex items-center gap-3 rounded-2xl p-2.5 transition ${isNext ? "bg-brand-soft ring-1 ring-brand/30" : "hover:bg-bg"}`}>
                    <span className="w-10 text-right text-xs font-bold text-muted">{a.start}</span>
                    <span className={`relative z-10 h-3 w-3 rounded-full ring-4 ring-surface ${a.status === "completada" ? "bg-navy-300" : a.status === "urgencia" ? "bg-danger" : isNext ? "bg-brand" : "bg-[#3A7BD5]"}`} />
                    <Avatar name={name(a.patientId)} size={36} />
                    <Link href={`/pacientes/${a.patientId}`} className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{name(a.patientId)}</p>
                      <p className="truncate text-xs text-muted">{a.treatment} · {a.durationMin} min</p>
                    </Link>
                    {["pendiente", "confirmada", "urgencia"].includes(a.status) ? (
                      <button className="btn-primary btn-sm" onClick={() => { appts.patch(a.id, { status: "en_sala", arrivedAt: nowTime() }); toast(`${name(a.patientId)} en sala`); }}>Llegó</button>
                    ) : a.status === "en_sala" ? (
                      <button className="btn-dark btn-sm" onClick={() => setCheckout(a)}>Terminar</button>
                    ) : <span className={`badge ${apptBadge[a.status]}`}>{apptLabel[a.status]}</span>}
                  </li>
                );
              })}
            </ol>
          ) : <EmptyState icon={CalendarCheck} title="Sin citas hoy" text="Aprovecha para dar seguimiento a presupuestos pendientes." action={<button className="btn-primary" onClick={() => setModal("cita")}>Agendar cita</button>} />}
        </section>

        <div className="flex flex-col gap-5">
          <section className="card">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-bold">Ingresos últimos 7 días</h2>
              <span className="text-sm font-bold text-brand">{mxn(week.reduce((a, x) => a + x.v, 0))}</span>
            </div>
            <div className="h-36">
              <ResponsiveContainer>
                <AreaChart data={week} margin={{ top: 10, left: 0, right: 0, bottom: 0 }}>
                  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#12A36A" stopOpacity={0.35} /><stop offset="1" stopColor="#12A36A" stopOpacity={0} /></linearGradient></defs>
                  <XAxis dataKey="d" tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip formatter={(v: number) => mxn(v)} labelStyle={{ fontWeight: 700 }} contentStyle={{ borderRadius: 12, border: "1px solid #E4EBF2" }} />
                  <Area type="monotone" dataKey="v" name="Ingresos" stroke="#12A36A" strokeWidth={3} fill="url(#g)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {lowStock.length > 0 && (
            <section className="card border border-[#F5C9C3]">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><AlertTriangle size={18} className="text-danger" /> Inventario en alerta</h2>
              <ul className="space-y-2">
                {lowStock.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 text-sm">
                    <span className="flex-1 font-semibold">{m.name}</span>
                    <span className="h-2 w-20 overflow-hidden rounded-full bg-bg"><span className="block h-full bg-danger" style={{ width: `${Math.min(100, (m.stock / m.alertLevel) * 100)}%` }} /></span>
                    <span className="w-16 text-right text-muted">{fmtQty(m.stock)} {m.unit}</span>
                  </li>
                ))}
              </ul>
              <Link href="/inventario" className="btn-outline mt-4 w-full">Registrar compra</Link>
            </section>
          )}

          <section className="card">
            <h2 className="mb-3 text-lg font-bold">Próximos 7 días</h2>
            {upcoming.length ? upcoming.map((a) => (
              <div key={a.id} className="flex items-center gap-3 border-t border-line py-2.5 first:border-0">
                <div className="w-12 rounded-xl bg-bg py-1 text-center">
                  <p className="text-[10px] font-bold uppercase text-muted">{shortDay(a.date)}</p>
                  <p className="text-sm font-extrabold">{a.date.slice(8)}</p>
                </div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{name(a.patientId)}</p><p className="text-xs text-muted">{a.start} · {a.treatment}</p></div>
                <span className={`badge ${apptBadge[a.status]}`}>{apptLabel[a.status]}</span>
              </div>
            )) : <p className="text-sm text-muted">Sin citas próximas.</p>}
          </section>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Presupuestos por cerrar</h2>
            <Link href="/presupuestos" className="flex items-center gap-1 text-sm font-bold text-brand hover:underline"><FilePlus2 size={14} /> Ver todos</Link>
          </div>
          {openBudgets.length ? openBudgets.slice(0, 5).map((b) => (
            <Link key={b.id} href={`/presupuestos/${b.id}`} className="row-hover -mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5">
              <Avatar name={name(b.patientId)} size={34} />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{name(b.patientId)}</p><p className="text-xs text-muted">Folio #{b.folio} · {b.items.length} conceptos</p></div>
              <span className={`badge ${budgetBadge[b.status]}`}>{budgetLabel[b.status]}</span>
              <b className="w-24 text-right text-sm">{mxn(budgetTotals(b).total)}</b>
            </Link>
          )) : <p className="text-sm text-muted">No hay presupuestos abiertos.</p>}
        </section>
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Pacientes recientes</h2>
            <Link href="/pacientes" className="flex items-center gap-1 text-sm font-bold text-brand hover:underline"><Users size={14} /> {db.patients.length} pacientes</Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[...db.patients].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6).map((p) => (
              <Link key={p.id} href={`/pacientes/${p.id}`} className="card-hover flex flex-col items-center gap-2 rounded-2xl border border-line p-3 text-center">
                <Avatar name={p.name} size={42} />
                <span className="line-clamp-2 text-xs font-bold">{p.name}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <CheckoutModal appt={checkout} onClose={() => setCheckout(undefined)} />
      <AppointmentFormModal open={modal === "cita"} onClose={() => setModal(null)} />
      <PatientFormModal open={modal === "paciente"} onClose={() => setModal(null)} />
      <PaymentFormModal open={modal === "pago"} onClose={() => setModal(null)} />
    </>
  );
}

function shortDay(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("es-MX", { weekday: "short" }).replace(".", "");
}
