"use client";
// Almacén central de la app.
// · Modo local (sin .env.local): todo vive en localStorage de este navegador.
// · Modo nube (con NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY): inicio de sesión, datos en Supabase
//   sincronizados cambio por cambio y en tiempo real entre doctor y recepción (ver src/lib/cloud.ts).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { DB } from "./types";
import { createSeed, DB_VERSION, seedProcedures } from "./mock-data";
import { supabase } from "./supabase";
import { applyRemote, cloudEnabled, diff, fullUpload, isAdmin as checkAdmin, license, loadDB, loadProfile, overlayPending, readPending, subscribe, SyncQueue, type Clinic, type Profile, type SyncState } from "./cloud";
import { useUI } from "@/components/ui";
import { AuthScreen, CenterMessage, LicenseScreen, OnboardingScreen, RecoveryScreen, SetupScreen } from "@/components/AuthScreens";
import AdminPanel from "@/components/AdminPanel";

export const LOCAL_KEY = "odontologia-avanzada:db";
export type Role = "doctor" | "recepcion";
export type { SyncState };

interface Ctx {
  db: DB;
  ready: boolean;
  /** Aplica un cambio inmutable al estado y lo persiste (localStorage o Supabase). */
  update: (fn: (db: DB) => DB) => void;
  reset: () => void;
  replace: (db: DB) => void;
  mode: "local" | "cloud";
  /** null en modo local: acceso total. */
  role: Role | null;
  profile: Profile | null;
  clinic: Clinic | null;
  sync: SyncState;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
  /** Administrador de Odonty (gestiona licencias de todas las clínicas). */
  isAdmin: boolean;
}
const StoreContext = createContext<Ctx | null>(null);

/** Actualiza datos guardados con versiones anteriores sin perder la información del usuario. */
export function migrate(d: DB): DB {
  if (d.version === 2) {
    d = {
      ...d,
      version: 3,
      prescriptions: d.prescriptions ?? [],
      procedures: d.procedures.map((p) => p.materials ? p : { ...p, materials: seedProcedures.find((s) => s.id === p.id)?.materials ?? [] }),
    };
  }
  if (d.version === 3) d = { ...d, version: 4, consents: d.consents ?? [] };
  return d.version === DB_VERSION ? d : createSeed();
}

/** Lee los datos guardados en este navegador (modo local), si existen. */
export function readLocal(): DB | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? migrate(JSON.parse(raw) as DB) : null;
  } catch { return null; }
}

const Loading = ({ text = "Cargando consultorio…" }: { text?: string }) => (
  <div className="grid min-h-screen place-items-center bg-bg">
    <div className="flex flex-col items-center gap-3 text-navy">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      <p className="text-sm font-semibold">{text}</p>
    </div>
  </div>
);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  return cloudEnabled ? <CloudStore>{children}</CloudStore> : <LocalStore>{children}</LocalStore>;
}

/* ====================== Modo local ====================== */
function LocalStore({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB | null>(null);

  useEffect(() => { setDb(readLocal() ?? createSeed()); }, []);
  useEffect(() => {
    if (!db) return;
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(db)); } catch { /* almacenamiento lleno o bloqueado */ }
  }, [db]);

  const update = useCallback((fn: (db: DB) => DB) => setDb((d) => (d ? fn(d) : d)), []);
  const reset = useCallback(() => setDb(createSeed()), []);
  const replace = useCallback((next: DB) => setDb(migrate(next)), []);
  const noop = useCallback(async () => {}, []);

  const value = useMemo<Ctx | null>(() => db && ({
    db, ready: true, update, reset, replace, mode: "local", role: null, profile: null, clinic: null, sync: "saved", signOut: noop, reload: noop, isAdmin: false,
  }), [db, update, reset, replace, noop]);

  if (!value) return <Loading />;
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

/* ====================== Modo nube (Supabase) ====================== */
type Phase = "loading" | "auth" | "recovery" | "onboarding" | "admin" | "license" | "setup" | "empty" | "ready" | "error";

function CloudStore({ children }: { children: React.ReactNode }) {
  const { toast } = useUI();
  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [db, setDb] = useState<DB | null>(null);
  const [sync, setSync] = useState<SyncState>("saved");
  const [error, setError] = useState("");
  const [admin, setAdmin] = useState(false);
  const dbRef = useRef<DB | null>(null);
  const queue = useRef<SyncQueue | null>(null);

  // Sesión
  useEffect(() => {
    const sb = supabase!;
    sb.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) setPhase("auth"); });
    const { data: sub } = sb.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setPhase("recovery");
      else if (!s) { setPhase("auth"); setProfile(null); setClinic(null); setDb(null); dbRef.current = null; }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Perfil → clínica → datos
  const load = useCallback(async () => {
    if (!session) return;
    setPhase("loading");
    try {
      const { profile, clinic } = await loadProfile(session.user.id);
      const adm = await checkAdmin();
      setProfile(profile); setClinic(clinic); setAdmin(adm);
      // El administrador sin clínica propia entra directo a su panel
      if (!profile || !clinic) return setPhase(adm ? "admin" : "onboarding");
      if (!license(clinic).canUse) return setPhase("license");
      const remote = await loadDB(clinic.id);
      if (!remote) return setPhase(profile.rol === "doctor" ? "setup" : "empty");
      // Cambios hechos sin conexión que aún no llegan a la nube: se vuelven a aplicar encima
      const ready = overlayPending(migrate(remote), readPending(clinic.id, session.user.id));
      dbRef.current = ready; setDb(ready); setPhase("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setPhase("error");
    }
  }, [session]);
  const userId = session?.user.id;
  useEffect(() => { if (userId && phase !== "recovery") load(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Revisa la licencia en la nube; si se suspendió o venció, muestra la pantalla de licencia.
   * `flushFirst`: intentar enviar lo pendiente antes de bloquear (no se usa cuando la propia cola
   * es la que pide la revisión, porque se quedaría esperándose a sí misma).
   */
  const checkLicense = useCallback(async (flushFirst = true) => {
    if (!userId) return;
    try {
      const { clinic: fresh } = await loadProfile(userId);
      if (!fresh) return;
      if (!license(fresh).canUse) {
        if (flushFirst) await queue.current?.flush();
        setClinic(fresh); setPhase("license");
        return;
      }
      // Solo se actualiza si cambió algo (evita reiniciar la sincronización en cada revisión)
      setClinic((c) => c && c.estado === fresh.estado && c.vence_el === fresh.vence_el && c.nombre === fresh.nombre && c.codigo === fresh.codigo ? c : fresh);
    } catch { /* sin conexión: se revisa en la siguiente vuelta */ }
  }, [userId]);
  const checkRef = useRef(checkLicense);
  checkRef.current = checkLicense;

  // Revisa la licencia cada 10 minutos y al volver a la pestaña: si se suspende o vence, se bloquea sin recargar
  useEffect(() => {
    if (phase !== "ready" || !userId) return;
    const check = () => checkLicense();
    const timer = setInterval(check, 10 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [phase, userId, checkLicense]);

  // Cola de sincronización + tiempo real
  useEffect(() => {
    if (phase !== "ready" || !clinic || !userId) return;
    const q = new SyncQueue(clinic.id, userId, (s, err, permanent) => {
      setSync(s);
      // Los errores de conexión se reintentan solos; solo se avisa lo que requiere atención
      if (permanent) {
        toast("No se pudo guardar un cambio en la nube. Quedó guardado en este equipo y se enviará al volver a entrar.", "error");
        console.warn("Cambio rechazado por la nube:", err);
        // La causa más común es la licencia vencida o suspendida: se revisa ya, sin esperar 10 minutos
        checkRef.current(false);
      }
    });
    queue.current = q;
    const unsub = subscribe(clinic.id, userId, (ev) => {
      if (!dbRef.current) return;
      const mine = ev.type === "upsert" ? q.pendingFor(ev.row.coleccion, ev.row.id) : q.pendingFor(ev.coleccion, ev.id);
      dbRef.current = overlayPending(applyRemote(dbRef.current, ev), mine ? [mine] : []);
      setDb(dbRef.current);
    });
    // Lo pendiente ya está guardado en el navegador: al salir solo se intenta enviar
    const warn = () => { if (q.pending) q.flush(); };
    window.addEventListener("beforeunload", warn);
    return () => { unsub(); window.removeEventListener("beforeunload", warn); q.flush().finally(() => q.dispose()); queue.current = null; };
  }, [phase, clinic, userId, toast]);

  const update = useCallback((fn: (db: DB) => DB) => {
    const prev = dbRef.current;
    if (!prev || !clinic) return;
    const next = fn(prev);
    if (next === prev) return;
    const ch = diff(prev, next, clinic.id);
    if (profile?.rol === "recepcion") {
      const forbidden = ch.upserts.some((u) => u.coleccion === "settings" || u.coleccion === "procedures")
        || ch.deletes.some((d) => d.coleccion !== "appointments");
      if (forbidden) { toast("Esta acción solo la puede hacer el doctor", "error"); return; }
    }
    dbRef.current = next;
    setDb(next);
    queue.current?.push(ch);
  }, [clinic, profile, toast]);
  const reset = useCallback(() => update(() => createSeed()), [update]);
  const replace = useCallback((next: DB) => update(() => migrate(next)), [update]);
  const signOut = useCallback(async () => { await queue.current?.flush(); await supabase!.auth.signOut(); }, []);

  /** Primera carga de una clínica vacía (lo elige el doctor en la pantalla de configuración inicial). */
  const initialize = useCallback(async (initial: DB) => {
    if (!clinic || !userId) return;
    setPhase("loading");
    const q = new SyncQueue(clinic.id, userId, (s, err) => { if (s === "error") setError(err ?? ""); });
    q.push(fullUpload(initial, clinic.id));
    await q.flush();
    await load();
  }, [clinic, userId, load]);

  const value = useMemo<Ctx | null>(() => db && phase === "ready" ? {
    db, ready: true, update, reset, replace, mode: "cloud", role: profile?.rol ?? null, profile, clinic, sync, signOut, reload: load, isAdmin: admin,
  } : null, [db, phase, update, reset, replace, profile, clinic, sync, signOut, load, admin]);

  if (phase === "auth") return <AuthScreen />;
  if (phase === "recovery") return <RecoveryScreen onDone={() => load()} />;
  if (phase === "admin") return <AdminPanel standalone onSignOut={signOut} onBack={clinic ? load : undefined} />;
  if (phase === "license" && clinic) return <LicenseScreen clinic={clinic} role={profile?.rol ?? "doctor"} onRetry={load} onSignOut={signOut} onOpenAdmin={admin ? () => setPhase("admin") : undefined} />;
  if (phase === "onboarding") return <OnboardingScreen email={session?.user.email ?? ""} onDone={load} onSignOut={signOut} />;
  if (phase === "setup" && clinic && profile) return <SetupScreen clinic={clinic} profile={profile} local={readLocal()} onChoose={initialize} />;
  if (phase === "empty") return <CenterMessage title="La clínica aún no tiene datos" text="El doctor debe completar la configuración inicial. Cuando lo haga, presiona Reintentar." action={load} actionLabel="Reintentar" onSignOut={signOut} />;
  if (phase === "error") return <CenterMessage title="No se pudo conectar con la nube" text={error} action={load} actionLabel="Reintentar" onSignOut={signOut} />;
  if (!value) return <Loading text="Conectando con la nube…" />;
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore debe usarse dentro de <StoreProvider>");
  return ctx;
}

/* ---------- Helpers de colección ---------- */
type Coll = "patients" | "procedures" | "appointments" | "budgets" | "payments" | "materials" | "expenses" | "prescriptions" | "consents";
type Item<K extends Coll> = DB[K][number];

export function useCollection<K extends Coll>(key: K) {
  const { db, update } = useStore();
  const list = db[key] as Item<K>[];
  return {
    list,
    get: (id?: string) => list.find((x) => x.id === id),
    add: (item: Item<K>) => update((d) => ({ ...d, [key]: [item, ...(d[key] as Item<K>[])] })),
    save: (item: Item<K>) =>
      update((d) => {
        const arr = d[key] as Item<K>[];
        const exists = arr.some((x) => x.id === item.id);
        return { ...d, [key]: exists ? arr.map((x) => (x.id === item.id ? item : x)) : [item, ...arr] };
      }),
    patch: (id: string, changes: Partial<Item<K>>) =>
      update((d) => ({ ...d, [key]: (d[key] as Item<K>[]).map((x) => (x.id === id ? { ...x, ...changes } : x)) })),
    remove: (id: string) => update((d) => ({ ...d, [key]: (d[key] as Item<K>[]).filter((x) => x.id !== id) })),
  };
}

/* ---------- Cálculos derivados compartidos ---------- */
export const budgetTotals = (b: { items: { price: number; cost: number; qty: number }[]; discount: number }) => {
  const sub = b.items.reduce((a, r) => a + r.price * r.qty, 0);
  const total = Math.round(sub * (1 - b.discount / 100));
  const cost = b.items.reduce((a, r) => a + r.cost * r.qty, 0);
  return { sub, total, cost, profit: total - cost, pct: total ? Math.round(((total - cost) / total) * 100) : 0 };
};

export const nextFolio = (db: DB) => Math.max(1000, ...db.budgets.map((b) => b.folio)) + 1;

export const paidForBudget = (db: DB, budgetId: string) =>
  db.payments.filter((p) => p.budgetId === budgetId).reduce((a, p) => a + p.amount, 0);

export const patientBalance = (db: DB, patientId: string) => {
  const accepted = db.budgets.filter((b) => b.patientId === patientId && b.status === "aceptado");
  const owed = accepted.reduce((a, b) => a + budgetTotals(b).total - paidForBudget(db, b.id), 0);
  return Math.max(0, owed);
};

/** Descuenta del inventario lo que consume un tratamiento (multiplicado por `times`). */
export const consumeMaterials = (d: DB, procedureId: string | undefined, times = 1): DB => {
  const proc = d.procedures.find((p) => p.id === procedureId);
  if (!proc?.materials?.length) return d;
  return {
    ...d,
    materials: d.materials.map((m) => {
      const use = proc.materials!.find((x) => x.materialId === m.id);
      return use ? { ...m, stock: Math.max(0, Math.round((m.stock - use.qty * times) * 100) / 100) } : m;
    }),
  };
};

/** Profesionales de la clínica. Si no se han configurado, el doctor de la configuración. */
export const professionalsOf = (s: DB["settings"]) =>
  s.professionals?.length ? s.professionals : [{ id: "principal", name: s.doctorName, color: "#12A36A" }];
export const activeProfessionals = (s: DB["settings"]) => professionalsOf(s).filter((p) => p.active !== false);

export const nextReceiptFolio = (db: DB) => Math.max(0, ...db.payments.map((p) => p.folio ?? 0)) + 1;
export const nextConsentFolio = (db: DB) => Math.max(0, ...db.consents.map((c) => c.folio)) + 1;
export const nextRxFolio = (db: DB) => Math.max(0, ...db.prescriptions.map((r) => r.folio)) + 1;
