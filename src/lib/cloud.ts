// Sincronización con Supabase. Cada elemento de la app es una fila de `registros` (ver supabase/schema.sql).
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { DB, Settings } from "./types";
import { DB_VERSION } from "./mock-data";

export const COLLECTIONS = ["patients", "procedures", "appointments", "budgets", "payments", "materials", "expenses", "prescriptions", "consents"] as const;
export type Collection = (typeof COLLECTIONS)[number];
type Coleccion = Collection | "settings";

export interface Row { clinica_id: string; coleccion: Coleccion; id: string; data: unknown; updated_at?: string; updated_by?: string | null; }
export interface Change { upserts: Row[]; deletes: { coleccion: Coleccion; id: string }[]; }

export interface Profile { user_id: string; clinica_id: string; nombre: string; email: string | null; rol: "doctor" | "recepcion"; }
export interface Clinic { id: string; nombre: string; codigo: string; }

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

/** Diferencias entre dos estados. Los cambios en la app son inmutables, así que basta comparar referencias. */
export function diff(prev: DB, next: DB, clinicaId: string): Change {
  const change: Change = { upserts: [], deletes: [] };
  if (prev.settings !== next.settings) change.upserts.push({ clinica_id: clinicaId, coleccion: "settings", id: "main", data: next.settings });
  for (const c of COLLECTIONS) {
    const a = prev[c] as { id: string }[], b = next[c] as { id: string }[];
    if (a === b) continue;
    const before = new Map(a.map((x) => [x.id, x]));
    const after = new Set<string>();
    for (const item of b) {
      after.add(item.id);
      if (before.get(item.id) !== item) change.upserts.push({ clinica_id: clinicaId, coleccion: c, id: item.id, data: item });
    }
    for (const id of before.keys()) if (!after.has(id)) change.deletes.push({ coleccion: c, id });
  }
  return change;
}

/** Todos los registros de un estado, para subirlo completo a una clínica vacía. */
export const fullUpload = (db: DB, clinicaId: string): Change => ({
  deletes: [],
  upserts: [
    { clinica_id: clinicaId, coleccion: "settings", id: "main", data: db.settings },
    ...COLLECTIONS.flatMap((c) => (db[c] as { id: string }[]).map((item): Row => ({ clinica_id: clinicaId, coleccion: c, id: item.id, data: item }))),
  ],
});

/**
 * Cola de envío: agrupa cambios rápidos (p. ej. escribir en un campo) y los manda juntos.
 * Si el mismo registro cambia varias veces, solo se envía la última versión.
 */
export class SyncQueue {
  private upserts = new Map<string, Row>();
  private deletes = new Map<string, { coleccion: Coleccion; id: string }>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing: Promise<void> | null = null;
  constructor(private clinicaId: string, private userId: string, private onState: (s: "saving" | "saved" | "error", err?: string) => void) {}

  push(ch: Change) {
    for (const r of ch.upserts) { const k = `${r.coleccion}:${r.id}`; this.deletes.delete(k); this.upserts.set(k, r); }
    for (const d of ch.deletes) { const k = `${d.coleccion}:${d.id}`; this.upserts.delete(k); this.deletes.set(k, d); }
    if (!this.upserts.size && !this.deletes.size) return;
    this.onState("saving");
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 500);
  }

  get pending() { return this.upserts.size + this.deletes.size; }

  async flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.flushing) await this.flushing;
    const ups = [...this.upserts.values()], dels = [...this.deletes.values()];
    this.upserts.clear(); this.deletes.clear();
    if (!ups.length && !dels.length) return;
    this.flushing = (async () => {
      try {
        const now = new Date().toISOString();
        for (let i = 0; i < ups.length; i += 500) {
          const chunk = ups.slice(i, i + 500).map((r) => ({ ...r, updated_at: now, updated_by: this.userId }));
          const { error } = await sb().from("registros").upsert(chunk);
          if (error) throw error;
        }
        const byColl = new Map<Coleccion, string[]>();
        dels.forEach((d) => byColl.set(d.coleccion, [...(byColl.get(d.coleccion) ?? []), d.id]));
        for (const [coleccion, ids] of byColl) {
          for (let i = 0; i < ids.length; i += 200) {
            const { error } = await sb().from("registros").delete().eq("clinica_id", this.clinicaId).eq("coleccion", coleccion).in("id", ids.slice(i, i + 200));
            if (error) throw error;
          }
        }
        if (!this.pending) this.onState("saved");
      } catch (e) {
        this.onState("error", e instanceof Error ? e.message : String(e));
      } finally {
        this.flushing = null;
      }
    })();
    return this.flushing;
  }
}

/** Escucha los cambios que hacen otros usuarios de la clínica. */
export function subscribe(clinicaId: string, userId: string, onChange: (ev: { type: "upsert"; row: Row } | { type: "delete"; coleccion: Coleccion; id: string }) => void): () => void {
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
export function applyRemote(db: DB, ev: { type: "upsert"; row: Row } | { type: "delete"; coleccion: Coleccion; id: string }): DB {
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
