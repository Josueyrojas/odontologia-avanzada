"use client";
import { ShieldCheck } from "lucide-react";
import AdminPanel from "@/components/AdminPanel";
import { EmptyState } from "@/components/ui";
import { useStore } from "@/lib/store";

export default function AdminPage() {
  const { isAdmin, mode } = useStore();
  if (!isAdmin) {
    return <EmptyState icon={ShieldCheck} title="Sección restringida" text={mode === "local" ? "El panel de licencias solo existe en modo nube." : "Solo el administrador de Odonty puede entrar aquí."} />;
  }
  return <AdminPanel />;
}
