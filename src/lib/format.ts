export const mxn = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

/** Cantidades de inventario: hasta 2 decimales, sin ceros sobrantes. */
export const fmtQty = (n: number) => String(Math.round(n * 100) / 100);

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

export const initials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/* ---------- Fechas (siempre en hora local, formato YYYY-MM-DD) ---------- */
const pad = (n: number) => String(n).padStart(2, "0");
export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDate = (s: string) => { const [y, m, d] = s.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
export const today = () => toISODate(new Date());
export const addDays = (s: string, n: number) => { const d = parseDate(s); d.setDate(d.getDate() + n); return toISODate(d); };
export const startOfWeek = (s: string) => { const d = parseDate(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return toISODate(d); };
export const monthKey = (s: string) => s.slice(0, 7);
export const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

export const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
export const fromMin = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/** true si la fecha y hora indicadas ya pasaron (día anterior, u hoy a una hora anterior a la actual). */
export const isPast = (date: string, start: string) => date < today() || (date === today() && toMin(start) < toMin(nowTime()));

/** Primer horario de agenda (en pasos de `step` min) que todavía no pasa hoy; null si ya no queda ninguno. */
export const nextOpenSlot = (startHour: number, endHour: number, step = 15) => {
  const now = toMin(nowTime());
  for (let m = startHour * 60; m < endHour * 60; m += step) if (m >= now) return fromMin(m);
  return null;
};

export const fmtDate = (s: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  parseDate(s).toLocaleDateString("es-MX", opts);
export const fmtLong = (s: string) => fmtDate(s, { weekday: "long", day: "numeric", month: "long" });
export const monthName = (key: string) =>
  parseDate(`${key}-01`).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
export const shortMonth = (key: string) =>
  parseDate(`${key}-01`).toLocaleDateString("es-MX", { month: "short" }).replace(".", "");

export const age = (birth: string) => {
  if (!birth) return 0;
  const b = parseDate(birth), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
};

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
};

/** Descarga un CSV a partir de filas de objetos. */
export const downloadCSV = (filename: string, rows: Record<string, string | number | undefined>[]) => {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

export const whatsappLink = (phone: string, text: string) =>
  `https://wa.me/52${phone.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(text)}`;
