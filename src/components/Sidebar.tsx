"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { BarChart3, CalendarDays, Cloud, FileText, HardDrive, LayoutDashboard, LineChart, LogOut, Package, Settings, Users, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { today } from "@/lib/format";

import { Logo } from "./Logo";
export { Logo };

/** Secciones que solo ve el doctor cuando hay roles (modo nube). */
export const doctorOnly = ["/finanzas", "/reportes", "/configuracion"];

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const path = usePathname();
  const { db, role, mode, profile, clinic, signOut } = useStore();
  useEffect(onClose, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = today();
  const pendingToday = db.appointments.filter((a) => a.date === t && !["completada", "cancelada"].includes(a.status)).length;
  const lowStock = db.materials.filter((m) => m.stock < m.alertLevel).length;
  const drafts = db.budgets.filter((b) => b.status === "borrador" || b.status === "enviado").length;

  const items = [
    { href: "/", label: "Inicio", icon: LayoutDashboard },
    { href: "/agenda", label: "Citas", icon: CalendarDays, count: pendingToday },
    { href: "/pacientes", label: "Pacientes", icon: Users },
    { href: "/presupuestos", label: "Presupuestos", icon: FileText, count: drafts },
    { href: "/finanzas", label: "Ingresos / Egresos", icon: LineChart },
    { href: "/reportes", label: "Reportes", icon: BarChart3 },
    { href: "/inventario", label: "Inventario", icon: Package, count: lowStock, alert: true },
    { href: "/configuracion", label: "Configuración", icon: Settings },
  ].filter((i) => role !== "recepcion" || !doctorOnly.includes(i.href));

  return (
    <>
      {open && <div className="fixed inset-0 z-40 animate-fade bg-navy/50 md:hidden" onClick={onClose} />}
      <nav aria-label="Menú principal"
        className={`sidebar fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-navy p-5 text-[#DCE6F0] transition-transform md:sticky md:top-0 md:h-screen md:w-64 md:translate-x-0 print:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-3 px-2 pb-7">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#2BC487] to-[#0A6B46] shadow-lg shadow-brand/30"><Logo /></div>
          <div className="flex-1">
            <div className="font-extrabold leading-tight text-white">{db.settings.clinicName.split(" ")[0]}</div>
            <div className="text-xs tracking-widest text-navy-300">{db.settings.clinicName.split(" ").slice(1).join(" ").toUpperCase() || "CLÍNICA"}</div>
          </div>
          <button onClick={onClose} className="md:hidden" aria-label="Cerrar menú"><X size={20} /></button>
        </div>
        <div className="flex flex-col gap-1">
          {items.map(({ href, label, icon: Icon, count, alert }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link key={href} href={href}
                className={`group flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm transition ${active ? "bg-brand font-bold text-white shadow-lg shadow-black/10" : "hover:bg-navy-700 hover:text-white"}`}>
                <Icon size={18} aria-hidden="true" className={active ? "" : "opacity-80 group-hover:opacity-100"} />
                <span className="flex-1">{label}</span>
                {!!count && (
                  <span className={`min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold ${alert ? "bg-danger text-white" : active ? "bg-white/25" : "bg-white/10"}`}>{count}</span>
                )}
              </Link>
            );
          })}
        </div>
        <div className="mt-auto rounded-2xl bg-white/5 p-4 text-xs">
          <p className="font-bold text-white">{profile?.nombre ?? db.settings.doctorName}</p>
          <p className="text-navy-300">{profile ? (profile.rol === "doctor" ? "Doctor" : "Recepción") : db.settings.specialty}</p>
          <p className="mt-2 flex items-center gap-1.5 text-navy-300">
            {mode === "cloud" ? <><Cloud size={13} className="text-[#4BD69B]" /> En la nube · {clinic?.nombre}</> : <><HardDrive size={13} /> Datos en este navegador</>}
          </p>
          {mode === "cloud" && <button onClick={signOut} className="mt-3 flex items-center gap-1.5 font-semibold text-white/80 hover:text-white"><LogOut size={13} /> Cerrar sesión</button>}
        </div>
      </nav>
    </>
  );
}
