"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { CalendarClock, Lock } from "lucide-react";
import { license } from "@/lib/cloud";
import { fmtDate } from "@/lib/format";
import { SupportLinks } from "./AuthScreens";
import { StoreProvider, useStore } from "@/lib/store";
import { EmptyState, UIProvider } from "./ui";
import Sidebar, { doctorOnly } from "./Sidebar";
import Topbar from "./Topbar";

function Guard({ children }: { children: React.ReactNode }) {
  const { role } = useStore();
  const path = usePathname();
  if (role === "recepcion" && doctorOnly.some((p) => path.startsWith(p))) {
    return <EmptyState icon={Lock} title="Sección exclusiva del doctor" text="Pide al doctor que cambie tu rol si necesitas acceso." action={<Link href="/" className="btn-primary">Ir al inicio</Link>} />;
  }
  return <>{children}</>;
}

/** Aviso cuando la licencia de la clínica está por vencer o en días de gracia. */
function LicenseBanner() {
  const { clinic, role } = useStore();
  if (!clinic) return null;
  const { state, daysLeft } = license(clinic);
  if (state !== "por_vencer" && state !== "gracia") return null;
  const when = fmtDate(clinic.vence_el!, { day: "numeric", month: "long" });
  const text = state === "gracia"
    ? `La licencia de Odonty venció el ${when}. El acceso se bloqueará en ${Math.max(0, 5 + (daysLeft ?? 0))} días.`
    : daysLeft === 0 ? "La licencia de Odonty vence hoy." : `La licencia de Odonty vence en ${daysLeft} días (${when}).`;
  return (
    <div className={`mb-5 flex flex-wrap items-center gap-3 rounded-2xl border p-4 text-sm print:hidden ${state === "gracia" ? "border-[#F5C9C3] bg-[#FDF3F2] text-[#9E2A20]" : "border-warn/50 bg-[#FDF1D8] text-[#855A06]"}`}>
      <CalendarClock size={20} />
      <p className="flex-1 font-semibold">{text} {role === "recepcion" ? "Avísale al doctor." : "Renueva para no perder el acceso."}</p>
      {role === "doctor" && <SupportLinks small message={`Hola, quiero renovar Odonty para la clínica "${clinic.nombre}".`} />}
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState(false);
  return (
    <UIProvider>
      <StoreProvider>
        <div className="flex min-h-screen">
          <Sidebar open={menu} onClose={() => setMenu(false)} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar onMenu={() => setMenu(true)} />
            <main className="flex-1 animate-rise p-4 md:p-8 print:p-0"><LicenseBanner /><Guard>{children}</Guard></main>
          </div>
        </div>
      </StoreProvider>
    </UIProvider>
  );
}
