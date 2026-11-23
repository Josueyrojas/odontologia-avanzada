"use client";
// Importación masiva de pacientes desde Excel (.xlsx/.xls) o CSV.
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet } from "lucide-react";
import { Modal, useUI } from "./ui";
import { useStore } from "@/lib/store";
import { downloadCSV, today, uid } from "@/lib/format";
import type { Patient } from "@/lib/types";

type Field = "name" | "firstName" | "lastName" | "lastName2" | "phone" | "email" | "birthDate" | "gender" | "allergies" | "conditions" | "notes";
const fieldLabel: Record<Field, string> = {
  name: "Nombre completo", firstName: "Nombre(s)", lastName: "Apellido(s) / paterno", lastName2: "Apellido materno",
  phone: "Teléfono", email: "Correo", birthDate: "Fecha de nacimiento", gender: "Sexo",
  allergies: "Alergias", conditions: "Padecimientos", notes: "Notas",
};
const fields = Object.keys(fieldLabel) as Field[];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
// Encabezados que reconocemos para cada campo (sin acentos ni mayúsculas)
const synonyms: Record<Field, string[]> = {
  name: ["nombre completo", "paciente", "nombre del paciente", "nombre y apellidos", "name", "full name"],
  firstName: ["nombre", "nombres", "nombre s", "first name"],
  lastName: ["apellido", "apellidos", "apellido paterno", "primer apellido", "last name"],
  lastName2: ["apellido materno", "segundo apellido"],
  phone: ["telefono", "tel", "celular", "cel", "movil", "whatsapp", "telefono celular", "phone", "numero"],
  email: ["correo", "email", "e mail", "mail", "correo electronico"],
  birthDate: ["fecha de nacimiento", "nacimiento", "fecha nacimiento", "f nacimiento", "fecha nac", "fnac", "cumpleanos", "birthdate", "birth date"],
  gender: ["sexo", "genero"],
  allergies: ["alergias", "alergia"],
  conditions: ["padecimientos", "enfermedades", "antecedentes", "antecedentes medicos"],
  notes: ["notas", "observaciones", "comentarios", "nota"],
};

function autoMap(headers: string[]): Partial<Record<Field, number>> {
  const map: Partial<Record<Field, number>> = {};
  const used = new Set<number>();
  // Primero coincidencias exactas, luego parciales
  for (const exact of [true, false]) {
    for (const f of fields) {
      if (map[f] !== undefined) continue;
      const i = headers.findIndex((h, idx) => !used.has(idx) && synonyms[f].some((s) => (exact ? norm(h) === s : norm(h).startsWith(s))));
      if (i >= 0) { map[f] = i; used.add(i); }
    }
  }
  // Si hay "Nombre completo" no usamos nombre/apellidos separados
  if (map.name !== undefined) { delete map.firstName; delete map.lastName; delete map.lastName2; }
  return map;
}

/** Fechas: ISO (aaaa-mm-dd), dd/mm/aaaa o dd-mm-aa (formato mexicano, día primero). */
function parseDate(raw: string): string | null | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  let y: number, m: number, d: number;
  let r = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (r) { y = +r[1]; m = +r[2]; d = +r[3]; }
  else if ((r = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) {
    d = +r[1]; m = +r[2]; y = +r[3];
    if (y < 100) y += y > (new Date().getFullYear() % 100) ? 1900 : 2000;
  } else return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getMonth() !== m - 1 || y < 1900 || dt > new Date()) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
const fmtPhone = (raw: string) => {
  const digits = raw.replace(/\D/g, "").replace(/^52(?=\d{10}$)/, "");
  return digits.length === 10 ? `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}` : raw.trim();
};
const parseGender = (raw: string): Patient["gender"] => {
  const g = norm(raw);
  if (!g) return undefined;
  if (g.startsWith("f") || g === "mujer") return "F";
  if (g.startsWith("m") || g === "h" || g === "hombre") return "M";
  return "O";
};
const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)(\S)/g, (_, a, b) => a + b.toUpperCase());

type Row = { p: Patient; status: "ok" | "duplicado" | "sin_nombre"; warn?: string; line: number };

/** Lee el archivo como tabla. CSV: UTF-8 y, si no, Windows-1252 (Excel en español). */
async function readTable(file: File): Promise<{ sheets: string[]; rows: (name: string) => string[][] }> {
  const XLSX = await import("xlsx");
  let wb;
  if (/\.(csv|txt)$/i.test(file.name)) {
    const buf = await file.arrayBuffer();
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { text = new TextDecoder("windows-1252").decode(buf); }
    wb = XLSX.read(text.replace(/^﻿/, ""), { type: "string", raw: true });
  } else {
    wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  }
  return {
    sheets: wb.SheetNames,
    rows: (name) => (XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, dateNF: "yyyy-mm-dd", defval: "", blankrows: false }) as unknown[][])
      .map((r) => r.map((c) => String(c ?? "").trim())),
  };
}

export function ImportPatientsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, update } = useStore();
  const { toast } = useUI();
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [book, setBook] = useState<Awaited<ReturnType<typeof readTable>> | null>(null);
  const [sheet, setSheet] = useState("");
  const [headerRow, setHeaderRow] = useState(0);
  const [map, setMap] = useState<Partial<Record<Field, number>>>({});
  const [includeDup, setIncludeDup] = useState(false);
  const [busy, setBusy] = useState(false);

  const table = useMemo(() => (book && sheet ? book.rows(sheet) : []), [book, sheet]);
  const headers = table[headerRow] ?? [];

  const reset = () => { setBook(null); setFileName(""); setSheet(""); setMap({}); setHeaderRow(0); setIncludeDup(false); };
  const close = () => { reset(); onClose(); };

  const load = async (file: File) => {
    setBusy(true);
    try {
      const b = await readTable(file);
      const first = b.sheets.find((s) => b.rows(s).length > 1) ?? b.sheets[0];
      const rows = b.rows(first);
      // El encabezado es la primera fila (de las 10 primeras) donde reconocemos más columnas
      let best = 0, bestScore = -1;
      rows.slice(0, 10).forEach((r, i) => { const sc = Object.keys(autoMap(r)).length; if (sc > bestScore) { best = i; bestScore = sc; } });
      setBook(b); setFileName(file.name); setSheet(first); setHeaderRow(best); setMap(autoMap(rows[best] ?? []));
    } catch (e) {
      toast(`No se pudo leer el archivo: ${e instanceof Error ? e.message : e}`, "error");
    } finally { setBusy(false); }
  };

  const rows: Row[] = useMemo(() => {
    if (!table.length) return [];
    const existing = new Set<string>();
    db.patients.forEach((p) => { existing.add(`n:${norm(p.name)}`); const ph = p.phone.replace(/\D/g, "").slice(-10); if (ph.length === 10) existing.add(`t:${ph}`); });
    const seen = new Set<string>();
    const get = (r: string[], f: Field) => (map[f] !== undefined ? r[map[f]!] ?? "" : "");
    return table.slice(headerRow + 1).map((r, i) => {
      const name = titleCase((get(r, "name") || [get(r, "firstName"), get(r, "lastName"), get(r, "lastName2")].filter(Boolean).join(" ")).replace(/\s+/g, " ").trim());
      const birthRaw = get(r, "birthDate");
      const birth = parseDate(birthRaw);
      const p: Patient = {
        id: `p${uid()}`, name, phone: fmtPhone(get(r, "phone")), email: get(r, "email") || undefined,
        birthDate: birth || "", gender: parseGender(get(r, "gender")),
        allergies: get(r, "allergies") || undefined, conditions: get(r, "conditions") || undefined, notes: get(r, "notes") || undefined,
        createdAt: today(), teeth: {}, clinicalNotes: [],
      };
      const ph = p.phone.replace(/\D/g, "").slice(-10);
      const keys = [`n:${norm(name)}`, ...(ph.length === 10 ? [`t:${ph}`] : [])];
      const dup = keys.some((k) => existing.has(k) || seen.has(k));
      keys.forEach((k) => seen.add(k));
      const status: Row["status"] = !name ? "sin_nombre" : dup ? "duplicado" : "ok";
      return { p, status, line: headerRow + i + 2, warn: birth === null ? `Fecha "${birthRaw}" no reconocida` : undefined };
    }).filter((r) => r.p.name || Object.values(map).some((c) => table[r.line - 1]?.[c!]));
  }, [table, headerRow, map, db.patients]);

  const toImport = rows.filter((r) => r.status === "ok" || (includeDup && r.status === "duplicado"));
  const count = (s: Row["status"]) => rows.filter((r) => r.status === s).length;
  const hasName = map.name !== undefined || map.firstName !== undefined;

  const doImport = () => {
    if (!toImport.length) return;
    update((d) => ({ ...d, patients: [...toImport.map((r) => r.p), ...d.patients] }));
    toast(toImport.length === 1 ? "1 paciente importado" : `${toImport.length} pacientes importados`);
    close();
  };

  const template = () => downloadCSV("plantilla-pacientes-odonty.csv", [
    { Nombre: "Ana", Apellidos: "García López", Teléfono: "55 1234 5678", Correo: "ana@correo.com", "Fecha de nacimiento": "14/03/1998", Sexo: "F", Alergias: "Penicilina", Padecimientos: "", Notas: "" },
    { Nombre: "Juan", Apellidos: "Pérez Morales", Teléfono: "5523456789", Correo: "", "Fecha de nacimiento": "02/07/1985", Sexo: "M", Alergias: "", Padecimientos: "Hipertensión", Notas: "Prefiere citas por la tarde" },
  ]);

  return (
    <Modal open={open} onClose={close} size="lg" title="Importar pacientes" subtitle={fileName || "Desde Excel (.xlsx) o CSV"}
      footer={book ? (
        <>
          <button className="btn-ghost mr-auto" onClick={reset}>Elegir otro archivo</button>
          <button className="btn-outline" onClick={close}>Cancelar</button>
          <button className="btn-primary" disabled={!hasName || !toImport.length} onClick={doImport}><CheckCircle2 size={18} /> Importar {toImport.length} {toImport.length === 1 ? "paciente" : "pacientes"}</button>
        </>
      ) : undefined}>
      {!book ? (
        <div className="flex flex-col gap-4">
          <button type="button" disabled={busy} onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) load(f); }}
            className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-edge bg-bg px-6 py-12 text-center transition hover:border-brand hover:bg-brand-soft">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface text-brand"><FileSpreadsheet size={28} /></span>
            <span className="font-bold">{busy ? "Leyendo archivo…" : "Arrastra tu archivo aquí o haz clic para elegirlo"}</span>
            <span className="text-sm text-muted">Excel (.xlsx, .xls) o CSV. Una fila por paciente, con encabezados en la primera fila.</span>
          </button>
          <input ref={input} type="file" hidden accept=".xlsx,.xls,.csv,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = ""; }} />
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-brand-soft p-4 text-sm text-brand-dark">
            <span className="flex-1">¿No tienes un archivo? Usa la plantilla: llénala en Excel y súbela aquí.</span>
            <button className="btn-outline btn-sm" onClick={template}><Download size={14} /> Descargar plantilla</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {book.sheets.length > 1 && (
            <label className="label">Hoja
              <select className="input" value={sheet} onChange={(e) => { setSheet(e.target.value); const r = book.rows(e.target.value); setHeaderRow(0); setMap(autoMap(r[0] ?? [])); }}>
                {book.sheets.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
          )}

          <section>
            <p className="mb-2 text-sm font-bold">Columnas detectadas <span className="font-normal text-muted">· revisa y corrige si hace falta</span></p>
            <div className="grid gap-2 sm:grid-cols-2">
              {fields.filter((f) => map.name === undefined || !["firstName", "lastName", "lastName2"].includes(f) || map[f] !== undefined).map((f) => (
                <label key={f} className="flex items-center gap-2 text-sm">
                  <span className="w-40 shrink-0 font-semibold">{fieldLabel[f]}</span>
                  <select aria-label={fieldLabel[f]} className={`input min-h-[38px] ${map[f] !== undefined ? "border-brand" : ""}`} value={map[f] ?? ""}
                    onChange={(e) => setMap({ ...map, [f]: e.target.value === "" ? undefined : +e.target.value })}>
                    <option value="">— No importar —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `Columna ${i + 1}`}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {!hasName && <p className="mt-2 flex items-center gap-2 rounded-xl bg-[#FBE3E0] p-3 text-sm text-[#9E2A20]"><AlertTriangle size={16} /> Elige la columna del nombre del paciente.</p>}
          </section>

          <section>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="badge bg-brand-soft text-brand-dark">{count("ok")} nuevos</span>
              {count("duplicado") > 0 && <span className="badge bg-[#FDF1D8] text-[#855A06]">{count("duplicado")} posibles duplicados</span>}
              {count("sin_nombre") > 0 && <span className="badge bg-[#FBE3E0] text-[#9E2A20]">{count("sin_nombre")} sin nombre (se omiten)</span>}
              {rows.some((r) => r.warn) && <span className="badge bg-[#E6EEF8] text-[#22508F]">{rows.filter((r) => r.warn).length} con fecha no reconocida (se importan sin fecha)</span>}
            </div>
            {count("duplicado") > 0 && (
              <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-brand" checked={includeDup} onChange={(e) => setIncludeDup(e.target.checked)} />
                Importar también los posibles duplicados (mismo nombre o teléfono que un paciente existente)
              </label>
            )}
            <div className="max-h-72 overflow-auto rounded-xl border border-line">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="sticky top-0 bg-surface"><tr><th className="th pl-3">Fila</th><th className="th">Nombre</th><th className="th">Teléfono</th><th className="th">Nacimiento</th><th className="th">Estado</th></tr></thead>
                <tbody>{rows.slice(0, 200).map((r) => (
                  <tr key={r.line} className={r.status !== "ok" && !(includeDup && r.status === "duplicado") ? "opacity-50" : ""}>
                    <td className="td pl-3 text-muted">{r.line}</td>
                    <td className="td font-semibold">{r.p.name || "—"}</td>
                    <td className="td">{r.p.phone || "—"}</td>
                    <td className="td">{r.p.birthDate || (r.warn ? <span className="text-[#22508F]">{r.warn}</span> : "—")}</td>
                    <td className="td">{r.status === "ok" ? <span className="text-brand-dark">Nuevo</span> : r.status === "duplicado" ? <span className="text-[#855A06]">Ya existe</span> : <span className="text-[#9E2A20]">Sin nombre</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {rows.length > 200 && <p className="mt-1 text-xs text-muted">Mostrando 200 de {rows.length} filas; se importarán todas las marcadas.</p>}
          </section>
        </div>
      )}
    </Modal>
  );
}
