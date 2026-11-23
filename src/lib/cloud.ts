// Sincronización con Supabase. Cada elemento de la app es una fila de `registros` (ver supabase/schema.sql).
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { DB, Settings } from "./types";
import { DB_VERSION } from "./mock-data";

export const COLLECTIONS = ["patients", "procedures", "appointments", "budgets", "payments", "materials", "expenses", "prescriptions", "consents"] as const;
export type Collection = (typeof COLLECTIONS)[number];
type Coleccion = Collection | "settings";

export interface Row {
  clinica_id: string; coleccion: Coleccion; id: string;
  data: unknown;                        // versión completa del registro
  patch?: Record<string, unknown>;      // solo los campos que cambiaron (si el registro ya existía)
  updated_at?: string; updated_by?: string | null;
}
export interface Change { upserts: Row[]; deletes: { coleccion: Coleccion; id: string }[]; }

export interface Profile { user_id: string; clinica_id: string; nombre: string; email: string | null; rol: "doctor" | "recepcion"; }
export type LicenseState = "pendiente" | "activa" | "suspendida";
export type LicensePlan = "prueba" | "contado" | "mensualidades" | "renta" | "cortesia";
export interface Clinic {
  id: string; nombre: string; codigo: string;
  // Licencia (opcionales para funcionar aunque aún no se ejecute la actualización del esquema)
  estado?: LicenseState; plan?: LicensePlan; vence_el?: string | null;
}
export interface AdminClinic extends Required<Pick<Clinic, "id" | "nombre" | "codigo">> {
  estado: LicenseState; plan: LicensePlan; vence_el: string | null; notas: string | null; created_at: string;
  doctor: string | null; email: string | null; usuarios: number; pacientes: number; ultima_actividad: string | null;
}

/** Días de gracia después del vencimiento (igual que clinica_activa() en schema.sql). */
export const GRACE_DAYS = 5;
export const planLabel: Record<LicensePlan, string> = { prueba: "Prueba", contado: "Contado", mensualidades: "Mensualidades", renta: "Renta mensual", cortesia: "Cortesía" };

/** Estado efectivo de la licencia de una clínica. */
export function license(c: Pick<Clinic, "estado" | "vence_el">, today = new Date()) {
  const estado = c.estado ?? "activa";
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const daysLeft = c.vence_el ? Math.round((new Date(`${c.vence_el}T00:00`).getTime() - t) / 864e5) : null;
  const expired = daysLeft !== null && daysLeft < -GRACE_DAYS;
  const state: "activa" | "por_vencer" | "gracia" | "vencida" | "pendiente" | "suspendida" =
    estado !== "activa" ? estado : expired ? "vencida" : daysLeft !== null && daysLeft < 0 ? "gracia" : daysLeft !== null && daysLeft <= 7 ? "por_vencer" : "activa";
  return { state, daysLeft, canUse: estado === "activa" && !expired };
}

export const cloudEnabled = !!supabase;
const sb = () => { if (!supabase) throw new Error("Supabase no está configurado"); return supabase; };

/* ---------- Perfil y clínica ---------- */
export async function loadProfile(userId: string): Promise<{ profile: Profile | null; clinic: Clinic | null }> {
  const { data: profile, error } = await sb().from("perfiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!profile) return { profile: null, clinic: null };
  const { data: clinic, error: e2 } = await sb().from("clinicas").select("*").eq("id", profile.clinica_id).single();
  if (e2) throw e2;
  return { profile: profile as Profile, clinic: clinic as Clinic };
}
export async function createClinic(nombreClinica: string, nombreUsuario: string) {
  const { error } = await sb().rpc("crear_clinica", { nombre_clinica: nombreClinica, nombre_usuario: nombreUsuario });
  if (error) throw error;
}
export async function joinClinic(codigo: string, nombreUsuario: string) {
  const { error } = await sb().rpc("unirse_clinica", { codigo_clinica: codigo, nombre_usuario: nombreUsuario });
  if (error) throw error;
}
export async function isAdmin(): Promise<boolean> {
  const { data, error } = await sb().rpc("es_admin");
  return !error && data === true; // si la función aún no existe, no es administrador
}
export async function adminClinics(): Promise<AdminClinic[]> {
  const { data, error } = await sb().rpc("admin_clinicas");
  if (error) throw error;
  return data as AdminClinic[];
}
export async function adminUpdateClinic(c: Pick<AdminClinic, "id" | "estado" | "plan" | "vence_el" | "notas">) {
  const { error } = await sb().rpc("admin_actualizar_clinica", { p_id: c.id, p_estado: c.estado, p_plan: c.plan, p_vence_el: c.vence_el || null, p_notas: c.notas || null });
  if (error) throw error;
}

export interface AuditEntry {
  id: number; coleccion: Coleccion; registro_id: string; accion: "crear" | "editar" | "eliminar";
  usuario_nombre: string | null; fecha: string; campos: string[] | null; antes: Record<string, unknown> | null;
}
/** Bitácora de cambios de la clínica (solo el doctor tiene permiso de leerla). */
export async function loadAudit(clinicaId: string, opts: { registroId?: string; limit?: number } = {}): Promise<AuditEntry[]> {
  let q = sb().from("bitacora").select("id,coleccion,registro_id,accion,usuario_nombre,fecha,campos,antes")
    .eq("clinica_id", clinicaId).order("fecha", { ascending: false }).limit(opts.limit ?? 200);
  if (opts.registroId) q = q.eq("registro_id", opts.registroId);
  const { data, error } = await q;
  if (error) throw error;
  return data as AuditEntry[];
}

export async function renewCode(): Promise<string> {
  const { data, error } = await sb().rpc("renovar_codigo");
  if (error) throw error;
  return data as string;
}
export async function listTeam(clinicaId: string): Promise<Profile[]> {
  const { data, error } = await sb().from("perfiles").select("*").eq("clinica_id", clinicaId).order("created_at");
  if (error) throw error;
  return data as Profile[];
}
export async function setRole(userId: string, rol: Profile["rol"]) {
  const { error } = await sb().from("perfiles").update({ rol }).eq("user_id", userId);
  if (error) throw error;
}
export async function removeMember(userId: string) {
  const { error } = await sb().from("perfiles").delete().eq("user_id", userId);
  if (error) throw error;
}

/* ---------- Datos ---------- */
/** Descarga todos los registros de la clínica (paginado). Devuelve null si la clínica aún no tiene datos. */
export async function loadDB(clinicaId: string): Promise<DB | null> {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb().from("registros").select("coleccion,id,data").eq("clinica_id", clinicaId).range(from, from + 999);
    if (error) throw error;
    rows.push(...(data as Row[]));
    if (!data || data.length < 1000) break;
  }
  if (!rows.length) return null;
  const db = { version: DB_VERSION } as DB;
  for (const c of COLLECTIONS) (db[c] as unknown[]) = [];
  for (const r of rows) {
    if (r.coleccion === "settings") db.settings = r.data as Settings;
    else (db[r.coleccion] as unknown[]).push(r.data);
  }
  return db;
}

/**
 * Diferencias entre dos estados. Los cambios en la app son inmutables, así que basta comparar referencias.
 * Para registros que ya existían se calcula además `patch`: solo los campos de primer nivel que cambiaron
 * (un campo eliminado va como null). Así, dos personas editando campos distintos del mismo paciente no se pisan.
 */
export function diff(prev: DB, next: DB, clinicaId: string): Change {
  const change: Change = { upserts: [], deletes: [] };
  if (prev.settings !== next.settings) {
    change.upserts.push({ clinica_id: clinicaId, coleccion: "settings", id: "main", data: next.settings, patch: patchOf(prev.settings, next.settings) });
  }
  for (const c of COLLECTIONS) {
    const a = prev[c] as { id: string }[], b = next[c] as { id: string }[];
    if (a === b) continue;
    const before = new Map(a.map((x) => [x.id, x]));
    const after = new Set<string>();
    for (const item of b) {
      after.add(item.id);
      const old = before.get(item.id);
      if (old !== item) change.upserts.push({ clinica_id: clinicaId, coleccion: c, id: item.id, data: item, patch: old ? patchOf(old, item) : undefined });
    }
    for (const id of before.keys()) if (!after.has(id)) change.deletes.push({ coleccion: c, id });
  }
  return change;
}

function patchOf(a: object, b: object): Record<string, unknown> {
  const A = a as Record<string, unknown>, B = b as Record<string, unknown>;
  const p: Record<string, unknown> = {};
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) if (A[k] !== B[k]) p[k] = B[k] ?? null;
  return p;
}

/** Aplica un patch (null = quitar el campo) sobre un objeto. */
function applyPatch<T>(base: T, patch: Record<string, unknown>): T {
  const out = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch)) { if (v === null || v === undefined) delete out[k]; else out[k] = v; }
  return out as T;
}

/** Todos los registros de un estado, para subirlo completo a una clínica vacía. */
export const fullUpload = (db: DB, clinicaId: string): Change => ({
  deletes: [],
  upserts: [
    { clinica_id: clinicaId, coleccion: "settings", id: "main", data: db.settings },
    ...COLLECTIONS.flatMap((c) => (db[c] as { id: string }[]).map((item): Row => ({ clinica_id: clinicaId, coleccion: c, id: item.id, data: item }))),
  ],
});

export type SyncState = "saving" | "saved" | "offline" | "error";
type Pending = { kind: "upsert"; row: Row } | { kind: "delete"; coleccion: Coleccion; id: string };

/** Cambios pendientes guardados en este navegador (sin crear la cola). */
export function readPending(clinicaId: string, userId: string): Pending[] {
  try { return (JSON.parse(localStorage.getItem(`odonty:pendientes:${clinicaId}:${userId}`) ?? "[]") as [string, Pending][]).map(([, v]) => v); }
  catch { return []; }
}
const keyOf = (c: Coleccion, id: string) => `${c}:${id}`;
const RETRY = [2000, 5000, 15000, 30000, 60000];

/** Une un cambio nuevo con uno pendiente del mismo registro. */
function mergePending(old: Pending | undefined, next: Pending): Pending {
  if (!old || old.kind === "delete" || next.kind === "delete") return next;
  const patch = old.row.patch && next.row.patch ? { ...old.row.patch, ...next.row.patch } : undefined;
  return { kind: "upsert", row: { ...next.row, patch } };
}

/** Errores que no se arreglan reintentando (permisos, licencia vencida, datos inválidos). */
const isPermanent = (e: { code?: string; message?: string; status?: number }) =>
  e.code === "42501" || e.code === "23514" || e.code === "22P02" || /row-level security|permission denied|violates/i.test(e.message ?? "");

/**
 * Cola de envío a la nube:
 * - agrupa cambios rápidos y, si un registro cambia varias veces, une los cambios;
 * - guarda lo pendiente en el navegador, así no se pierde si se cae internet o se cierra la pestaña;
 * - reintenta sola con espera creciente y al recuperar la conexión.
 */
export class SyncQueue {
  private ops = new Map<string, Pending>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing: Promise<void> | null = null;
  private attempt = 0;
  private storageKey: string;
  private useRpc = true;

  constructor(private clinicaId: string, private userId: string, private onState: (s: SyncState, err?: string, permanent?: boolean) => void) {
    this.storageKey = `odonty:pendientes:${clinicaId}:${userId}`;
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey) ?? "[]") as [string, Pending][];
      saved.forEach(([k, v]) => this.ops.set(k, v));
    } catch { /* sin almacenamiento */ }
    if (typeof window !== "undefined") window.addEventListener("online", this.onOnline);
    if (this.ops.size) { this.onState("saving"); this.schedule(800); }
  }

  private onOnline = () => { this.attempt = 0; this.schedule(300); };
  dispose() { if (typeof window !== "undefined") window.removeEventListener("online", this.onOnline); if (this.timer) clearTimeout(this.timer); }

  private persist() {
    try {
      if (this.ops.size) localStorage.setItem(this.storageKey, JSON.stringify([...this.ops.entries()]));
      else localStorage.removeItem(this.storageKey);
    } catch { /* almacenamiento lleno o bloqueado */ }
  }
  private schedule(ms: number) { if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), ms); }

  get pending() { return this.ops.size; }
  /** Cambios pendientes, para volver a aplicarlos sobre datos recién descargados o recibidos de otro usuario. */
  get pendingOps(): Pending[] { return [...this.ops.values()]; }
  pendingFor(c: Coleccion, id: string) { return this.ops.get(keyOf(c, id)); }

  push(ch: Change) {
    for (const r of ch.upserts) { const k = keyOf(r.coleccion, r.id); this.ops.set(k, mergePending(this.ops.get(k), { kind: "upsert", row: r })); }
    for (const d of ch.deletes) this.ops.set(keyOf(d.coleccion, d.id), { kind: "delete", coleccion: d.coleccion, id: d.id });
    if (!this.ops.size) return;
    this.persist();
    this.onState(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "saving");
    this.schedule(500);
  }

  async flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.flushing) await this.flushing;
    if (!this.ops.size) return;
    const batch = new Map(this.ops);
    this.ops.clear();
    this.flushing = (async () => {
      try {
        await this.send([...batch.values()]);
        this.attempt = 0;
        this.persist();
        this.onState(this.ops.size ? "saving" : "saved");
      } catch (err) {
        const e = err as { code?: string; message?: string };
        if (isPermanent(e)) {
          // No se reintenta: se avisa para recargar desde la nube
          this.persist();
          this.onState("error", e.message, true);
        } else {
          // Regresa a la cola lo que no se envió, sin pisar cambios más nuevos
          for (const [k, v] of batch) {
            const newer = this.ops.get(k);
            this.ops.set(k, newer ? mergePending(v, newer) : v);
          }
          this.persist();
          const offline = typeof navigator !== "undefined" && navigator.onLine === false;
          this.onState(offline ? "offline" : "error", e.message);
          this.schedule(RETRY[Math.min(this.attempt++, RETRY.length - 1)]);
        }
      } finally {
        this.flushing = null;
      }
    })();
    return this.flushing;
  }

  private async send(ops: Pending[]) {
    const ups = ops.filter((o): o is Extract<Pending, { kind: "upsert" }> => o.kind === "upsert").map((o) => o.row);
    for (let i = 0; i < ups.length; i += 300) {
      const chunk = ups.slice(i, i + 300);
      if (this.useRpc) {
        const filas = chunk.map((r) => ({ clinica_id: r.clinica_id, coleccion: r.coleccion, id: r.id, parcial: !!r.patch, data: r.patch ?? r.data, completo: r.data }));
        const { error } = await sb().rpc("guardar_registros", { filas });
        if (!error) continue;
        // La función aún no existe (esquema sin actualizar): se guarda el registro completo como antes
        if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) this.useRpc = false;
        else throw error;
      }
      const now = new Date().toISOString();
      const { error } = await sb().from("registros").upsert(chunk.map((r) => ({ clinica_id: r.clinica_id, coleccion: r.coleccion, id: r.id, data: r.data, updated_at: now, updated_by: this.userId })));
      if (error) throw error;
    }
    const byColl = new Map<Coleccion, string[]>();
    ops.forEach((o) => { if (o.kind === "delete") byColl.set(o.coleccion, [...(byColl.get(o.coleccion) ?? []), o.id]); });
    for (const [coleccion, ids] of byColl) {
      for (let i = 0; i < ids.length; i += 200) {
        const { error } = await sb().from("registros").delete().eq("clinica_id", this.clinicaId).eq("coleccion", coleccion).in("id", ids.slice(i, i + 200));
        if (error) throw error;
      }
    }
  }
}

type RemoteEvent = { type: "upsert"; row: Row } | { type: "delete"; coleccion: Coleccion; id: string };

/** Escucha los cambios que hacen otros usuarios de la clínica. */
export function subscribe(clinicaId: string, userId: string, onChange: (ev: RemoteEvent) => void): () => void {
  const filter = `clinica_id=eq.${clinicaId}`;
  const onWrite = (p: { new: unknown }) => {
    const row = p.new as Row;
    if (row.updated_by === userId) return; // eco de un cambio propio
    onChange({ type: "upsert", row });
  };
  const channel: RealtimeChannel = sb()
    .channel(`registros:${clinicaId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "registros", filter }, onWrite)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "registros", filter }, onWrite)
    // Los DELETE no admiten filtro: la llave primaria trae clinica_id y se verifica aquí
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "registros" }, (p) => {
      const old = p.old as Partial<Row>;
      if (old.clinica_id === clinicaId && old.coleccion && old.id) onChange({ type: "delete", coleccion: old.coleccion, id: old.id });
    })
    .subscribe();
  return () => { sb().removeChannel(channel); };
}

/** Aplica un cambio remoto al estado local. */
export function applyRemote(db: DB, ev: RemoteEvent): DB {
  if (ev.type === "upsert") {
    const { coleccion, data } = ev.row;
    if (coleccion === "settings") return { ...db, settings: data as Settings };
    const arr = db[coleccion] as { id: string }[];
    const item = data as { id: string };
    const exists = arr.some((x) => x.id === item.id);
    return { ...db, [coleccion]: exists ? arr.map((x) => (x.id === item.id ? item : x)) : [item, ...arr] };
  }
  if (ev.coleccion === "settings") return db;
  return { ...db, [ev.coleccion]: (db[ev.coleccion] as { id: string }[]).filter((x) => x.id !== ev.id) };
}

/** Vuelve a aplicar cambios locales aún no enviados sobre un estado (tras descargar o recibir datos de otro usuario). */
export function overlayPending(db: DB, ops: Pending[]): DB {
  let out = db;
  for (const op of ops) {
    if (op.kind === "delete") { out = applyRemote(out, { type: "delete", coleccion: op.coleccion, id: op.id }); continue; }
    const { coleccion, id, patch, data } = op.row;
    if (coleccion === "settings") { out = { ...out, settings: patch ? applyPatch(out.settings, patch) : (data as Settings) }; continue; }
    const current = (out[coleccion] as { id: string }[]).find((x) => x.id === id);
    const merged = patch && current ? applyPatch(current, patch) : data;
    out = applyRemote(out, { type: "upsert", row: { ...op.row, data: merged } });
  }
  return out;
}
