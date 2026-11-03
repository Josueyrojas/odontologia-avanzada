"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
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

export default function Shell({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState(false);
  return (
    <UIProvider>
      <StoreProvider>
        <div className="flex min-h-screen">
          <Sidebar open={menu} onClose={() => setMenu(false)} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar onMenu={() => setMenu(true)} />
            <main className="flex-1 animate-rise p-4 md:p-8 print:p-0"><Guard>{children}</Guard></main>
          </div>
        </div>
      </StoreProvider>
    </UIProvider>
  );
}
