"use client";
import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, CircleDollarSign, Copy, FileDown, FileText, MessageCircle, Plus, Send, Trash2, X } from "lucide-react";
import Odontogram, { statusLabel, ToothStatusPicker } from "@/components/Odontogram";
import { Avatar, EmptyState, useUI } from "@/components/ui";
import { PaymentFormModal } from "@/components/forms";
import { budgetBadge, budgetLabel, methodLabel } from "@/components/status";
import { Logo } from "@/components/Sidebar";
import { budgetTotals, consumeMaterials, nextFolio, paidForBudget, useCollection, useStore } from "@/lib/store";
import { age, fmtDate, mxn, today, uid, whatsappLink } from "@/lib/format";
import type { Budget, BudgetItem, BudgetStatus, ToothStatus } from "@/lib/types";

export default function PresupuestoEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { db, update } = useStore();
  const budgets = useCollection("budgets");
  const patients = useCollection("patients");
  const { toast, confirm } = useUI();
  const [selected, setSelected] = useState<number | null>(null);
  const [newProc, setNewProc] = useState(db.procedures[0]?.id ?? "");
  const [pay, setPay] = useState(false);

  const b = budgets.get(id);
  const p = patients.get(b?.patientId);
  if (!b || !p) return <EmptyState icon={FileText} title="Presupuesto no encontrado" action={<Link href="/presupuestos" className="btn-primary">Volver</Link>} />;

  const locked = b.status === "aceptado" || b.status === "rechazado";
  const totals = budgetTotals(b);
  const paid = paidForBudget(db, b.id);
  const payments = db.payments.filter((x) => x.budgetId === b.id);
  const set = (changes: Partial<Budget>) => budgets.patch(b.id, changes);
  const setItems = (items: BudgetItem[]) => set({ items });
  const s = db.settings;

  const addItem = (procId = newProc, tooth = selected ?? undefined) => {
    const pr = db.procedures.find((x) => x.id === procId);
    if (!pr) return;
    setItems([...b.items, { id: uid(), procedureId: pr.id, name: pr.name, tooth, qty: 1, price: pr.price, cost: pr.materialCost }]);
    toast(`${pr.name}${tooth ? ` · diente ${tooth}` : ""} agregado`);
  };
  const setTooth = (st: ToothStatus) => selected != null && patients.patch(p.id, { teeth: { ...p.teeth, [selected]: st } });
  const changeStatus = async (st: BudgetStatus) => {
    if (st === "aceptado" && !b.items.length) return toast("Agrega al menos un concepto", "error");
    if (st === "aceptado" && !(await confirm({ title: "Aceptar presupuesto", text: `El paciente acepta el plan por ${mxn(totals.total)}. Quedará bloqueado para edición y se sumará a su saldo por cobrar.`, confirmLabel: "Aceptar" }))) return;
    set({ status: st });
    toast(`Presupuesto ${budgetLabel[st].toLowerCase()}`);
  };
  const toggleDone = (item: BudgetItem) => {
    const done = !item.doneDate;
    update((d0) => {
      const d = {
        ...d0,
        budgets: d0.budgets.map((x) => x.id === b.id ? { ...x, items: x.items.map((i) => i.id === item.id ? { ...i, doneDate: done ? today() : undefined } : i) } : x),
        patients: done && item.tooth
          ? d0.patients.map((x) => x.id === p.id ? { ...x, teeth: { ...x.teeth, [item.tooth!]: item.procedureId === "extraccion" ? "ausente" as const : "tratado" as const } } : x)
          : d0.patients,
      };
      // al marcar se descuenta el material; al desmarcar se regresa al inventario
      return consumeMaterials(d, item.procedureId, done ? item.qty : -item.qty);
    });
    toast(done ? `${item.name} realizado` : `${item.name} marcado como pendiente`, done ? "success" : "info");
  };
  const doneCount = b.items.filter((i) => i.doneDate).length;
  const duplicate = () => {
    const nid = `b${uid()}`;
    budgets.add({ ...b, id: nid, folio: nextFolio(db), status: "borrador", createdAt: today(), items: b.items.map((i) => ({ ...i, id: uid() })) });
    toast("Presupuesto duplicado"); router.push(`/presupuestos/${nid}`);
  };
  const del = async () => {
    if (await confirm({ title: "Eliminar presupuesto", text: `Se eliminará el folio #${b.folio}.`, danger: true, confirmLabel: "Eliminar" })) {
      budgets.remove(b.id); toast("Presupuesto eliminado", "info"); router.push("/presupuestos");
    }
  };
  const waText = `Hola ${p.name.split(" ")[0]}, le compartimos su presupuesto #${b.folio} de ${s.clinicName}:\n\n` +
    b.items.map((i) => `• ${i.name}${i.tooth ? ` (diente ${i.tooth})` : ""}${i.qty > 1 ? ` x${i.qty}` : ""}: ${mxn(i.price * i.qty)}`).join("\n") +
    `${b.discount ? `\nDescuento: ${b.discount}%` : ""}\n*Total: ${mxn(totals.total)}*\n\nQuedamos a sus órdenes. 🦷`;
  const suggested = Object.entries(p.teeth).filter(([n, st]) => (st === "pendiente" || st === "problema") && !b.items.some((i) => i.tooth === +n));

  return (
    <>
      <div className="print:hidden">
        <Link href="/presupuestos" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft size={16} /> Presupuestos</Link>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-muted">Folio #{b.folio} · {fmtDate(b.createdAt)} <span className={`badge ${budgetBadge[b.status]}`}>{budgetLabel[b.status]}</span></p>
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Presupuesto y Odontograma</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline" onClick={duplicate}><Copy size={18} /> Duplicar</button>
            <a className="btn-outline" href={whatsappLink(p.phone, waText)} target="_blank" rel="noreferrer" onClick={() => b.status === "borrador" && set({ status: "enviado" })}><MessageCircle size={18} /> WhatsApp</a>
            <button className="btn-dark" onClick={() => window.print()}><FileDown size={18} /> PDF / Imprimir</button>
          </div>
        </div>

        <div className="card mb-5 flex flex-wrap items-center gap-4">
          <Avatar name={p.name} size={56} />
          <div className="flex-1">
            <Link href={`/pacientes/${p.id}`} className="text-lg font-bold hover:underline">{p.name}</Link>
            <p className="text-sm text-muted">{p.birthDate ? `${age(p.birthDate)} años · ` : ""}{p.phone}{p.allergies ? ` · Alergia: ${p.allergies}` : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {b.status === "borrador" && <button className="btn-outline" onClick={() => changeStatus("enviado")}><Send size={16} /> Marcar enviado</button>}
            {!locked && <button className="btn-outline text-danger" onClick={() => changeStatus("rechazado")}><X size={16} /> Rechazado</button>}
            {!locked && <button className="btn-primary" onClick={() => changeStatus("aceptado")}><Check size={16} /> Aceptado</button>}
            {locked && <button className="btn-outline" onClick={() => changeStatus("enviado")}>Reabrir</button>}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
          <section className="card">
            <h2 className="mb-1 text-lg font-bold">Odontograma</h2>
            <p className="mb-4 text-sm text-muted">Selecciona un diente para asignarle el tratamiento que agregues.</p>
            <Odontogram teeth={p.teeth} selected={selected} onSelect={(n) => setSelected(selected === n ? null : n)} />
            {selected != null && (
              <div className="mt-5 flex animate-rise flex-col gap-3 rounded-2xl bg-brand-soft p-4">
                <p className="font-semibold text-brand-dark">Diente {selected}: {statusLabel[p.teeth[selected] ?? "sano"]}</p>
                <ToothStatusPicker value={p.teeth[selected] ?? "sano"} onChange={setTooth} />
                {!locked && (
                  <div className="flex flex-wrap gap-1.5">
                    {db.procedures.slice(0, 6).map((pr) => (
                      <button key={pr.id} className="btn btn-sm border border-brand/30 bg-surface text-brand-dark hover:bg-brand hover:text-white" onClick={() => addItem(pr.id, selected)}>+ {pr.name}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!locked && suggested.length > 0 && (
              <div className="mt-4 rounded-2xl border border-dashed border-warn p-4 text-sm">
                <p className="mb-2 font-bold">Dientes sin tratamiento presupuestado</p>
                <div className="flex flex-wrap gap-2">
                  {suggested.map(([n, st]) => (
                    <button key={n} onClick={() => setSelected(+n)} className={`badge ${st === "problema" ? "bg-[#FBE3E0] text-[#9E2A20]" : "bg-[#FDF1D8] text-[#855A06]"}`}>Diente {n}</button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <aside className="card flex flex-col gap-4">
            <h2 className="text-lg font-bold">Conceptos</h2>
            {!locked && (
              <div className="flex gap-2">
                <label className="flex-1"><span className="sr-only">Procedimiento</span>
                  <select className="input" value={newProc} onChange={(e) => setNewProc(e.target.value)}>
                    {db.procedures.map((pr) => <option key={pr.id} value={pr.id}>{pr.name} — {mxn(pr.price)}</option>)}
                  </select>
                </label>
                <button className="btn-primary" onClick={() => addItem()}><Plus size={18} /> {selected ? `D${selected}` : "Agregar"}</button>
              </div>
            )}
            {b.items.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr>{b.status === "aceptado" && <th className="th">Hecho</th>}<th className="th">Procedimiento</th><th className="th">Cant.</th><th className="th">P. unit.</th><th className="th text-right">Subtotal</th>{!locked && <th className="th"><span className="sr-only">Quitar</span></th>}</tr></thead>
                  <tbody>
                    {b.items.map((r) => (
                      <tr key={r.id}>
                        {b.status === "aceptado" && b.items.length > 0 && (
              <div className="rounded-2xl bg-brand-soft p-4 text-brand-dark">
                <div className="mb-2 flex justify-between text-sm"><b>Avance del tratamiento</b><span>{doneCount} de {b.items.length}</span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface"><div className="h-full bg-brand transition-all" style={{ width: `${(doneCount / b.items.length) * 100}%` }} /></div>
                <p className="mt-2 text-xs">Marca cada concepto al realizarlo: el diente se actualiza y se descuenta el material del inventario.</p>
              </div>
            )}
            {b.status === "aceptado" && (
                          <td className="td">
                            <button aria-label={r.doneDate ? "Marcar pendiente" : "Marcar realizado"} onClick={() => toggleDone(r)}
                              className={`grid h-7 w-7 place-items-center rounded-lg border-2 transition ${r.doneDate ? "border-brand bg-brand text-white" : "border-edge hover:border-brand"}`}>
                              {r.doneDate && <Check size={14} strokeWidth={3} />}
                            </button>
                          </td>
                        )}
                        <td className={`td font-semibold ${r.doneDate ? "text-muted line-through decoration-brand/50" : ""}`}>{r.name}{r.tooth && <span className="block text-xs font-normal text-muted no-underline">Diente {r.tooth}</span>}{r.doneDate && <span className="block text-xs font-normal text-brand-dark">Realizado {fmtDate(r.doneDate, { day: "numeric", month: "short" })}</span>}</td>
                        <td className="td">{locked ? r.qty : <input type="number" min={1} aria-label="Cantidad" className="input min-h-[36px] w-16" value={r.qty} onChange={(e) => setItems(b.items.map((x) => x.id === r.id ? { ...x, qty: Math.max(1, +e.target.value) } : x))} />}</td>
                        <td className="td">{locked ? mxn(r.price) : <input type="number" min={0} aria-label="Precio" className="input min-h-[36px] w-24" value={r.price} onChange={(e) => setItems(b.items.map((x) => x.id === r.id ? { ...x, price: Math.max(0, +e.target.value) } : x))} />}</td>
                        <td className="td text-right font-bold">{mxn(r.price * r.qty)}</td>
                        {!locked && <td className="td"><button aria-label="Quitar" className="icon-btn hover:text-danger" onClick={() => setItems(b.items.filter((x) => x.id !== r.id))}><Trash2 size={16} /></button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState icon={Plus} title="Sin conceptos" text="Selecciona un diente y agrega tratamientos." />}

            <div className="flex items-center justify-between text-sm"><span>Subtotal</span><b>{mxn(totals.sub)}</b></div>
            <label className="flex items-center justify-between text-sm"><span>Descuento %</span>
              <input type="number" min={0} max={100} disabled={locked} className="input min-h-[36px] w-20" value={b.discount} onChange={(e) => set({ discount: Math.min(100, Math.max(0, +e.target.value)) })} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-gradient-to-br from-navy to-navy-700 p-4 text-white"><p className="text-xs text-[#B8C9DA]">Total presupuestado</p><p className="text-2xl font-extrabold">{mxn(totals.total)}</p></div>
              <div className="rounded-xl bg-brand-soft p-4 text-brand-dark"><p className="text-xs">Utilidad estimada</p><p className="text-2xl font-extrabold">{mxn(totals.profit)}</p></div>
            </div>
            <div>
              <div className="flex h-3 overflow-hidden rounded-full bg-bg"><div className="bg-cost transition-all" style={{ width: `${totals.total ? 100 - totals.pct : 0}%` }} /><div className="bg-brand transition-all" style={{ width: `${totals.pct}%` }} /></div>
              <p className="mt-1.5 flex justify-between text-xs text-ink-soft"><span>Costo materiales {mxn(totals.cost)}</span><span>Margen {totals.pct}%</span></p>
            </div>
            <label className="label">Notas para el paciente<textarea className="input min-h-[70px]" disabled={locked} value={b.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} placeholder="Vigencia, forma de pago, indicaciones…" /></label>

            {b.status === "aceptado" && (
              <div className="rounded-2xl border border-line p-4">
                <div className="mb-2 flex items-center justify-between text-sm"><b>Pagos</b><span>{mxn(paid)} de {mxn(totals.total)}</span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-bg"><div className="h-full bg-brand transition-all" style={{ width: `${Math.min(100, (paid / (totals.total || 1)) * 100)}%` }} /></div>
                {payments.map((x) => <p key={x.id} className="mt-2 flex justify-between text-xs text-muted"><span>{fmtDate(x.date)} · {methodLabel[x.method]}</span><b>{mxn(x.amount)}</b></p>)}
                {paid < totals.total && <button className="btn-primary mt-3 w-full" onClick={() => setPay(true)}><CircleDollarSign size={18} /> Registrar abono ({mxn(totals.total - paid)} pendiente)</button>}
              </div>
            )}
          </aside>
        </div>
        <div className="mt-8 text-right"><button className="btn-ghost text-sm text-danger" onClick={del}><Trash2 size={16} /> Eliminar presupuesto</button></div>
      </div>

      {/* ---------- Versión imprimible ---------- */}
      <article className="hidden text-[13px] text-black print:block">
        <header className="flex items-start justify-between border-b-2 border-navy pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand"><Logo size={26} /></div>
            <div><p className="text-xl font-extrabold text-navy">{s.clinicName}</p><p>{s.doctorName} · {s.specialty} · {s.license}</p><p className="text-xs">{s.address} · Tel. {s.phone} · {s.email}</p></div>
          </div>
          <div className="text-right"><p className="text-lg font-extrabold text-navy">PRESUPUESTO</p><p>Folio #{b.folio}</p><p>{fmtDate(b.createdAt, { day: "numeric", month: "long", year: "numeric" })}</p></div>
        </header>
        <section className="my-4 grid grid-cols-2 gap-2 rounded-lg bg-bg p-3">
          <p><b>Paciente:</b> {p.name}</p><p><b>Teléfono:</b> {p.phone}</p>
          {p.birthDate && <p><b>Edad:</b> {age(p.birthDate)} años</p>}{p.allergies && <p><b>Alergias:</b> {p.allergies}</p>}
        </section>
        <div className="mb-4"><Odontogram teeth={p.teeth} compact /></div>
        <table className="w-full border-collapse">
          <thead><tr className="bg-navy text-white"><th className="p-2 text-left">Tratamiento</th><th className="p-2 text-left">Diente</th><th className="p-2 text-right">Cant.</th><th className="p-2 text-right">P. unitario</th><th className="p-2 text-right">Importe</th></tr></thead>
          <tbody>{b.items.map((r) => (
            <tr key={r.id} className="border-b border-line"><td className="p-2">{r.name}</td><td className="p-2">{r.tooth ?? "—"}</td><td className="p-2 text-right">{r.qty}</td><td className="p-2 text-right">{mxn(r.price)}</td><td className="p-2 text-right">{mxn(r.price * r.qty)}</td></tr>
          ))}</tbody>
        </table>
        <div className="ml-auto mt-3 w-64 space-y-1">
          <p className="flex justify-between"><span>Subtotal</span><span>{mxn(totals.sub)}</span></p>
          {b.discount > 0 && <p className="flex justify-between"><span>Descuento ({b.discount}%)</span><span>-{mxn(totals.sub - totals.total)}</span></p>}
          <p className="flex justify-between border-t-2 border-navy pt-1 text-lg font-extrabold text-navy"><span>Total</span><span>{mxn(totals.total)}</span></p>
        </div>
        {b.notes && <p className="mt-4 rounded-lg border border-line p-3"><b>Notas:</b> {b.notes}</p>}
        <p className="mt-4 text-xs text-muted">Presupuesto válido por 30 días. Los precios pueden variar según la evolución clínica del tratamiento.</p>
        <div className="mt-16 grid grid-cols-2 gap-16 text-center text-xs">
          <div className="border-t border-black pt-1">{s.doctorName}</div>
          <div className="border-t border-black pt-1">Firma de conformidad del paciente</div>
        </div>
      </article>

      <PaymentFormModal open={pay} onClose={() => setPay(false)} patientId={p.id} budgetId={b.id} />
    </>
  );
}
