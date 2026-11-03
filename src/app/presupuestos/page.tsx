"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, FileText } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Avatar, EmptyState, Modal, SearchInput, StatCard } from "@/components/ui";
import { budgetBadge, budgetLabel } from "@/components/status";
import { budgetTotals, nextFolio, paidForBudget, useCollection, useStore } from "@/lib/store";
import { fmtDate, mxn, today, uid } from "@/lib/format";
import type { BudgetStatus } from "@/lib/types";

export default function PresupuestosPage() {
  const { db } = useStore();
  const budgets = useCollection("budgets");
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<BudgetStatus | "todos">("todos");
  const [picking, setPicking] = useState(false);
  const [pq, setPq] = useState("");
  const name = (id: string) => db.patients.find((p) => p.id === id)?.name ?? "Paciente eliminado";

  const rows = useMemo(() => db.budgets
    .filter((b) => (status === "todos" || b.status === status) && (!q || `${name(b.patientId)} ${b.folio}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.folio - a.folio), [db, q, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const sum = (s: BudgetStatus) => db.budgets.filter((b) => b.status === s).reduce((a, b) => a + budgetTotals(b).total, 0);
  const decided = db.budgets.filter((b) => b.status === "aceptado" || b.status === "rechazado").length;
  const conversion = decided ? Math.round((db.budgets.filter((b) => b.status === "aceptado").length / decided) * 100) : 0;

  const create = (patientId: string) => {
    const id = `b${uid()}`;
    budgets.add({ id, folio: nextFolio(db), patientId, items: [], discount: 0, status: "borrador", createdAt: today() });
    router.push(`/presupuestos/${id}`);
  };

  return (
    <>
      <PageHeader kicker="Planes de tratamiento" title="Presupuestos">
        <button className="btn-primary" onClick={() => setPicking(true)}><FilePlus2 size={18} /> Nuevo presupuesto</button>
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Por cerrar (enviados)" value={mxn(sum("enviado"))} tone="navy" note={`${db.budgets.filter((b) => b.status === "enviado").length} presupuestos`} />
        <StatCard label="Aceptados" value={mxn(sum("aceptado"))} tone="green" />
        <StatCard label="Borradores" value={String(db.budgets.filter((b) => b.status === "borrador").length)} />
        <StatCard label="Tasa de aceptación" value={`${conversion}%`} note={`${decided} decididos`} />
      </div>

      <section className="card">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] flex-1"><SearchInput value={q} onChange={setQ} placeholder="Buscar por paciente o folio…" /></div>
          <div className="flex flex-wrap gap-1.5">
            {(["todos", "borrador", "enviado", "aceptado", "rechazado"] as const).map((s) => (
              <button key={s} onClick={() => setStatus(s)} className={`badge border px-3 py-2 ${status === s ? "border-navy bg-navy text-white" : "border-line bg-surface text-ink-soft"}`}>
                {s === "todos" ? "Todos" : budgetLabel[s]}
              </button>
            ))}
          </div>
        </div>
        {rows.length ? (
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
            <thead><tr><th className="th">Folio</th><th className="th">Paciente</th><th className="th">Fecha</th><th className="th">Conceptos</th><th className="th">Estado</th><th className="th text-right">Total</th><th className="th text-right">Pagado</th></tr></thead>
            <tbody>{rows.map((b) => {
              const tot = budgetTotals(b).total, pd = paidForBudget(db, b.id);
              return (
                <tr key={b.id} className="row-hover cursor-pointer" onClick={() => router.push(`/presupuestos/${b.id}`)}>
                  <td className="td font-bold">#{b.folio}</td>
                  <td className="td"><div className="flex items-center gap-2"><Avatar name={name(b.patientId)} size={30} /><span className="font-semibold">{name(b.patientId)}</span></div></td>
                  <td className="td text-muted">{fmtDate(b.createdAt)}</td>
                  <td className="td max-w-[220px] truncate text-muted">{b.items.map((i) => i.name).join(", ") || "—"}</td>
                  <td className="td"><span className={`badge ${budgetBadge[b.status]}`}>{budgetLabel[b.status]}</span></td>
                  <td className="td text-right font-bold">{mxn(tot)}</td>
                  <td className="td text-right">
                    {pd > 0 ? <div className="ml-auto w-24"><p className="text-xs font-semibold">{mxn(pd)}</p><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg"><div className="h-full bg-brand" style={{ width: `${Math.min(100, (pd / (tot || 1)) * 100)}%` }} /></div></div> : <span className="text-muted">—</span>}
                  </td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <EmptyState icon={FileText} title="No hay presupuestos" text="Crea un presupuesto a partir del odontograma de un paciente." action={<button className="btn-primary" onClick={() => setPicking(true)}>Nuevo presupuesto</button>} />}
      </section>

      <Modal open={picking} onClose={() => setPicking(false)} title="¿Para qué paciente?" subtitle="Selecciona al paciente del presupuesto">
        <SearchInput value={pq} onChange={setPq} placeholder="Buscar paciente…" />
        <div className="mt-3 max-h-80 overflow-y-auto">
          {db.patients.filter((p) => p.name.toLowerCase().includes(pq.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
            <button key={p.id} onClick={() => create(p.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-bg">
              <Avatar name={p.name} size={34} /><span className="flex-1 text-sm font-bold">{p.name}</span><span className="text-xs text-muted">{p.phone}</span>
            </button>
          ))}
        </div>
        <Link href="/pacientes?nuevo=1" className="mt-3 block text-center text-sm font-bold text-brand">+ Registrar paciente nuevo</Link>
      </Modal>
    </>
  );
}
