"use client";
import { useState } from "react";
import { Eraser } from "lucide-react";
import { lowerTeeth, upperTeeth } from "@/lib/mock-data";
import type { Surface, SurfaceFinding, SurfaceMap, ToothStatus } from "@/lib/types";

export const findingColor: Record<SurfaceFinding, string> = { caries: "#D9483B", obturado: "#3A7BD5", sellante: "#12A36A", fractura: "#F2B33D" };
export const findingLabel: Record<SurfaceFinding, string> = { caries: "Caries", obturado: "Obturación", sellante: "Sellante", fractura: "Fractura" };
export const surfaceLabel: Record<Surface, string> = { O: "Oclusal", M: "Mesial", D: "Distal", V: "Vestibular", L: "Lingual / palatino" };
const findings = Object.keys(findingColor) as SurfaceFinding[];

// Polígonos de un diente de 40×40: arriba, abajo, izquierda, derecha y centro
const poly = {
  top: "2,2 38,2 27,13 13,13",
  bottom: "13,27 27,27 38,38 2,38",
  left: "2,2 13,13 13,27 2,38",
  right: "38,2 38,38 27,27 27,13",
};

/** Qué cara corresponde a cada posición según el cuadrante (mesial siempre hacia la línea media). */
const layoutFor = (n: number): Record<"top" | "bottom" | "left" | "right", Surface> => {
  const q = Math.floor(n / 10);
  const upper = q === 1 || q === 2;
  const screenLeft = q === 1 || q === 4; // lado derecho del paciente
  return {
    top: upper ? "V" : "L",
    bottom: upper ? "L" : "V",
    left: screenLeft ? "D" : "M",
    right: screenLeft ? "M" : "D",
  };
};

/** Resumen legible: "16 · Caries O-M". */
export const surfaceSummary = (map: SurfaceMap = {}) =>
  Object.entries(map).flatMap(([tooth, faces]) =>
    findings.map((f) => ({ tooth: +tooth, finding: f, faces: (Object.keys(faces) as Surface[]).filter((s) => faces[s] === f) }))
      .filter((x) => x.faces.length))
    .sort((a, b) => a.tooth - b.tooth);

interface Props {
  teeth: Record<number, ToothStatus>;
  surfaces: SurfaceMap;
  onChange?: (next: SurfaceMap) => void;
  compact?: boolean;
}

export default function SurfaceOdontogram({ teeth, surfaces, onChange, compact }: Props) {
  const [tool, setTool] = useState<SurfaceFinding | "borrar">("caries");
  const [hover, setHover] = useState<{ n: number; s: Surface } | null>(null);

  const paint = (n: number, s: Surface) => {
    if (!onChange) return;
    const faces = { ...(surfaces[n] ?? {}) };
    if (tool === "borrar" || faces[s] === tool) delete faces[s]; else faces[s] = tool;
    const next = { ...surfaces, [n]: faces };
    if (!Object.keys(faces).length) delete next[n];
    onChange(next);
  };

  const Tooth = ({ n }: { n: number }) => {
    const faces = surfaces[n] ?? {};
    const lay = layoutFor(n);
    const absent = teeth[n] === "ausente";
    const crowned = teeth[n] === "tratado";
    const fill = (s: Surface) => (faces[s] ? findingColor[faces[s]!] : "var(--tooth-fill, #fff)");
    const part = (pos: keyof typeof poly | "center") => {
      const s = pos === "center" ? "O" : lay[pos];
      const common = {
        fill: fill(s), stroke: "#B7C4D1", strokeWidth: 1,
        className: onChange && !absent ? "cursor-pointer transition-opacity hover:opacity-70" : "",
        onClick: () => !absent && paint(n, s),
        onMouseEnter: () => setHover({ n, s }),
        onMouseLeave: () => setHover(null),
      };
      return pos === "center"
        ? <rect key={pos} x={13} y={13} width={14} height={14} {...common}><title>{`${n} ${surfaceLabel[s]}`}</title></rect>
        : <polygon key={pos} points={poly[pos]} {...common}><title>{`${n} ${surfaceLabel[s]}`}</title></polygon>;
    };
    return (
      <div className="flex flex-col items-center gap-1">
        <span className={`text-[11px] font-bold ${hover?.n === n ? "text-brand" : "text-muted"}`}>{n}</span>
        <svg viewBox="0 0 40 40" className={`w-full ${compact ? "max-w-[24px]" : "max-w-[36px]"} ${absent ? "opacity-40" : ""}`} aria-label={`Diente ${n}`}>
          {(["top", "bottom", "left", "right", "center"] as const).map(part)}
          {crowned && <rect x={1} y={1} width={38} height={38} fill="none" stroke="#12A36A" strokeWidth={2.5} rx={3} />}
          {absent && <path d="M4 4l32 32M36 4 4 36" stroke="#5B6B7B" strokeWidth={2.5} strokeLinecap="round" />}
        </svg>
      </div>
    );
  };
  const Row = ({ list }: { list: number[] }) => (
    <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(16, minmax(0,1fr))" }}>
      {list.map((n, i) => <div key={n} className={i === 8 ? "border-l-2 border-dashed border-line" : ""}><Tooth n={n} /></div>)}
    </div>
  );
  const summary = surfaceSummary(surfaces);

  return (
    <div>
      {onChange && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 print:hidden">
          <span className="mr-1 text-xs font-bold uppercase tracking-wider text-muted">Marcar:</span>
          {findings.map((f) => (
            <button key={f} type="button" onClick={() => setTool(f)}
              className={`btn btn-sm border ${tool === f ? "border-navy bg-navy text-white" : "border-line bg-surface hover:bg-bg"}`}>
              <span className="h-3 w-3 rounded-sm" style={{ background: findingColor[f] }} /> {findingLabel[f]}
            </button>
          ))}
          <button type="button" onClick={() => setTool("borrar")} className={`btn btn-sm border ${tool === "borrar" ? "border-navy bg-navy text-white" : "border-line bg-surface hover:bg-bg"}`}><Eraser size={14} /> Borrar</button>
          <span className="ml-auto text-xs text-muted">{hover ? `Diente ${hover.n} · ${surfaceLabel[hover.s]}` : "Toca una cara del diente"}</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <div className={compact ? "min-w-[440px]" : "min-w-[600px]"}>
          <Row list={upperTeeth} />
          <div className="my-3 h-0.5 rounded bg-line" />
          <Row list={lowerTeeth} />
        </div>
      </div>
      {!compact && (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-soft">
          {findings.map((f) => <span key={f} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: findingColor[f] }} />{findingLabel[f]}</span>)}
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border-2 border-brand" />Corona / tratado</span>
          <span className="flex items-center gap-1.5">✕ Ausente</span>
          <span className="text-muted">V vestibular · L lingual/palatino · M mesial · D distal · O oclusal</span>
        </div>
      )}
      {summary.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {summary.map((x) => (
            <span key={`${x.tooth}-${x.finding}`} className="badge border border-line bg-surface text-ink-soft">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: findingColor[x.finding] }} />
              {x.tooth} · {findingLabel[x.finding]} {x.faces.join("-")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
