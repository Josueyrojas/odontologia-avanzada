"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, CalendarCheck, CalendarX, Clock, Download, UserPlus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Avatar, StatCard } from "@/components/ui";
import { budgetTotals, professionalsOf, useStore } from "@/lib/store";
import { addDays, downloadCSV, monthKey, mxn, parseDate, shortMonth, toISODate, today, toMin } from "@/lib/format";

type Period = "mes" | "3m" | "12m";
const periodLabel: Record<Period, string> = { mes: "Este mes", "3m": "Últimos 3 meses", "12m": "Últimos 12 meses" };
const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const tip = { contentStyle: { borderRadius: 12, border: "1px solid #E4EBF2" } };

export default function ReportesPage() {
  const { db } = useStore();
  const [period, setPeriod] = useState<Period>("3m");
  const t = today();

  const r = useMemo(() => {
    const from = period === "mes" ? `${monthKey(t)}-01` : addDays(t, period === "3m" ? -90 : -365);
    const inRange = (d: string) => d >= from && d <= t;
    const appts = db.appointments.filter((a) => inRange(a.date));
    const done = appts.filter((a) => a.status === "completada");
    const cancelled = appts.filter((a) => a.status === "cancelada").length;
    const pastScheduled = appts.filter((a) => a.date < t);
    const noShow = pastScheduled.filter((a) => ["pendiente", "confirmada"].includes(a.status)).length; // nunca llegaron

    // Rentabilidad por tratamiento (citas completadas × precio de catálogo)
    const byProc = db.procedures.map((p) => {
      const n = done.filter((a) => a.procedureId === p.id).length;
      const revenue = n * p.price, cost = n * p.materialCost;
      const hours = (n * p.durationMin) / 60;
      return { id: p.id, name: p.name, color: p.color ?? "#9FB4C9", n, revenue, cost, profit: revenue - cost, perHour: hours ? (revenue - cost) / hours : 0 };
    }).filter((x) => x.n).sort((a, b) => b.profit - a.profit);

    // Productividad por profesional (las citas sin asignar cuentan para el primero)
    const pros = professionalsOf(db.settings);
    const byPro = pros.map((pr) => {
      const mine = done.filter((a) => (pros.find((x) => x.id === a.professionalId) ?? pros[0]).id === pr.id);
      let revenue = 0, cost = 0, minutes = 0;
      mine.forEach((a) => { const pc = db.procedures.find((x) => x.id === a.procedureId); revenue += pc?.price ?? 0; cost += pc?.materialCost ?? 0; minutes += a.durationMin; });
      return { ...pr, n: mine.length, patients: new Set(mine.map((a) => a.patientId)).size, revenue, profit: revenue - cost, hours: minutes / 60, commission: revenue * (pr.commissionPct ?? 0) / 100 };
    }).filter((x) => x.n || x.active !== false);

    // Mapa de calor día × hora
    const { startHour, endHour, workDays } = db.settings;
    const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
    const heat = weekdays.slice(0, Math.max(workDays, 5)).map((_, wd) =>
      hours.map((h) => appts.filter((a) => a.status !== "cancelada" && (parseDate(a.date).getDay() + 6) % 7 === wd && Math.floor(toMin(a.start) / 60) === h).length));
    const heatMax = Math.max(1, ...heat.flat());

    // Ocupación: minutos agendados / minutos disponibles en días laborales del periodo
    let available = 0;
    for (let d = from; d <= t; d = addDays(d, 1)) if ((parseDate(d).getDay() + 6) % 7 < workDays) available += (endHour - startHour) * 60;
    const booked = appts.filter((a) => a.status !== "cancelada").reduce((s, a) => s + a.durationMin, 0);

    // Pacientes nuevos por mes (12 meses) y recurrencia
    const months = Array.from({ length: 12 }, (_, i) => { const d = parseDate(`${monthKey(t)}-01`); d.setMonth(d.getMonth() - 11 + i); return monthKey(toISODate(d)); });
    const newByMonth = months.map((m) => ({ mes: shortMonth(m), nuevos: db.patients.filter((p) => monthKey(p.createdAt) === m).length }));
    const visitsBy = new Map<string, number>();
    done.forEach((a) => visitsBy.set(a.patientId, (visitsBy.get(a.patientId) ?? 0) + 1));
    const recurring = [...visitsBy.values()].filter((v) => v > 1).length;

    // Pacientes con más ingresos
    const paysIn = db.payments.filter((p) => inRange(p.date));
    const byPatient = new Map<string, number>();
    paysIn.forEach((p) => byPatient.set(p.patientId, (byPatient.get(p.patientId) ?? 0) + p.amount));
    const top = [...byPatient.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([id, amount]) => ({ p: db.patients.find((x) => x.id === id), amount })).filter((x) => x.p);

    // Embudo de presupuestos
    const buds = db.budgets.filter((b) => inRange(b.createdAt));
    const sumOf = (arr: typeof buds) => arr.reduce((s, b) => s + budgetTotals(b).total, 0);
    const sent = buds.filter((b) => b.status !== "borrador");
    const accepted = buds.filter((b) => b.status === "aceptado");
    const funnel = [
      { label: "Creados", n: buds.length, v: sumOf(buds) },
      { label: "Enviados", n: sent.length, v: sumOf(sent) },
      { label: "Aceptados", n: accepted.length, v: sumOf(accepted) },
    ];
    const itemsAccepted = accepted.flatMap((b) => b.items);
    const progress = itemsAccepted.length ? Math.round((itemsAccepted.filter((i) => i.doneDate).length / itemsAccepted.length) * 100) : 0;

    return {
      done: done.length, cancelled, noShow, total: appts.length, pastScheduled: pastScheduled.length,
      income: paysIn.reduce((s, p) => s + p.amount, 0), newPatients: db.patients.filter((p) => inRange(p.createdAt)).length,
      occupancy: available ? Math.min(100, Math.round((booked / available) * 100)) : 0, bookedHours: Math.round(booked / 60),
      byProc, byPro, hours, heat, heatMax, newByMonth, recurring, attended: visitsBy.size, top, funnel, progress,
    };
  }, [db, period, t]);

  const exportCSV = () => downloadCSV(`productividad-${period}.csv`, r.byProc.map((x) => ({
    Tratamiento: x.name, Realizados: x.n, Ingreso: x.revenue, "Costo material": x.cost, Utilidad: x.profit, "Utilidad por hora": Math.round(x.perHour),
  })));
  const lossRate = r.pastScheduled ? Math.round(((r.cancelled + r.noShow) / r.pastScheduled) * 100) : 0;

  return (
    <>
      <PageHeader kicker="Análisis del consultorio" title="Reportes de productividad">
        <div className="flex rounded-xl border border-edge bg-surface p-1">
          {(Object.keys(periodLabel) as Period[]).map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${period === p ? "bg-navy text-white" : "hover:bg-bg"}`}>{periodLabel[p]}</button>
          ))}
        </div>
        <button className="btn-outline" onClick={exportCSV}><Download size={18} /> Exportar</button>
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Consultas atendidas" value={String(r.done)} icon={CalendarCheck} tone="navy" note={`${r.attended} pacientes distintos`} />
        <StatCard label="Ocupación de agenda" value={`${r.occupancy}%`} icon={Clock} note={`${r.bookedHours} h agendadas`} tone={r.occupancy >= 60 ? "green" : "white"} />
        <StatCard label="Cancelaciones / faltas" value={`${lossRate}%`} icon={CalendarX} note={`${r.cancelled} canceladas · ${r.noShow} sin asistir`} tone={lossRate > 15 ? "red" : "white"} />
        <StatCard label="Pacientes nuevos" value={String(r.newPatients)} icon={UserPlus} note={`${r.recurring} regresaron más de una vez`} />
        <StatCard label="Ingresos del periodo" value={mxn(r.income)} icon={Activity} tone="green" />
      </div>

      {r.byPro.length > 1 && (
        <section className="card mb-5">
          <h2 className="text-lg font-bold">Productividad por profesional</h2>
          <p className="mb-4 text-sm text-muted">Consultas completadas en el periodo, valuadas con los precios del catálogo.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr><th className="th">Profesional</th><th className="th text-right">Consultas</th><th className="th text-right">Pacientes</th><th className="th text-right">Horas</th><th className="th text-right">Ingreso generado</th><th className="th text-right">Utilidad</th><th className="th text-right">Comisión</th></tr></thead>
              <tbody>{r.byPro.map((x) => (
                <tr key={x.id} className="row-hover">
                  <td className="td"><span className="flex items-center gap-2 font-semibold"><span className="h-3 w-3 rounded-full" style={{ background: x.color }} />{x.name}</span></td>
                  <td className="td text-right">{x.n}</td>
                  <td className="td text-right">{x.patients}</td>
                  <td className="td text-right">{x.hours.toFixed(1)}</td>
                  <td className="td text-right font-bold">{mxn(x.revenue)}</td>
                  <td className="td text-right text-brand-dark">{mxn(x.profit)}</td>
                  <td className="td text-right">{x.commissionPct ? <>{mxn(x.commission)} <span className="text-xs text-muted">({x.commissionPct}%)</span></> : <span className="text-muted">—</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card mb-5">
        <h2 className="text-lg font-bold">Rentabilidad por tratamiento</h2>
        <p className="mb-4 text-sm text-muted">Calculada con las citas completadas y los precios y costos del catálogo.</p>
        {r.byProc.length ? (
          <div className="grid gap-6 xl:grid-cols-[2fr_3fr]">
            <div style={{ height: Math.max(200, r.byProc.length * 40) }}>
              <ResponsiveContainer>
                <BarChart data={r.byProc} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={150} tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip {...tip} formatter={(v: number) => mxn(v)} cursor={{ fill: "rgba(159,180,201,.12)" }} />
                  <Bar dataKey="profit" name="Utilidad" radius={[0, 8, 8, 0]} barSize={20} fill="#12A36A" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead><tr><th className="th">Tratamiento</th><th className="th text-right">Realizados</th><th className="th text-right">Ingreso</th><th className="th text-right">Utilidad</th><th className="th text-right">Utilidad / hora</th></tr></thead>
                <tbody>{r.byProc.map((x, i) => (
                  <tr key={x.id} className="row-hover">
                    <td className="td"><span className="flex items-center gap-2 font-semibold"><span className="h-3 w-3 rounded-full" style={{ background: x.color }} />{x.name}{i === 0 && <span className="badge bg-brand-soft text-brand-dark">Más rentable</span>}</span></td>
                    <td className="td text-right">{x.n}</td>
                    <td className="td text-right">{mxn(x.revenue)}</td>
                    <td className="td text-right font-bold text-brand-dark">{mxn(x.profit)}</td>
                    <td className="td text-right">{mxn(x.perHour)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        ) : <p className="py-8 text-center text-sm text-muted">Sin consultas completadas en este periodo.</p>}
      </section>

      <div className="mb-5 grid gap-5 xl:grid-cols-[3fr_2fr]">
        <section className="card overflow-x-auto">
          <h2 className="text-lg font-bold">Horas pico</h2>
          <p className="mb-4 text-sm text-muted">Citas por día y hora de inicio. Útil para decidir horarios y personal.</p>
          <div className="grid min-w-[520px] gap-1" style={{ gridTemplateColumns: `40px repeat(${r.hours.length}, minmax(0,1fr))` }}>
            <div />
            {r.hours.map((h) => <div key={h} className="text-center text-[11px] font-semibold text-muted">{h}</div>)}
            {r.heat.map((row, wd) => (
              <div key={wd} className="contents">
                <div className="self-center text-xs font-bold text-muted">{weekdays[wd]}</div>
                {row.map((n, i) => (
                  <div key={i} title={`${weekdays[wd]} ${r.hours[i]}:00 · ${n} citas`}
                    className="grid aspect-square place-items-center rounded-md text-[11px] font-bold"
                    style={{ background: n ? `rgba(18,163,106,${0.15 + (n / r.heatMax) * 0.85})` : "rgb(var(--c-bg))", color: n / r.heatMax > 0.5 ? "#fff" : "rgb(var(--c-ink-soft))" }}>
                    {n || ""}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="mb-4 text-lg font-bold">Embudo de presupuestos</h2>
          <div className="space-y-3">
            {r.funnel.map((f, i) => (
              <div key={f.label}>
                <div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{f.label} <span className="text-muted">({f.n})</span></span><b>{mxn(f.v)}</b></div>
                <div className="h-8 overflow-hidden rounded-lg bg-bg">
                  <div className="h-full rounded-lg transition-all" style={{ width: `${r.funnel[0].v ? Math.max(4, (f.v / r.funnel[0].v) * 100) : 0}%`, background: ["#9FB4C9", "#3A7BD5", "#12A36A"][i] }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl bg-brand-soft p-4 text-brand-dark">
            <div className="mb-1 flex justify-between text-sm"><b>Avance de planes aceptados</b><span>{r.progress}%</span></div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface"><div className="h-full bg-brand" style={{ width: `${r.progress}%` }} /></div>
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-2 text-lg font-bold">Pacientes nuevos por mes</h2>
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={r.newByMonth}>
                <CartesianGrid stroke="#EEF2F6" vertical={false} />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
                <Tooltip {...tip} cursor={{ fill: "rgba(159,180,201,.12)" }} />
                <Bar dataKey="nuevos" name="Pacientes nuevos" fill="#3A7BD5" radius={[6, 6, 0, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card">
          <h2 className="mb-3 text-lg font-bold">Pacientes con más ingresos</h2>
          {r.top.length ? r.top.map(({ p, amount }, i) => (
            <Link key={p!.id} href={`/pacientes/${p!.id}`} className="row-hover -mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5">
              <span className="w-5 text-center text-sm font-extrabold text-muted">{i + 1}</span>
              <Avatar name={p!.name} size={36} />
              <span className="flex-1 truncate text-sm font-bold">{p!.name}</span>
              <div className="hidden h-2 w-28 overflow-hidden rounded-full bg-bg sm:block"><div className="h-full bg-brand" style={{ width: `${(amount / r.top[0].amount) * 100}%` }} /></div>
              <b className="w-24 text-right text-sm">{mxn(amount)}</b>
            </Link>
          )) : <p className="text-sm text-muted">Sin pagos en el periodo.</p>}
        </section>
      </div>
    </>
  );
}
