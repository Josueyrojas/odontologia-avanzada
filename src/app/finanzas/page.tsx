"use client";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Calculator, ChevronLeft, ChevronRight, CircleDollarSign, Download, Printer, Receipt, ReceiptText, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Modal, StatCard, Tabs, useUI } from "@/components/ui";
import { ExpenseFormModal, PaymentFormModal } from "@/components/forms";
import { methodLabel } from "@/components/status";
import { useCollection, useStore } from "@/lib/store";
import { downloadCSV, fmtDate, fmtLong, monthKey, monthName, mxn, shortMonth, today } from "@/lib/format";
import type { Payment, PaymentMethod } from "@/lib/types";
import { ReceiptModal } from "@/components/Receipt";

const COLORS = ["#0F2A44", "#12A36A", "#3A7BD5", "#9ADBC0", "#E8893A", "#7B61FF", "#F2B33D", "#9FB4C9"];
const tip = { contentStyle: { borderRadius: 12, border: "1px solid #E4EBF2" }, formatter: (v: number) => mxn(v) };
const shiftMonth = (key: string, n: number) => { const [y, m] = key.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

export default function FinanzasPage() {
  const { db } = useStore();
  const payments = useCollection("payments");
  const expenses = useCollection("expenses");
  const { toast, confirm } = useUI();
  const [month, setMonth] = useState(monthKey(today()));
  const [tab, setTab] = useState<"ingresos" | "egresos">("ingresos");
  const [modal, setModal] = useState<"pago" | "egreso" | "corte" | null>(null);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const name = (id: string) => db.patients.find((p) => p.id === id)?.name ?? "—";

  const data = useMemo(() => {
    const inc = db.payments.filter((p) => monthKey(p.date) === month).sort((a, b) => b.date.localeCompare(a.date));
    const exp = db.expenses.filter((e) => monthKey(e.date) === month).sort((a, b) => b.date.localeCompare(a.date));
    const sum = (a: { amount: number }[]) => a.reduce((s, x) => s + x.amount, 0);
    const prevKey = shiftMonth(month, -1);
    const prevInc = sum(db.payments.filter((p) => monthKey(p.date) === prevKey));
    const prevExp = sum(db.expenses.filter((e) => monthKey(e.date) === prevKey));
    const group = <T,>(arr: T[], key: (x: T) => string, val: (x: T) => number) =>
      Object.entries(arr.reduce<Record<string, number>>((acc, x) => { acc[key(x)] = (acc[key(x)] ?? 0) + val(x); return acc; }, {}))
        .map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    let byTreatment = group(inc, (p) => p.concept.replace(/^Abono presupuesto.*|^Anticipo.*/, "Abonos a presupuestos"), (p) => p.amount);
    if (byTreatment.length > 7) byTreatment = [...byTreatment.slice(0, 6), { name: "Otros", value: byTreatment.slice(6).reduce((a, b) => a + b.value, 0) }];
    const series = Array.from({ length: 6 }, (_, i) => {
      const k = shiftMonth(month, i - 5);
      return { mes: shortMonth(k), ingresos: sum(db.payments.filter((p) => monthKey(p.date) === k)), costos: sum(db.expenses.filter((e) => monthKey(e.date) === k)) };
    });
    return {
      inc, exp, income: sum(inc), cost: sum(exp), prevInc, prevExp,
      byTreatment, byCategory: group(exp, (e) => e.category, (e) => e.amount),
      byMethod: (Object.keys(methodLabel) as PaymentMethod[]).map((m) => ({ name: methodLabel[m], value: sum(inc.filter((p) => p.method === m)) })),
      series, patients: new Set(inc.map((p) => p.patientId)).size,
    };
  }, [db, month]);

  const profit = data.income - data.cost;
  const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0);
  const isCurrent = month === monthKey(today());

  const exportCSV = () => {
    const rows = [
      ...data.inc.map((p) => ({ Tipo: "Ingreso", Fecha: p.date, Concepto: p.concept, Tercero: name(p.patientId), Categoria: methodLabel[p.method], Monto: p.amount })),
      ...data.exp.map((e) => ({ Tipo: "Egreso", Fecha: e.date, Concepto: e.invoice ?? "", Tercero: e.supplier, Categoria: e.category, Monto: -e.amount })),
    ];
    if (!rows.length) return toast("No hay movimientos en este mes", "info");
    downloadCSV(`finanzas-${month}.csv`, rows);
    toast("Reporte exportado");
  };
  const delPayment = async (id: string) => { if (await confirm({ title: "Eliminar pago", text: "Se quitará este ingreso del reporte.", danger: true, confirmLabel: "Eliminar" })) { payments.remove(id); toast("Pago eliminado", "info"); } };
  const delExpense = async (id: string) => { if (await confirm({ title: "Eliminar egreso", text: "Se quitará del reporte. El stock del inventario no se modifica.", danger: true, confirmLabel: "Eliminar" })) { expenses.remove(id); toast("Egreso eliminado", "info"); } };

  return (
    <>
      <PageHeader kicker={<span className="flex items-center gap-1">
        <button className="icon-btn h-7 w-7" aria-label="Mes anterior" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={16} /></button>
        <span className="min-w-[120px] text-center">{monthName(month)}</span>
        <button className="icon-btn h-7 w-7" aria-label="Mes siguiente" disabled={isCurrent} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={16} /></button>
      </span>} title="Reporte de Rentabilidad">
        <button className="btn-outline" onClick={exportCSV}><Download size={18} /> Exportar CSV</button>
        <button className="btn-outline" onClick={() => window.print()}><Printer size={18} /> Imprimir</button>
        <button className="btn-outline" onClick={() => setModal("corte")}><Calculator size={18} /> Corte de caja</button>
        <button className="btn-outline" onClick={() => setModal("egreso")}><Receipt size={18} /> Egreso</button>
        <button className="btn-primary" onClick={() => setModal("pago")}><CircleDollarSign size={18} /> Registrar pago</button>
      </PageHeader>
      <h1 className="mb-4 hidden text-2xl font-extrabold print:block">{db.settings.clinicName} · Reporte de {monthName(month)}</h1>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Monto total cobrado" value={mxn(data.income)} trend={pct(data.income, data.prevInc)} note="vs. mes anterior" icon={Wallet} tone="navy" />
        <StatCard label="Costos operativos" value={mxn(data.cost)} trend={pct(data.cost, data.prevExp)} note="vs. mes anterior" icon={TrendingDown} />
        <StatCard label="Utilidad neta" value={mxn(profit)} note={`Margen ${data.income ? ((profit / data.income) * 100).toFixed(1) : 0}%`} icon={TrendingUp} tone={profit >= 0 ? "green" : "red"} />
        <StatCard label="Ticket promedio" value={mxn(data.inc.length ? data.income / data.inc.length : 0)} note={`${data.inc.length} cobros · ${data.patients} pacientes`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[2fr_3fr]">
        <section className="card">
          <h2 className="mb-2 text-lg font-bold">Ingresos por tratamiento</h2>
          {data.byTreatment.length ? (
            <>
              <div className="relative h-64">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={data.byTreatment} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none">
                      {data.byTreatment.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...tip} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div><p className="text-xs text-muted">Total</p><p className="text-xl font-extrabold">{mxn(data.income)}</p></div>
                </div>
              </div>
              <ul className="mt-2 space-y-2 text-sm">
                {data.byTreatment.map((t, i) => (
                  <li key={t.name} className="flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="flex-1 truncate">{t.name}</span>
                    <span className="text-muted">{Math.round((t.value / (data.income || 1)) * 100)}%</span>
                    <b className="w-24 text-right">{mxn(t.value)}</b>
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="py-16 text-center text-sm text-muted">Sin ingresos registrados en este mes.</p>}
        </section>

        <section className="card">
          <h2 className="mb-2 text-lg font-bold">Ingresos reales vs. costos operativos</h2>
          <div className="h-80">
            <ResponsiveContainer>
              <AreaChart data={data.series}>
                <defs>
                  <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#12A36A" stopOpacity={0.3} /><stop offset="1" stopColor="#12A36A" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E8893A" stopOpacity={0.2} /><stop offset="1" stopColor="#E8893A" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="#EEF2F6" vertical={false} />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tickLine={false} axisLine={false} width={50} />
                <Tooltip {...tip} />
                <Legend />
                <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#12A36A" fill="url(#gi)" strokeWidth={3} />
                <Area type="monotone" dataKey="costos" name="Costos" stroke="#E8893A" fill="url(#gc)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 text-lg font-bold">Egresos por categoría</h2>
          {data.byCategory.length ? (
            <div style={{ height: Math.max(160, data.byCategory.length * 42) }}>
              <ResponsiveContainer>
                <BarChart data={data.byCategory} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip {...tip} cursor={{ fill: "#F3F6F9" }} />
                  <Bar dataKey="value" name="Monto" fill="#E8893A" radius={[0, 8, 8, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="py-10 text-center text-sm text-muted">Sin egresos en este mes.</p>}
        </section>
        <section className="card">
          <h2 className="mb-3 text-lg font-bold">Cobros por método de pago</h2>
          <div className="space-y-4">
            {data.byMethod.map((m, i) => (
              <div key={m.name}>
                <div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{m.name}</span><span><b>{mxn(m.value)}</b> <span className="text-muted">· {Math.round((m.value / (data.income || 1)) * 100)}%</span></span></div>
                <div className="h-3 overflow-hidden rounded-full bg-bg"><div className="h-full rounded-full transition-all" style={{ width: `${(m.value / (data.income || 1)) * 100}%`, background: COLORS[i] }} /></div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card mt-5">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: "ingresos", label: "Ingresos", count: data.inc.length }, { id: "egresos", label: "Egresos", count: data.exp.length }]} />
        <div className="max-h-[480px] overflow-auto">
          {tab === "ingresos" ? (
            <table className="w-full min-w-[600px] text-sm">
              <thead className="sticky top-0 bg-surface"><tr><th className="th">Fecha</th><th className="th">Paciente</th><th className="th">Concepto</th><th className="th">Método</th><th className="th text-right">Monto</th><th className="th print:hidden" /></tr></thead>
              <tbody>{data.inc.map((p) => (
                <tr key={p.id} className="row-hover"><td className="td">{fmtDate(p.date)}</td><td className="td font-semibold">{name(p.patientId)}</td><td className="td">{p.concept}</td><td className="td text-muted">{methodLabel[p.method]}</td><td className="td text-right font-bold text-brand-dark">{mxn(p.amount)}</td>
                  <td className="td text-right print:hidden"><div className="flex justify-end gap-1">
                    <button className="icon-btn" aria-label="Recibo" title="Recibo" onClick={() => setReceipt(p)}><ReceiptText size={15} /></button>
                    <button className="icon-btn hover:text-danger" aria-label="Eliminar" onClick={() => delPayment(p.id)}><Trash2 size={15} /></button>
                  </div></td></tr>
              ))}</tbody>
            </table>
          ) : (
            <table className="w-full min-w-[600px] text-sm">
              <thead className="sticky top-0 bg-surface"><tr><th className="th">Fecha</th><th className="th">Proveedor</th><th className="th">Categoría</th><th className="th">Referencia</th><th className="th text-right">Monto</th><th className="th print:hidden" /></tr></thead>
              <tbody>{data.exp.map((e) => (
                <tr key={e.id} className="row-hover"><td className="td">{fmtDate(e.date)}</td><td className="td font-semibold">{e.supplier}</td><td className="td">{e.category}</td><td className="td text-muted">{e.invoice ?? "—"}</td><td className="td text-right font-bold text-cost">{mxn(e.amount)}</td>
                  <td className="td text-right print:hidden"><button className="icon-btn hover:text-danger" aria-label="Eliminar" onClick={() => delExpense(e.id)}><Trash2 size={15} /></button></td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </section>

      <PaymentFormModal open={modal === "pago"} onClose={() => setModal(null)} />
      <ExpenseFormModal open={modal === "egreso"} onClose={() => setModal(null)} />
      <CashCutModal open={modal === "corte"} onClose={() => setModal(null)} />
      <ReceiptModal payment={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}

function CashCutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db } = useStore();
  const [day, setDay] = useState(today());
  const [counted, setCounted] = useState("");
  const pays = db.payments.filter((p) => p.date === day);
  const exps = db.expenses.filter((e) => e.date === day);
  const by = (m: PaymentMethod) => pays.filter((p) => p.method === m).reduce((a, p) => a + p.amount, 0);
  const total = pays.reduce((a, p) => a + p.amount, 0);
  const out = exps.reduce((a, e) => a + e.amount, 0);
  const cash = by("efectivo");
  const diff = counted === "" ? null : +counted - cash;
  const name = (id: string) => db.patients.find((p) => p.id === id)?.name ?? "—";
  const attended = db.appointments.filter((a) => a.date === day && a.status === "completada").length;

  return (
    <Modal open={open} onClose={onClose} title={`Corte de caja · ${db.settings.clinicName}`} subtitle={fmtLong(day)} size="lg" printable
      footer={<><button className="btn-outline" onClick={onClose}>Cerrar</button><button className="btn-dark" onClick={() => window.print()}><Printer size={18} /> Imprimir corte</button></>}>
      <div className="flex flex-col gap-5">
        <label className="label print:hidden">Día<input type="date" className="input" max={today()} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} /></label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.keys(methodLabel) as PaymentMethod[]).map((m) => (
            <div key={m} className="rounded-2xl bg-bg p-3"><p className="text-xs text-muted">{methodLabel[m]}</p><p className="text-lg font-extrabold">{mxn(by(m))}</p></div>
          ))}
          <div className="rounded-2xl bg-gradient-to-br from-navy to-navy-700 p-3 text-white"><p className="text-xs text-[#B8C9DA]">Total cobrado</p><p className="text-lg font-extrabold">{mxn(total)}</p></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-line p-3"><p className="text-xs text-muted">Pacientes atendidos</p><p className="text-lg font-extrabold">{attended}</p></div>
          <div className="rounded-2xl border border-line p-3"><p className="text-xs text-muted">Egresos del día</p><p className="text-lg font-extrabold text-cost">{mxn(out)}</p></div>
          <div className="rounded-2xl bg-brand-soft p-3 text-brand-dark"><p className="text-xs">Neto del día</p><p className="text-lg font-extrabold">{mxn(total - out)}</p></div>
        </div>
        <div className="rounded-2xl border border-line p-4">
          <p className="mb-2 text-sm font-bold">Arqueo de efectivo</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="label flex-1">Efectivo contado en caja<input type="number" min={0} className="input" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder={String(cash)} /></label>
            <div className="text-sm">
              <p className="text-muted">Esperado: <b className="text-ink">{mxn(cash)}</b></p>
              {diff !== null && <p className={`font-bold ${diff === 0 ? "text-brand-dark" : diff > 0 ? "text-[#3A7BD5]" : "text-danger"}`}>{diff === 0 ? "Cuadra exacto ✓" : diff > 0 ? `Sobrante ${mxn(diff)}` : `Faltante ${mxn(-diff)}`}</p>}
            </div>
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold">Movimientos ({pays.length + exps.length})</p>
          {pays.length + exps.length ? (
            <table className="w-full text-sm">
              <tbody>
                {pays.map((p) => <tr key={p.id}><td className="td">{name(p.patientId)}<span className="block text-xs text-muted">{p.concept}</span></td><td className="td text-muted">{methodLabel[p.method]}</td><td className="td text-right font-bold text-brand-dark">+{mxn(p.amount)}</td></tr>)}
                {exps.map((e) => <tr key={e.id}><td className="td">{e.supplier}<span className="block text-xs text-muted">{e.category}</span></td><td className="td text-muted">Egreso</td><td className="td text-right font-bold text-cost">−{mxn(e.amount)}</td></tr>)}
              </tbody>
            </table>
          ) : <p className="text-sm text-muted">Sin movimientos este día.</p>}
        </div>
      </div>
    </Modal>
  );
}
