import Link from "next/link";
import { Logo } from "./Logo";
import { LEGAL } from "@/lib/legal";

/** Diseño compartido para las páginas legales públicas. */
export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#2BC487] to-[#0A6B46]"><Logo size={18} /></span>
            <span className="text-lg font-extrabold tracking-tight">Odon<span className="text-brand">ty</span></span>
          </Link>
          <nav className="ml-auto flex gap-4 text-sm font-semibold text-muted">
            <Link href="/privacidad" className="hover:text-ink">Privacidad</Link>
            <Link href="/terminos" className="hover:text-ink">Términos</Link>
          </nav>
        </div>
      </header>
      <article className="legal mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm font-semibold text-muted">Última actualización: {LEGAL.actualizado}</p>
        <h1 className="mb-6 mt-1 text-3xl font-extrabold tracking-tight">{title}</h1>
        {children}
      </article>
    </div>
  );
}
