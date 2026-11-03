"use client";
import type { ToothStatus } from "@/lib/types";
import { lowerTeeth, upperTeeth } from "@/lib/mock-data";

export const toothFill: Record<ToothStatus, { fill: string; stroke: string }> = {
  sano: { fill: "#FFFFFF", stroke: "#C9D4DF" },
  tratado: { fill: "#12A36A", stroke: "#0A6B46" },
  pendiente: { fill: "#F2B33D", stroke: "#B9851E" },
  problema: { fill: "#D9483B", stroke: "#9E2A20" },
  ausente: { fill: "#EEF2F6", stroke: "#B7C4D1" },
};
export const statusLabel: Record<ToothStatus, string> = {
  sano: "Sano", tratado: "Tratado", pendiente: "Tratamiento sugerido", problema: "Con problema", ausente: "Ausente",
};
export const toothStatuses = Object.keys(statusLabel) as ToothStatus[];

// Siluetas simples por tipo de diente (coronas vistas de frente)
const shapes = {
  molar: "M4 10c0-5 3-8 8-8 2 0 3 1 4 1s2-1 4-1c5 0 8 3 8 8 0 6-2 9-3 14-.6 3-1.5 6-3 6s-2-4-3-7c-.5-1.2-2.5-1.2-3 0-1 3-1.5 7-3 7s-2.4-3-3-6C6 19 4 16 4 10z",
  premolar: "M7 9c0-5 3-7 9-7s9 2 9 7c0 6-2 9-3.5 14-.8 3-2.2 7-5.5 7s-4.7-4-5.5-7C9 18 7 15 7 9z",
  canino: "M8 11c0-5 4-9 8-9s8 4 8 9c0 6-2 9-3.5 14-.8 3-2.5 5-4.5 5s-3.7-2-4.5-5C10 20 8 17 8 11z",
  incisivo: "M8 6c0-3 2-4 8-4s8 1 8 4c0 7-1.5 11-3 17-.7 3-2.5 7-5 7s-4.3-4-5-7C9.5 17 8 13 8 6z",
};
const typeOf = (n: number) => { const u = n % 10; return u >= 6 ? "molar" : u >= 4 ? "premolar" : u === 3 ? "canino" : "incisivo"; };

interface Props {
  teeth: Record<number, ToothStatus>;
  selected?: number | null;
  onSelect?: (n: number) => void;
  compact?: boolean;
}

export default function Odontogram({ teeth, selected, onSelect, compact }: Props) {
  const Tooth = ({ n, top }: { n: number; top: boolean }) => {
    const s = teeth[n] ?? "sano";
    const { fill, stroke } = toothFill[s];
    const isSel = selected === n;
    return (
      <button type="button" onClick={() => onSelect?.(n)} disabled={!onSelect} aria-label={`Diente ${n}: ${statusLabel[s]}`} aria-pressed={isSel}
        className={`group flex flex-col items-center gap-1 rounded-xl py-1.5 transition ${isSel ? "bg-[#E6F0FA] ring-2 ring-navy" : onSelect ? "hover:bg-bg" : ""}`}>
        {top && <span className={`text-[11px] font-bold ${isSel ? "text-navy" : "text-muted"}`}>{n}</span>}
        <svg viewBox="0 0 32 32" className={`w-full ${compact ? "max-w-[22px]" : "max-w-[34px]"} transition group-hover:scale-110 ${top ? "" : "rotate-180"}`} aria-hidden="true">
          <path d={shapes[typeOf(n)]} fill={fill} stroke={stroke} strokeWidth="1.6" strokeDasharray={s === "ausente" ? "3 2" : undefined} />
          {s === "ausente" && <path d="M9 9l14 14M23 9 9 23" stroke="#9FB4C9" strokeWidth="1.6" strokeLinecap="round" />}
        </svg>
        {!top && <span className={`text-[11px] font-bold ${isSel ? "text-navy" : "text-muted"}`}>{n}</span>}
      </button>
    );
  };
  const Row = ({ list, top }: { list: number[]; top: boolean }) => (
    <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(16, minmax(0,1fr))" }}>
      {list.map((n, i) => <div key={n} className={i === 8 ? "border-l-2 border-dashed border-line" : ""}><Tooth n={n} top={top} /></div>)}
    </div>
  );
  return (
    <div className="overflow-x-auto">
      <div className={compact ? "min-w-[420px]" : "min-w-[560px]"}>
        {!compact && <p className="mb-2 flex justify-between text-xs font-bold tracking-widest text-muted"><span>SUPERIOR DERECHO</span><span>SUPERIOR IZQUIERDO</span></p>}
        <Row list={upperTeeth} top />
        <div className="my-3 h-0.5 rounded bg-line" />
        <Row list={lowerTeeth} top={false} />
        {!compact && <p className="mt-2 flex justify-between text-xs font-bold tracking-widest text-muted"><span>INFERIOR DERECHO</span><span>INFERIOR IZQUIERDO</span></p>}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-soft">
          {toothStatuses.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border" style={{ background: toothFill[s].fill, borderColor: toothFill[s].stroke }} />
              {statusLabel[s]} <b className="text-muted">({s === "sano" ? 32 - Object.values(teeth).filter((v) => v !== "sano").length : Object.values(teeth).filter((v) => v === s).length})</b>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Selector de estado para un diente. */
export function ToothStatusPicker({ value, onChange }: { value: ToothStatus; onChange: (s: ToothStatus) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {toothStatuses.map((s) => (
        <button key={s} type="button" onClick={() => onChange(s)}
          className={`btn btn-sm border ${value === s ? "border-navy bg-navy text-white" : "border-line bg-surface hover:bg-bg"}`}>
          <span className="h-2.5 w-2.5 rounded-full border" style={{ background: toothFill[s].fill, borderColor: toothFill[s].stroke }} />
          {statusLabel[s]}
        </button>
      ))}
    </div>
  );
}
