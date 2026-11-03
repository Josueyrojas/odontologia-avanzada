"use client";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, Minus, Package, Pencil, Plus, ShoppingCart, Trash2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { EmptyState, Modal, SearchInput, StatCard, useUI } from "@/components/ui";
import { ExpenseFormModal } from "@/components/forms";
import { useCollection, useStore } from "@/lib/store";
import { fmtDate, fmtQty, monthKey, mxn, today, uid } from "@/lib/format";
import type { Material } from "@/lib/types";

const status = (m: Material) =>
  m.stock < m.alertLevel ? { t: "Stock bajo", c: "bg-[#FBE3E0] text-[#9E2A20]", bar: "bg-danger", k: 0 }
  : m.stock < m.alertLevel * 1.6 ? { t: "Por agotarse", c: "bg-[#FDF1D8] text-[#855A06]", bar: "bg-warn", k: 1 }
  : { t: "En stock", c: "bg-brand-soft text-brand-dark", bar: "bg-brand", k: 2 };

export default function InventarioPage() {
  const { db } = useStore();
  const materials = useCollection("materials");
  const { toast, confirm } = useUI();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Todas");
  const [onlyLow, setOnlyLow] = useState(false);
  const [buy, setBuy] = useState<{ materialId?: string } | null>(null);
  const [edit, setEdit] = useState<Material | null | undefined>(undefined); // undefined = cerrado, null = nuevo
  const [use, setUse] = useState<Material | null>(null);
  const [useQty, setUseQty] = useState(1);

  const cats = ["Todas", ...new Set(db.materials.map((m) => m.category))];
  const rows = useMemo(() => db.materials
    .filter((m) => (cat === "Todas" || m.category === cat) && (!onlyLow || status(m).k < 2) && m.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => status(a).k - status(b).k || a.name.localeCompare(b.name)), [db.materials, q, cat, onlyLow]);
  const low = db.materials.filter((m) => m.stock < m.alertLevel);
  const value = db.materials.reduce((a, m) => a + m.stock * m.lastCost, 0);
  const purchases = db.expenses.filter((e) => e.materialId).slice(0, 8);

  const consume = () => {
    if (!use) return;
    const qty = Math.min(useQty, use.stock);
    materials.patch(use.id, { stock: use.stock - qty });
    toast(`Se descontaron ${qty} ${use.unit} de ${use.name}`);
    if (use.stock - qty < use.alertLevel) setTimeout(() => toast(`${use.name} quedó por debajo del mínimo`, "error"), 300);
    setUse(null);
  };
  const del = async (m: Material) => {
    if (await confirm({ title: "Eliminar material", text: `¿Eliminar "${m.name}" del inventario?`, danger: true, confirmLabel: "Eliminar" })) { materials.remove(m.id); toast("Material eliminado", "info"); }
  };

  return (
    <>
      <PageHeader kicker="Almacén del consultorio" title="Inventario y Egresos">
        <button className="btn-outline" onClick={() => setBuy({})}><ShoppingCart size={18} /> Registrar compra</button>
        <button className="btn-primary" onClick={() => setEdit(null)}><Plus size={18} /> Nuevo material</button>
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Materiales" value={String(db.materials.length)} icon={Boxes} tone="navy" />
        <StatCard label="Valor del inventario" value={mxn(value)} icon={Package} />
        <StatCard label="En alerta" value={String(low.length)} icon={AlertTriangle} tone={low.length ? "red" : "green"} note={low.length ? "requieren compra" : "todo en orden"} />
        <StatCard label="Compras del mes" value={mxn(db.expenses.filter((e) => e.materialId && monthKey(e.date) === monthKey(today())).reduce((a, e) => a + e.amount, 0))} icon={ShoppingCart} />
      </div>

      {low.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#F5C9C3] bg-[#FDF3F2] p-4">
          <AlertTriangle className="text-danger" size={20} />
          <p className="flex-1 text-sm"><b>{low.length} materiales</b> por debajo del mínimo: {low.map((m) => m.name).join(", ")}</p>
          <button className="btn-danger btn-sm" onClick={() => setBuy({ materialId: low[0].id })}>Reabastecer</button>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[3fr_1.2fr]">
        <section className="card">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="min-w-[200px] flex-1"><SearchInput value={q} onChange={setQ} placeholder="Buscar material…" /></div>
            <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoría">{cats.map((c) => <option key={c}>{c}</option>)}</select>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-brand" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} /> Solo alertas</label>
          </div>
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr><th className="th">Material</th><th className="th">Stock</th><th className="th">Mínimo</th><th className="th">Último costo</th><th className="th">Estado</th><th className="th text-right">Acciones</th></tr></thead>
                <tbody>
                  {rows.map((m) => { const s = status(m); return (
                    <tr key={m.id} className="row-hover">
                      <td className="td"><p className="font-semibold">{m.name}</p><p className="text-xs text-muted">{m.category}</p></td>
                      <td className="td">
                        <p className="font-bold">{fmtQty(m.stock)} <span className="font-normal text-muted">{m.unit}</span></p>
                        <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-bg"><div className={`h-full ${s.bar}`} style={{ width: `${Math.min(100, (m.stock / (m.alertLevel * 2 || 1)) * 100)}%` }} /></div>
                      </td>
                      <td className="td text-muted">{m.alertLevel}</td>
                      <td className="td">{mxn(m.lastCost)}</td>
                      <td className="td"><span className={`badge ${s.c}`}>{s.t}</span></td>
                      <td className="td">
                        <div className="flex justify-end gap-1">
                          <button className="icon-btn" title="Registrar uso" aria-label="Registrar uso" onClick={() => { setUse(m); setUseQty(1); }}><Minus size={16} /></button>
                          <button className="icon-btn text-brand" title="Comprar" aria-label="Comprar" onClick={() => setBuy({ materialId: m.id })}><ShoppingCart size={16} /></button>
                          <button className="icon-btn" title="Editar" aria-label="Editar" onClick={() => setEdit(m)}><Pencil size={16} /></button>
                          <button className="icon-btn hover:text-danger" title="Eliminar" aria-label="Eliminar" onClick={() => del(m)}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon={Package} title="Sin materiales" text="Ajusta los filtros o agrega un material." />}
        </section>

        <aside className="card h-fit">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Compras recientes</h2><button className="btn-primary btn-sm" onClick={() => setBuy({})}><Plus size={14} /> Compra</button></div>
          {purchases.length ? purchases.map((e) => {
            const m = db.materials.find((x) => x.id === e.materialId);
            return (
              <div key={e.id} className="flex items-center gap-3 border-t border-line py-3 first:border-0">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-dark"><ShoppingCart size={16} /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{m?.name ?? "Material"}</p><p className="text-xs text-muted">+{e.qty} {m?.unit} · {e.supplier} · {fmtDate(e.date, { day: "numeric", month: "short" })}</p></div>
                <b className="text-sm">{mxn(e.amount)}</b>
              </div>
            );
          }) : <p className="text-sm text-muted">Aún no hay compras de materiales. Registra una para que el stock se actualice automáticamente.</p>}
        </aside>
      </div>

      <ExpenseFormModal open={!!buy} onClose={() => setBuy(null)} materialId={buy?.materialId} />
      <MaterialModal material={edit} onClose={() => setEdit(undefined)} />
      <Modal open={!!use} onClose={() => setUse(null)} title="Registrar uso de material" subtitle={use?.name} size="sm"
        footer={<><button className="btn-outline" onClick={() => setUse(null)}>Cancelar</button><button className="btn-primary" onClick={consume}>Descontar</button></>}>
        <p className="mb-3 text-sm text-muted">Stock actual: <b className="text-ink">{fmtQty(use?.stock ?? 0)} {use?.unit}</b></p>
        <div className="flex items-center justify-center gap-3">
          <button className="btn-outline px-3" aria-label="Menos" onClick={() => setUseQty(Math.max(1, useQty - 1))}><Minus size={18} /></button>
          <input type="number" min={1} max={use?.stock} aria-label="Cantidad" className="input w-24 text-center text-xl font-bold" value={useQty} onChange={(e) => setUseQty(Math.max(1, +e.target.value))} />
          <button className="btn-outline px-3" aria-label="Más" onClick={() => setUseQty(Math.min(use?.stock ?? 1, useQty + 1))}><Plus size={18} /></button>
        </div>
      </Modal>
    </>
  );
}

function MaterialModal({ material, onClose }: { material: Material | null | undefined; onClose: () => void }) {
  const { db } = useStore();
  const materials = useCollection("materials");
  const { toast } = useUI();
  const blank: Material = { id: "", name: "", category: "Insumos", stock: 0, unit: "pzas", alertLevel: 5, lastCost: 0 };
  const [f, setF] = useState<Material>(blank);
  useEffect(() => { if (material !== undefined) setF(material ?? blank); }, [material]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    materials.save({ ...f, id: f.id || `m${uid()}` });
    toast(material ? "Material actualizado" : "Material agregado");
    onClose();
  };
  return (
    <Modal open={material !== undefined} onClose={onClose} title={material ? "Editar material" : "Nuevo material"}
      footer={<><button type="button" className="btn-outline" onClick={onClose}>Cancelar</button><button form="mat-form" className="btn-primary">Guardar</button></>}>
      <form id="mat-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="label sm:col-span-2">Nombre *<input required className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ej. Resina A2" /></label>
        <label className="label">Categoría<input className="input" list="mat-cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
          <datalist id="mat-cats">{[...new Set(db.materials.map((m) => m.category))].map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label className="label">Unidad<input className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="cajas, pzas, kits…" /></label>
        <label className="label">Stock actual<input type="number" min={0} className="input" value={f.stock} onChange={(e) => setF({ ...f, stock: +e.target.value })} /></label>
        <label className="label">Nivel mínimo (alerta)<input type="number" min={0} className="input" value={f.alertLevel} onChange={(e) => setF({ ...f, alertLevel: +e.target.value })} /></label>
        <label className="label sm:col-span-2">Costo unitario<input type="number" min={0} className="input" value={f.lastCost} onChange={(e) => setF({ ...f, lastCost: +e.target.value })} /></label>
      </form>
    </Modal>
  );
}
