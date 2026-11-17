"use client";
// Pantallas de acceso del modo nube: sesión, alta de clínica y configuración inicial.
import { useState } from "react";
import Image from "next/image";
import { Building2, CalendarCheck, Clock, Cloud, Database, KeyRound, Lock, LogOut, Mail, MessageCircle, ShieldCheck, Sparkles, Upload, Users } from "lucide-react";
import { fmtDate, whatsappLink } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { createClinic, joinClinic, license, type Clinic, type Profile } from "@/lib/cloud";
import { createSeed } from "@/lib/mock-data";
import type { DB } from "@/lib/types";
import { Logo } from "./Logo";

/** Traduce los mensajes más comunes de Supabase Auth. */
const es = (msg: string) => {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Correo o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "Confirma tu correo antes de entrar (revisa tu bandeja y spam).";
  if (m.includes("already registered")) return "Ese correo ya tiene cuenta. Inicia sesión.";
  if (m.includes("password should be")) return "La contraseña debe tener al menos 6 caracteres.";
  if (m.includes("rate limit")) return "Demasiados intentos. Espera un momento.";
  if (m.includes("failed to fetch") || m.includes("network")) return "No hay conexión con el servidor. Revisa tu internet o la configuración de Supabase.";
  return msg;
};

/** Marca del producto. */
function Brand({ size = "lg" }: { size?: "lg" | "sm" }) {
  const big = size === "lg";
  return (
    <div className="flex items-center gap-3">
      <div className={`grid place-items-center rounded-2xl bg-gradient-to-br from-[#2BC487] to-[#0A6B46] shadow-lg shadow-black/20 ${big ? "h-12 w-12" : "h-11 w-11"}`}><Logo size={big ? 26 : 22} /></div>
      <div>
        <p className={`font-extrabold leading-tight tracking-tight ${big ? "text-2xl" : "text-xl"}`}>Odon<span className="text-[#2BC487]">ty</span></p>
        <p className={`text-[11px] font-semibold tracking-[.2em] ${big ? "text-white/60" : "text-muted"}`}>GESTIÓN DENTAL</p>
      </div>
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-bg lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-navy p-12 text-white lg:flex lg:flex-col">
        {/* Foto del consultorio, desvanecida hacia el azul de la marca para que el texto se lea */}
        <Image src="/acceso-consultorio.jpg" alt="" fill priority sizes="55vw" className="animate-[drift_30s_ease-out_both] object-cover object-[center_30%] opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/75 to-navy/0" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy/50 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-[#0E4D57]/50" />
        <div className="relative"><Brand /></div>
        <div className="relative mt-auto max-w-md">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">Tu consultorio, en orden y en la nube.</h1>
          <ul className="mt-8 space-y-4 text-[#C9D6E3]">
            {[
              [CalendarCheck, "Agenda, expediente, presupuestos e inventario en un solo lugar"],
              [Users, "Doctor y recepción ven los cambios al instante"],
              [ShieldCheck, "Cada clínica solo ve sus propios datos"],
            ].map(([Icon, t], i) => {
              const I = Icon as typeof CalendarCheck;
              return <li key={i} className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-[#4BD69B] backdrop-blur"><I size={18} /></span><span className="pt-1.5">{t as string}</span></li>;
            })}
          </ul>
        </div>
      </div>
      <div className="grid place-items-center p-4 sm:p-8">
        <div className="w-full max-w-md animate-rise">{children}</div>
      </div>
    </div>
  );
}

export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const auth = supabase!.auth;
    try {
      if (mode === "login") {
        const { error } = await auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (!data.session) setMsg({ ok: true, text: "Te enviamos un correo para confirmar tu cuenta. Ábrelo y luego inicia sesión." });
      } else {
        const { error } = await auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setMsg({ ok: true, text: "Si el correo existe, recibirás un enlace para crear una contraseña nueva." });
      }
    } catch (err) {
      setMsg({ ok: false, text: es(err instanceof Error ? err.message : String(err)) });
    } finally { setBusy(false); }
  };

  const titles = { login: "Inicia sesión", signup: "Crea tu cuenta", forgot: "Recuperar contraseña" };
  return (
    <Frame>
      <div className="mb-8 lg:hidden"><Brand size="sm" /></div>
      <h2 className="text-2xl font-extrabold tracking-tight">{titles[mode]}</h2>
      <p className="mb-6 mt-1 text-sm text-muted">
        {mode === "login" ? "Entra con tu correo del consultorio." : mode === "signup" ? "Después podrás crear tu clínica o unirte con un código." : "Te enviaremos un enlace a tu correo."}
      </p>
      <form onSubmit={submit} className="card flex flex-col gap-4">
        <label className="label">Correo<input required type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="doctor@consultorio.com" /></label>
        {mode !== "forgot" && (
          <label className="label">
            <span className="flex justify-between">Contraseña{mode === "login" && <button type="button" className="text-xs font-bold text-brand" onClick={() => { setMode("forgot"); setMsg(null); }}>¿La olvidaste?</button>}</span>
            <input required type="password" minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}
        {msg && <p className={`rounded-xl p-3 text-sm ${msg.ok ? "bg-brand-soft text-brand-dark" : "bg-[#FBE3E0] text-[#9E2A20]"}`}>{msg.text}</p>}
        <button disabled={busy} className="btn-primary">{busy ? "Un momento…" : mode === "login" ? "Entrar" : mode === "signup" ? "Crear cuenta" : "Enviar enlace"}</button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        {mode === "login" ? <>¿Primera vez? <button className="font-bold text-brand" onClick={() => { setMode("signup"); setMsg(null); }}>Crea una cuenta</button></>
          : <>¿Ya tienes cuenta? <button className="font-bold text-brand" onClick={() => { setMode("login"); setMsg(null); }}>Inicia sesión</button></>}
      </p>
    </Frame>
  );
}

export function RecoveryScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    const { error } = await supabase!.auth.updateUser({ password });
    setBusy(false);
    if (error) setErr(es(error.message)); else onDone();
  };
  return (
    <Frame>
      <h2 className="text-2xl font-extrabold tracking-tight">Nueva contraseña</h2>
      <p className="mb-6 mt-1 text-sm text-muted">Escribe tu nueva contraseña para entrar.</p>
      <form onSubmit={submit} className="card flex flex-col gap-4">
        <label className="label">Contraseña nueva<input required type="password" minLength={6} autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {err && <p className="rounded-xl bg-[#FBE3E0] p-3 text-sm text-[#9E2A20]">{err}</p>}
        <button disabled={busy} className="btn-primary"><KeyRound size={18} /> Guardar y entrar</button>
      </form>
    </Frame>
  );
}

export function OnboardingScreen({ email, onDone, onSignOut }: { email: string; onDone: () => void; onSignOut: () => void }) {
  const [mode, setMode] = useState<"crear" | "unirse">("crear");
  const [name, setName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      if (mode === "crear") await createClinic(clinicName.trim(), name.trim());
      else await joinClinic(code.trim(), name.trim());
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };
  return (
    <Frame>
      <h2 className="text-2xl font-extrabold tracking-tight">Bienvenido 👋</h2>
      <p className="mb-6 mt-1 text-sm text-muted">Sesión iniciada como <b>{email}</b>. ¿Cómo usarás el sistema?</p>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {([["crear", Building2, "Soy el doctor", "Crear mi clínica"], ["unirse", Users, "Soy del equipo", "Unirme con código"]] as const).map(([m, Icon, t, sub]) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={`flex flex-col items-start gap-1 rounded-2xl border-2 p-4 text-left transition ${mode === m ? "border-brand bg-brand-soft" : "border-line bg-surface hover:bg-bg"}`}>
            <Icon size={20} className="text-brand" /><b className="text-sm">{t}</b><span className="text-xs text-muted">{sub}</span>
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="card flex flex-col gap-4">
        <label className="label">Tu nombre<input required className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={mode === "crear" ? "Dr. Nombre Apellido" : "Nombre Apellido"} /></label>
        {mode === "crear"
          ? <label className="label">Nombre de la clínica<input required className="input" value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="Odontología Avanzada" /></label>
          : <label className="label">Código de la clínica<input required className="input text-center text-lg font-bold uppercase tracking-[.4em]" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="A1B2C3" />
              <span className="text-xs font-normal text-muted">El doctor lo encuentra en Configuración › Equipo.</span></label>}
        {err && <p className="rounded-xl bg-[#FBE3E0] p-3 text-sm text-[#9E2A20]">{err}</p>}
        <button disabled={busy} className="btn-primary">{busy ? "Un momento…" : mode === "crear" ? "Crear clínica" : "Unirme"}</button>
      </form>
      <button onClick={onSignOut} className="btn-ghost mx-auto mt-4 flex text-sm text-muted"><LogOut size={16} /> Cerrar sesión</button>
    </Frame>
  );
}

/** Estado vacío para una clínica nueva, con el catálogo de tratamientos base y sin datos de ejemplo. */
function blankDB(clinic: Clinic, profile: Profile): DB {
  const seed = createSeed();
  return {
    ...seed,
    settings: { ...seed.settings, clinicName: clinic.nombre, doctorName: profile.nombre, phone: "", address: "", email: profile.email ?? "", license: "" },
    procedures: seed.procedures.map((p) => ({ ...p, materials: [] })),
    patients: [], appointments: [], budgets: [], payments: [], materials: [], expenses: [], prescriptions: [], consents: [],
  };
}

export function SetupScreen({ clinic, profile, local, onChoose }: { clinic: Clinic; profile: Profile; local: DB | null; onChoose: (db: DB) => void }) {
  const options = [
    ...(local ? [{
      icon: Upload, title: "Subir los datos de este navegador", recommended: true,
      text: `${local.patients.length} pacientes, ${local.appointments.length} citas, ${local.payments.length} pagos y todo lo demás que ya capturaste.`,
      db: () => ({ ...local, settings: { ...local.settings, clinicName: clinic.nombre } }),
    }] : []),
    { icon: Database, title: "Empezar en blanco", recommended: !local, text: "Con el catálogo de tratamientos base. Ideal para comenzar a trabajar.", db: () => blankDB(clinic, profile) },
    { icon: Sparkles, title: "Cargar datos de ejemplo", recommended: false, text: "Para explorar el sistema. Podrás borrarlos después en Configuración.", db: () => ({ ...createSeed(), settings: { ...createSeed().settings, clinicName: clinic.nombre, doctorName: profile.nombre } }) },
  ];
  return (
    <Frame>
      <span className="badge mb-3 bg-brand-soft text-brand-dark"><Cloud size={12} /> {clinic.nombre}</span>
      <h2 className="text-2xl font-extrabold tracking-tight">Configuración inicial</h2>
      <p className="mb-6 mt-1 text-sm text-muted">Tu clínica está lista en la nube. ¿Con qué datos quieres empezar?</p>
      <div className="flex flex-col gap-3">
        {options.map((o) => (
          <button key={o.title} onClick={() => onChoose(o.db())} className="card card-hover flex items-start gap-4 !p-5 text-left">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-dark"><o.icon size={20} /></span>
            <span>
              <span className="flex items-center gap-2 font-bold">{o.title}{o.recommended && <span className="badge bg-brand text-white">Recomendado</span>}</span>
              <span className="mt-0.5 block text-sm text-muted">{o.text}</span>
            </span>
          </button>
        ))}
      </div>
    </Frame>
  );
}

export function CenterMessage({ title, text, action, actionLabel, onSignOut }: { title: string; text: string; action: () => void; actionLabel: string; onSignOut: () => void }) {
  return (
    <Frame>
      <div className="card text-center">
        <Cloud size={36} className="mx-auto mb-3 text-navy-300" />
        <h2 className="text-xl font-extrabold">{title}</h2>
        <p className="mt-2 text-sm text-muted">{text}</p>
        <div className="mt-5 flex justify-center gap-2">
          <button className="btn-outline" onClick={onSignOut}><LogOut size={16} /> Salir</button>
          <button className="btn-primary" onClick={action}>{actionLabel}</button>
        </div>
      </div>
    </Frame>
  );
}

/* ---------------- Licencia: pendiente, suspendida o vencida ---------------- */
const SOPORTE_WA = process.env.NEXT_PUBLIC_SOPORTE_WHATSAPP;
const SOPORTE_EMAIL = process.env.NEXT_PUBLIC_SOPORTE_EMAIL;

/** Botones para contactar a soporte de Odonty (configurables en .env). */
export function SupportLinks({ message, small }: { message: string; small?: boolean }) {
  if (!SOPORTE_WA && !SOPORTE_EMAIL) return null;
  const cls = small ? "btn-outline btn-sm" : "btn-outline";
  return (
    <>
      {SOPORTE_WA && <a className={cls} target="_blank" rel="noreferrer" href={whatsappLink(SOPORTE_WA, message)}><MessageCircle size={16} /> WhatsApp</a>}
      {SOPORTE_EMAIL && <a className={cls} href={`mailto:${SOPORTE_EMAIL}?subject=${encodeURIComponent("Odonty")}&body=${encodeURIComponent(message)}`}><Mail size={16} /> Correo</a>}
    </>
  );
}

export function LicenseScreen({ clinic, role, onRetry, onSignOut, onOpenAdmin }: {
  clinic: Clinic; role: "doctor" | "recepcion"; onRetry: () => void; onSignOut: () => void; onOpenAdmin?: () => void;
}) {
  const { state } = license(clinic);
  const pending = state === "pendiente";
  const title = pending ? "¡Tu clínica está registrada!" : state === "suspendida" ? "Acceso suspendido" : "Tu licencia venció";
  const text = pending
    ? role === "doctor"
      ? `Estamos activando Odonty para ${clinic.nombre}. En cuanto esté lista podrás entrar con esta misma cuenta.`
      : `${clinic.nombre} todavía no está activada. Avísale al doctor; en cuanto se active podrás entrar.`
    : `${state === "vencida" && clinic.vence_el ? `La licencia de ${clinic.nombre} venció el ${fmtDate(clinic.vence_el, { day: "numeric", month: "long", year: "numeric" })}. ` : ""}Tus datos están guardados y seguros. Para reactivar el acceso, comunícate con Odonty.`;
  const msg = pending
    ? `Hola, registré la clínica "${clinic.nombre}" en Odonty y quiero activarla.`
    : `Hola, quiero reactivar Odonty para la clínica "${clinic.nombre}".`;
  return (
    <Frame>
      <div className="card text-center">
        <span className={`mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl ${pending ? "bg-brand-soft text-brand-dark" : "bg-[#FDF1D8] text-[#855A06]"}`}>
          {pending ? <Clock size={28} /> : <Lock size={28} />}
        </span>
        <h2 className="text-xl font-extrabold">{title}</h2>
        <p className="mt-2 text-sm text-muted">{text}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {role === "doctor" && <SupportLinks message={msg} />}
          <button className="btn-primary" onClick={onRetry}>Ya está activa, entrar</button>
        </div>
        <div className="mt-4 flex justify-center gap-2">
          {onOpenAdmin && <button className="btn-ghost text-sm" onClick={onOpenAdmin}><ShieldCheck size={16} /> Panel de administrador</button>}
          <button className="btn-ghost text-sm text-muted" onClick={onSignOut}><LogOut size={16} /> Cerrar sesión</button>
        </div>
      </div>
    </Frame>
  );
}
