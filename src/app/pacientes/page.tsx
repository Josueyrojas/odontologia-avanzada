"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, Download, LayoutGrid, List, UserPlus, Users } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Avatar, EmptyState, SearchInput, StatCard } from "@/components/ui";
import { PatientFormModal } from "@/components/forms";
import { patientBalance, useStore } from "@/lib/store";
import { age, downloadCSV, fmtDate, monthKey, mxn, today } from "@/lib/format";

type Sort = "nombre" | "reciente" | "ultima" | "saldo";

export default function PacientesPage() {
  const { db } = useStore();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("nombre");
  const [grid, setGrid] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("nuevo")) setOpen(true); }, []);

  const t = today();
  const rows = useMemo(() => {
    const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    return db.patients
      .filter((p) => !q || norm(`${p.name} ${p.phone} ${p.email}`).includes(norm(q)))
      .map((p) => {
        const mine = db.appointments.filter((a) => a.patientId === p.id && a.status !== "cancelada");
        const last = mine.filter((a) => a.date <= t && a.status === "completada").sort((a, b) => b.date.localeCompare(a.date))[0];
        const next = mine.filter((a) => a.date >= t && a.status !== "completada").sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0];
        return { p, last, next, balance: patientBalance(db, p.id), visits: mine.filter((a) => a.status === "completada").length };
      })
      .sort((a, b) =>
        sort === "nombre" ? a.p.name.localeCompare(b.p.name)
        : sort === "reciente" ? b.p.createdAt.localeCompare(a.p.createdAt)
        : sort === "saldo" ? b.balance - a.balance
        : (b.last?.date ?? "").localeCompare(a.last?.date ?? ""));
  }, [db, q, sort, t]);

  const newThisMonth = db.patients.filter((p) => monthKey(p.createdAt) === monthKey(t)).length;
  const withBalance = rows.filter((r) => r.balance > 0).length;
  const exportCSV = () => downloadCSV("pacientes.csv", rows.map(({ p, last, balance }) => ({
    Nombre: p.name, Telefono: p.phone, Correo: p.email, Edad: p.birthDate ? age(p.birthDate) : "", Alergias: p.allergies,
    "Ultima visita": last?.date ?? "", Saldo: balance, Alta: p.createdAt,
  })));

  return (
    <>
      <PageHeader kicker="Directorio clínico" title="Pacientes">
        <button className="btn-outline" onClick={exportCSV}><Download size={18} /> Exportar</button>
        <button className="btn-primary" onClick={() => setOpen(true)}><UserPlus size={18} /> Nuevo paciente</button>
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Pacientes registrados" value={String(db.patients.length)} icon={Users} tone="navy" />
        <StatCard label="Nuevos este mes" value={String(newThisMonth)} icon={UserPlus} />
        <StatCard label="Con cita próxima" value={String(rows.filter((r) => r.next).length)} />
        <StatCard label="Con saldo pendiente" value={String(withBalance)} tone={withBalance ? "amber" : "white"} />
      </div>

      <section className="card">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] flex-1"><SearchInput value={q} onChange={setQ} placeholder="Buscar por nombre, teléfono o correo…" /></div>
          <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar">
            <option value="nombre">Nombre A–Z</option><option value="reciente">Registro más reciente</option>
            <option value="ultima">Última visita</option><option value="saldo">Mayor saldo</option>
          </select>
          <div className="flex rounded-xl border border-edge p-1">
            <button aria-label="Lista" onClick={() => setGrid(false)} className={`rounded-lg p-2 ${!grid ? "bg-navy text-white" : ""}`}><List size={16} /></button>
            <button aria-label="Tarjetas" onClick={() => setGrid(true)} className={`rounded-lg p-2 ${grid ? "bg-navy text-white" : ""}`}><LayoutGrid size={16} /></button>
          </div>
        </div>

        {!rows.length ? (
          <EmptyState icon={Users} title="No se encontraron pacientes" text={q ? "Prueba con otro término de búsqueda." : "Registra a tu primer paciente."} action={<button className="btn-primary" onClick={() => setOpen(true)}>Nuevo paciente</button>} />
        ) : grid ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {rows.map(({ p, last, next, balance }) => (
              <Link key={p.id} href={`/pacientes/${p.id}`} className="card-hover flex flex-col gap-3 rounded-2xl border border-line p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={p.name} size={46} />
                  <div className="min-w-0"><p className="truncate font-bold">{p.name}</p><p className="text-xs text-muted">{p.birthDate ? `${age(p.birthDate)} años · ` : ""}{p.phone}</p></div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {p.allergies && <span className="badge bg-[#FBE3E0] text-[#9E2A20]"><AlertTriangle size={12} /> {p.allergies}</span>}
                  {balance > 0 && <span className="badge bg-[#FDF1D8] text-[#855A06]">Debe {mxn(balance)}</span>}
                  {next && <span className="badge bg-brand-soft text-brand-dark">Cita {fmtDate(next.date, { day: "numeric", month: "short" })}</span>}
                </div>
                <p className="text-xs text-muted">Última visita: {last ? fmtDate(last.date) : "—"}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr><th className="th">Paciente</th><th className="th">Teléfono</th><th className="th">Última visita</th><th className="th">Próxima cita</th><th className="th">Saldo</th><th className="th" /></tr></thead>
              <tbody>
                {rows.map(({ p, last, next, balance, visits }) => (
                  <tr key={p.id} className="row-hover cursor-pointer" onClick={() => router.push(`/pacientes/${p.id}`)}>
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <Avatar name={p.name} size={36} />
                        <div>
                          <p className="font-bold">{p.name}</p>
                          <p className="text-xs text-muted">{p.birthDate ? `${age(p.birthDate)} años` : "Edad no registrada"} · {visits} visitas{p.allergies ? " · " : ""}{p.allergies && <span className="font-semibold text-danger">Alergia: {p.allergies}</span>}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td">{p.phone}</td>
                    <td className="td text-muted">{last ? fmtDate(last.date) : "—"}</td>
                    <td className="td">{next ? <span className="badge bg-brand-soft text-brand-dark">{fmtDate(next.date, { day: "numeric", month: "short" })} · {next.start}</span> : <span className="text-muted">—</span>}</td>
                    <td className={`td font-bold ${balance > 0 ? "text-cost" : "text-muted"}`}>{balance > 0 ? mxn(balance) : "—"}</td>
                    <td className="td text-muted"><ChevronRight size={18} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PatientFormModal open={open} onClose={() => setOpen(false)} onSaved={(p) => router.push(`/pacientes/${p.id}`)} />
    </>
  );
}
