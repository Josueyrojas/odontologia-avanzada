"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, MessageCircle, Plus, ShieldAlert } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Avatar, EmptyState, useUI } from "@/components/ui";
import { AppointmentFormModal, CheckoutModal } from "@/components/forms";
import { activeRisks, riskLabel } from "@/components/clinical";
import { apptBadge, apptBlock, apptLabel } from "@/components/status";
import { professionalsOf, useCollection, useStore } from "@/lib/store";
import { addDays, fmtDate, fmtLong, fromMin, isPast, nowTime, parseDate, startOfWeek, today, toMin, whatsappLink } from "@/lib/format";
import type { Appointment, AppointmentStatus } from "@/lib/types";

const SLOT = 30, ROW_PX = 32;

export default function AgendaPage() {
  const { db } = useStore();
  const appts = useCollection("appointments");
  const { toast } = useUI();
  const [day, setDay] = useState(today());
  const [view, setView] = useState<"semana" | "dia">("semana");
  const [modal, setModal] = useState<{ appt?: Appointment; defaults?: Partial<Appointment> } | null>(null);
  const [checkout, setCheckout] = useState<Appointment | undefined>();
  const [filter, setFilter] = useState<AppointmentStatus | "todas">("todas");
  const [pro, setPro] = useState<string>("todos");
  const [now, setNow] = useState(nowTime());
  useEffect(() => { const i = setInterval(() => setNow(nowTime()), 60000); return () => clearInterval(i); }, []);
  useEffect(() => { if (window.innerWidth < 768) setView("dia"); }, []);

  const { startHour, endHour, workDays } = db.settings;
  const monday = startOfWeek(day);
  const days = view === "semana" ? Array.from({ length: workDays }, (_, i) => addDays(monday, i)) : [day];
  const slots = ((endHour - startHour) * 60) / SLOT;
  const t = today();
  const nowTop = ((toMin(now) - startHour * 60) / SLOT) * ROW_PX;
  const name = (id: string) => db.patients.find((p) => p.id === id)?.name ?? "Paciente";
  const phone = (id: string) => db.patients.find((p) => p.id === id)?.phone ?? "";
  const alerts = (id: string) => {
    const p = db.patients.find((x) => x.id === id);
    if (!p) return "";
    return [p.allergies && `Alergia: ${p.allergies}`, ...activeRisks(p).map((k) => riskLabel[k])].filter(Boolean).join(" · ");
  };
  const pros = professionalsOf(db.settings);
  const multi = pros.length > 1;
  // Las citas sin profesional asignado (anteriores a tener varios) cuentan como del primero
  const proOf = (a: Appointment) => pros.find((x) => x.id === a.professionalId) ?? pros[0];
  const byPro = (a: Appointment) => pro === "todos" || proOf(a).id === pro;
  const visible = (a: Appointment) => (filter === "todas" || a.status === filter) && byPro(a);

  const dayList = db.appointments.filter((a) => a.date === day && byPro(a)).sort((a, b) => a.start.localeCompare(b.start));
  const shift = (n: number) => setDay(addDays(day, view === "semana" ? n * 7 : n));
  const kicker = view === "semana"
    ? `Semana del ${fmtDate(days[0], { day: "numeric", month: "short" })} al ${fmtDate(days[days.length - 1], { day: "numeric", month: "short", year: "numeric" })}`
    : fmtLong(day);

  const setStatus = (a: Appointment, status: AppointmentStatus) => {
    appts.patch(a.id, { status, ...(status === "en_sala" ? { arrivedAt: nowTime() } : {}) });
    toast(`${name(a.patientId)}: ${apptLabel[status].toLowerCase()}`);
  };
  const remind = (a: Appointment) =>
    whatsappLink(phone(a.patientId), `Hola ${name(a.patientId).split(" ")[0]}, le recordamos su cita en ${db.settings.clinicName} el ${fmtLong(a.date)} a las ${a.start} (${a.treatment}). ¿Nos confirma su asistencia? 🦷`);

  // Agrupa citas empalmadas en columnas para que no se encimen
  const layout = (list: Appointment[]) => {
    const sorted = [...list].sort((a, b) => toMin(a.start) - toMin(b.start));
    const cols: number[] = []; const res = new Map<string, { col: number; cols: number }>();
    let group: Appointment[] = []; let groupEnd = 0;
    const flush = () => { const n = Math.max(1, ...group.map((g) => res.get(g.id)!.col + 1)); group.forEach((g) => (res.get(g.id)!.cols = n)); group = []; cols.length = 0; };
    for (const a of sorted) {
      const s = toMin(a.start), e = s + a.durationMin;
      if (group.length && s >= groupEnd) flush();
      let c = cols.findIndex((end) => end <= s); if (c === -1) { c = cols.length; cols.push(e); } else cols[c] = e;
      res.set(a.id, { col: c, cols: 1 }); group.push(a); groupEnd = Math.max(groupEnd, e);
    }
    if (group.length) flush();
    return res;
  };

  return (
    <>
      <PageHeader kicker={kicker} title="Agenda de Citas">
        <div className="flex rounded-xl border border-edge bg-surface p-1">
          {(["dia", "semana"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${view === v ? "bg-navy text-white" : "hover:bg-bg"}`}>{v === "dia" ? "Día" : "Semana"}</button>
          ))}
        </div>
        <button className="btn-outline px-3" aria-label="Anterior" onClick={() => shift(-1)}><ChevronLeft size={18} /></button>
        <button className="btn-outline" onClick={() => setDay(t)}>Hoy</button>
        <button className="btn-outline px-3" aria-label="Siguiente" onClick={() => shift(1)}><ChevronRight size={18} /></button>
        <input type="date" aria-label="Ir a fecha" className="input w-auto" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
        <button className="btn-primary" onClick={() => setModal({ defaults: { ...(pro !== "todos" ? { professionalId: pro } : {}), date: day < t ? t : day } })}><Plus size={18} /> Nueva cita</button>
      </PageHeader>

      <div className="grid gap-5 xl:grid-cols-[3fr_1.1fr]">
        <section className="card overflow-x-auto !p-4 md:!p-6">
          {multi && (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold uppercase tracking-wider text-muted">Profesional</span>
              <button onClick={() => setPro("todos")} className={`badge border ${pro === "todos" ? "border-navy bg-navy text-white" : "border-line bg-surface"}`}>Todos</button>
              {pros.map((x) => (
                <button key={x.id} onClick={() => setPro(pro === x.id ? "todos" : x.id)} className={`badge border ${pro === x.id ? "border-navy bg-navy text-white" : "border-line bg-surface"}`}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: x.color }} /> {x.name}
                </button>
              ))}
            </div>
          )}
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            <button onClick={() => setFilter("todas")} className={`badge border ${filter === "todas" ? "border-navy bg-navy text-white" : "border-line bg-surface"}`}>Todas</button>
            {(Object.keys(apptLabel) as AppointmentStatus[]).map((s) => (
              <button key={s} onClick={() => setFilter(filter === s ? "todas" : s)} className={`badge border ${filter === s ? "border-navy" : "border-transparent"} ${apptBadge[s]}`}>{apptLabel[s]}</button>
            ))}
          </div>
          <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(${view === "semana" ? 110 : 200}px,1fr))` }}>
            <div />
            {days.map((d) => {
              const isToday = d === t, count = db.appointments.filter((a) => a.date === d && a.status !== "cancelada").length;
              return (
                <button key={d} onClick={() => setDay(d)} className={`mx-0.5 mb-2 rounded-xl py-2 text-center transition ${d === day ? "bg-navy text-white" : isToday ? "bg-brand-soft text-brand-dark" : "hover:bg-bg"}`}>
                  <span className="block text-xs font-semibold uppercase opacity-80">{parseDate(d).toLocaleDateString("es-MX", { weekday: "short" }).replace(".", "")}</span>
                  <span className="text-lg font-extrabold">{parseDate(d).getDate()}</span>
                  {count > 0 && <span className="block text-[10px] font-semibold opacity-70">{count} citas</span>}
                </button>
              );
            })}
            <div>
              {Array.from({ length: slots }).map((_, i) => (
                <div key={i} className="-translate-y-2 pr-2 text-right text-xs text-muted" style={{ height: ROW_PX }}>
                  {i % 2 === 0 ? fromMin(startHour * 60 + i * SLOT) : ""}
                </div>
              ))}
            </div>
            {days.map((d) => {
              const list = db.appointments.filter((a) => a.date === d && visible(a));
              const pos = layout(list);
              return (
                <div key={d} className={`relative border-l border-line ${d === t ? "bg-brand-soft/30" : ""}`} style={{ height: slots * ROW_PX }}>
                  {Array.from({ length: slots }).map((_, i) => (
                    // Los horarios que ya terminaron no se pueden usar para agendar
                    isPast(d, fromMin(startHour * 60 + (i + 1) * SLOT - 1)) ? (
                      <div key={i} aria-hidden="true" className={`block w-full border-t bg-bg/70 ${i % 2 ? "border-bg" : "border-line"}`} style={{ height: ROW_PX }} />
                    ) : (
                    <button key={i} aria-label={`Agendar ${fmtDate(d)} ${fromMin(startHour * 60 + i * SLOT)}`}
                      onClick={() => setModal({ defaults: { ...(pro !== "todos" ? { professionalId: pro } : {}), date: d, start: fromMin(startHour * 60 + i * SLOT) } })}
                      className={`group block w-full border-t text-left ${i % 2 ? "border-bg" : "border-line"} hover:bg-brand-soft`} style={{ height: ROW_PX }}>
                      <span className="hidden pl-2 text-[11px] font-bold text-brand group-hover:inline">+ {fromMin(startHour * 60 + i * SLOT)}</span>
                    </button>
                    )
                  ))}
                  {d === t && nowTop > 0 && nowTop < slots * ROW_PX && (
                    <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: nowTop }}>
                      <span className="-ml-1 h-2.5 w-2.5 rounded-full bg-danger" /><span className="h-0.5 flex-1 bg-danger" />
                    </div>
                  )}
                  {list.map((a) => {
                    const top = ((toMin(a.start) - startHour * 60) / SLOT) * ROW_PX;
                    const h = (a.durationMin / SLOT) * ROW_PX - 4;
                    const { col, cols } = pos.get(a.id)!;
                    return (
                      <button key={a.id} onClick={() => setModal({ appt: a })}
                        className={`absolute z-10 overflow-hidden rounded-lg px-2.5 py-1.5 text-left text-xs transition hover:z-30 hover:shadow-lg ${apptBlock[a.status]}`}
                        style={{ top: top + 2, height: Math.max(h, 24), left: `calc(${(col / cols) * 100}% + 4px)`, width: `calc(${100 / cols}% - 8px)` }}>
                        <p className="flex items-center gap-1 truncate font-bold">
                          {multi && proOf(a) && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: proOf(a)!.color }} title={proOf(a)!.name} />}
                          {name(a.patientId)}
                        </p>
                        {h > 30 && <p className="truncate text-ink-soft">{a.start} · {a.treatment}</p>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="card flex h-fit flex-col gap-3 xl:sticky xl:top-24">
          <div>
            <h2 className="text-lg font-bold">{day === t ? "Citas de hoy" : "Citas del día"}</h2>
            <p className="text-sm capitalize text-muted">{fmtLong(day)}</p>
          </div>
          {dayList.length ? dayList.map((a) => (
            <div key={a.id} className={`rounded-2xl border border-line p-3 ${a.status === "cancelada" ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-3">
                <Avatar name={name(a.patientId)} />
                <button className="min-w-0 flex-1 text-left" onClick={() => setModal({ appt: a })}>
                  <p className="flex items-center gap-1 truncate text-sm font-bold">{name(a.patientId)}{alerts(a.patientId) && <ShieldAlert size={14} className="shrink-0 text-danger" aria-label="Alerta médica" />}</p>
                  {alerts(a.patientId) && <p className="truncate text-[11px] font-semibold text-danger">{alerts(a.patientId)}</p>}
                  <p className="text-xs text-muted">{a.start} – {fromMin(toMin(a.start) + a.durationMin)} · {a.treatment}</p>
                  {multi && proOf(a) && <p className="flex items-center gap-1 text-xs font-semibold text-ink-soft"><span className="h-2 w-2 rounded-full" style={{ background: proOf(a)!.color }} />{proOf(a)!.name}</p>}
                </button>
                <span className={`badge ${apptBadge[a.status]}`}>{apptLabel[a.status]}</span>
              </div>
              {a.notes && <p className="mt-2 rounded-lg bg-bg px-3 py-2 text-xs text-ink-soft">{a.notes}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {["pendiente", "confirmada", "urgencia"].includes(a.status) && <button className="btn-primary btn-sm" onClick={() => setStatus(a, "en_sala")}>Registrar llegada</button>}
                {a.status === "pendiente" && <button className="btn-outline btn-sm" onClick={() => setStatus(a, "confirmada")}>Confirmar</button>}
                {a.status === "en_sala" && <button className="btn-dark btn-sm" onClick={() => setCheckout(a)}>Terminar consulta</button>}
                {!["completada", "cancelada"].includes(a.status) && (
                  <a href={remind(a)} target="_blank" rel="noreferrer" className="btn-outline btn-sm"><MessageCircle size={14} /> Recordar</a>
                )}
                {a.status === "en_sala" && a.arrivedAt && <span className="self-center text-xs text-muted">Llegó {a.arrivedAt}</span>}
                <Link href={`/pacientes/${a.patientId}`} className="btn-ghost btn-sm ml-auto">Expediente</Link>
              </div>
            </div>
          )) : (
            <EmptyState icon={CalendarDays} title={day < t ? "Sin citas" : "Día libre"} text={day < t ? "No hubo citas este día." : "No hay citas programadas."}
              action={day < t ? undefined : <button className="btn-primary btn-sm" onClick={() => setModal({ defaults: { ...(pro !== "todos" ? { professionalId: pro } : {}), date: day } })}>Agendar</button>} />
          )}
        </aside>
      </div>

      <CheckoutModal appt={checkout} onClose={() => setCheckout(undefined)} />
      <AppointmentFormModal open={!!modal} onClose={() => setModal(null)} appt={modal?.appt} defaults={modal?.defaults} />
    </>
  );
}
