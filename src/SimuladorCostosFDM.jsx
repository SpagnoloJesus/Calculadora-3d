import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
} from "recharts";
import {
  RotateCcw,
  ChevronDown,
  Layers,
  Zap,
  Cog,
  AlertTriangle,
  Hand,
  Package,
  Truck,
  Store,
  ShoppingBag,
  Scale,
  Timer,
  Clock,
  Wand2,
  Info,
} from "lucide-react";

/* ================================================================== */
/*  Tokens                                                             */
/* ================================================================== */

const C = {
  bg: "#EEF1F5",
  panel: "#FFFFFF",
  ink: "#151C28",
  inkSoft: "#2B3549",
  muted: "#5B6576",
  faint: "#8A93A3",
  line: "#E2E6EC",
  lineStrong: "#CDD3DC",
  wash: "#F5F7FA",
  yellow: "#F5C400",
  yellowDeep: "#D6A900",
  yellowWash: "#FFF7D1",
  costo: "#2A78D6",
  ganancia: "#1BAF7A",
  comision: "#EB6834",
};

/* ================================================================== */
/*  Datos base                                                         */
/* ================================================================== */

const DEFAULTS = {
  peso: 120,
  tiempoImpresion: 4.5,
  manoObraMin: 20,
  precioKg: 20000,
  valorHora: 6000,
  packaging: 500,
  valorImpresora: 800000,
  vidaUtil: 4000,
  mantenimientoPct: 15,
  potenciaW: 150,
  costoKwh: 150,
  fallaPct: 10,
  comisionPct: 22,
  markupMay: 2,
  markupMin: 3,
};

/**
 * Valores de referencia para "No lo conozco".
 * kind "fuente": dato publicado (con su origen). kind "estimado": supuesto razonable.
 * Actualizá estos números cuando cambien los precios.
 */
const REFS = {
  precioKg: {
    value: 24000,
    kind: "fuente",
    text: "PLA nacional de 1 kg (Grilon3) publicado en MercadoLibre.",
  },
  costoKwh: {
    value: 185,
    kind: "fuente",
    text: "Tarifa residencial sin subsidio en CABA (Edesur/Edenor): $146/kWh según el cuadro del ENRE de junio 2026, más IVA y tasas.",
  },
  potenciaW: {
    value: 120,
    kind: "estimado",
    text: "Consumo medio de una impresora FDM de cama abierta imprimiendo PLA.",
  },
  valorImpresora: {
    value: 990000,
    kind: "fuente",
    text: "Bambu Lab A1, precio mediano en MercadoLibre en octubre 2026.",
  },
  vidaUtil: {
    value: 5000,
    kind: "estimado",
    text: "Horas de uso razonables antes de reemplazar una impresora hogareña.",
  },
  mantenimientoPct: {
    value: 15,
    kind: "estimado",
    text: "Boquillas, correas, superficie de impresión y repuestos menores.",
  },
  fallaPct: {
    value: 10,
    kind: "estimado",
    text: "Impresiones fallidas, pruebas y purga. Entre 5% y 15% es lo habitual.",
  },
  valorHora: {
    value: 6000,
    kind: "estimado",
    text: "Valor orientativo de una hora de trabajo técnico.",
  },
  packaging: {
    value: 500,
    kind: "estimado",
    text: "Bolsa, etiqueta y cinta para una pieza chica.",
  },
  comisionPct: {
    value: 15,
    kind: "fuente",
    text: "Comisión de publicación clásica en MercadoLibre (12% a 17% según la categoría). No incluye el cargo fijo por unidad ni impuestos.",
  },
};

const INITIAL = { v: DEFAULTS, ref: {}, off: {} };
const STORAGE_KEY = "costeo3d:v2";

/* ================================================================== */
/*  Formato es-AR                                                      */
/* ================================================================== */

const nf0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfN = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

const ars = (v) => (Number.isFinite(v) ? `$${nf0.format(Math.round(v))}` : "—");
const ars2 = (v) => (Number.isFinite(v) ? `$${nf2.format(v)}` : "—");
const pct = (v) => (Number.isFinite(v) ? `${nf1.format(v)}%` : "—");
const num = (v) => (Number.isFinite(v) ? nfN.format(v) : "—");
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function parseNum(raw) {
  const s = String(raw).trim().replace(/\s|\$/g, "");
  if (!s) return NaN;
  if (s.includes(",")) return parseFloat(s.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return parseFloat(s.replace(/\./g, ""));
  return parseFloat(s);
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ================================================================== */
/*  Cálculo (fórmulas del pliego, con componentes que se pueden quitar) */
/* ================================================================== */

function calcular(e, off) {
  const costo_material = (e.precioKg / 1000) * e.peso;
  const costo_energia = off.energia ? 0 : (e.potenciaW / 1000) * e.tiempoImpresion * e.costoKwh;
  const costo_maquina = off.maquina
    ? 0
    : (e.valorImpresora / e.vidaUtil) * (1 + e.mantenimientoPct / 100) * e.tiempoImpresion;
  const costo_fallos = off.fallos
    ? 0
    : (costo_material + costo_energia + costo_maquina) * (e.fallaPct / 100);
  const costo_mano_obra = off.manoObra ? 0 : (e.manoObraMin / 60) * e.valorHora;
  const insumos_packaging = off.packaging ? 0 : e.packaging;

  const ctu =
    costo_material + costo_energia + costo_maquina + costo_fallos + costo_mano_obra + insumos_packaging;

  const precio_mayorista = ctu * e.markupMay;
  const precio_minorista = ctu * e.markupMin;
  const c = e.comisionPct / 100;
  const precio_marketplace = precio_minorista / (1 - c);
  const comision_marketplace = precio_marketplace * c;

  return {
    costo_material,
    costo_energia,
    costo_maquina,
    costo_fallos,
    costo_mano_obra,
    insumos_packaging,
    ctu,
    costo_por_gramo: ctu / e.peso,
    precio_mayorista,
    ganancia_mayorista: precio_mayorista - ctu,
    margen_mayorista: precio_mayorista ? ((precio_mayorista - ctu) / precio_mayorista) * 100 : 0,
    precio_minorista,
    ganancia_minorista: precio_minorista - ctu,
    margen_minorista: precio_minorista ? ((precio_minorista - ctu) / precio_minorista) * 100 : 0,
    precio_marketplace,
    comision_marketplace,
    ganancia_marketplace: precio_marketplace - comision_marketplace - ctu,
  };
}

/* ================================================================== */
/*  Estilos globales                                                   */
/* ================================================================== */

const GlobalStyles = () => (
  <style>{`
@import url('https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..800&display=swap');

.fdm-root { font-family: 'Archivo', ui-sans-serif, system-ui, sans-serif; font-variant-numeric: tabular-nums; color: ${C.ink}; -webkit-font-smoothing: antialiased; }
.fdm-wide { font-stretch: 122%; letter-spacing: -0.015em; }
.fdm-layers { background-image: repeating-linear-gradient(0deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 4px); }

.fdm-range { -webkit-appearance: none; appearance: none; width: 100%; height: 20px; background: transparent; cursor: pointer; }
.fdm-range:focus { outline: none; }
.fdm-range::-webkit-slider-runnable-track { height: 4px; border-radius: 999px; background: linear-gradient(to right, ${C.ink} 0 var(--fill), ${C.line} var(--fill) 100%); }
.fdm-range::-moz-range-track { height: 4px; border-radius: 999px; background: ${C.line}; }
.fdm-range::-moz-range-progress { height: 4px; border-radius: 999px; background: ${C.ink}; }
.fdm-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; margin-top: -7px; border-radius: 999px; background: ${C.yellow}; border: 3px solid ${C.ink}; transition: transform 120ms ease; }
.fdm-range::-moz-range-thumb { width: 12px; height: 12px; border-radius: 999px; background: ${C.yellow}; border: 3px solid ${C.ink}; }
.fdm-range:active::-webkit-slider-thumb { transform: scale(1.12); }
.fdm-range:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 4px rgba(245,196,0,0.45); }
.fdm-range:focus-visible::-moz-range-thumb { box-shadow: 0 0 0 4px rgba(245,196,0,0.45); }

.fdm-focus:focus-visible { outline: 2px solid ${C.ink}; outline-offset: 2px; }
.fdm-field:focus-within { border-color: ${C.ink}; box-shadow: 0 0 0 3px rgba(245,196,0,0.35); }
.fdm-check { accent-color: ${C.ink}; width: 15px; height: 15px; }
.fdm-scroll { scrollbar-width: thin; scrollbar-color: ${C.lineStrong} transparent; }

@media (prefers-reduced-motion: reduce) {
  .fdm-root *, .fdm-root *::before, .fdm-root *::after { transition: none !important; animation: none !important; }
}
`}</style>
);

/* ================================================================== */
/*  Controles base                                                     */
/* ================================================================== */

function NumberInput({ id, value, onChange, min = 0, max = Infinity, prefix, suffix, ariaLabel, className = "" }) {
  const [draft, setDraft] = useState(null);
  const shown = draft !== null ? draft : num(value);
  return (
    <div
      className={`fdm-field flex h-9 items-center rounded-lg border bg-white transition-colors ${className}`}
      style={{ borderColor: C.lineStrong }}
    >
      {prefix && (
        <span className="pl-2.5 text-sm" style={{ color: C.faint }}>
          {prefix}
        </span>
      )}
      <input
        id={id}
        aria-label={ariaLabel}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={shown}
        onFocus={(e) => {
          setDraft(num(value));
          const el = e.target;
          requestAnimationFrame(() => el.select());
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = parseNum(e.target.value);
          if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
        onBlur={(e) => {
          const n = parseNum(e.target.value);
          if (Number.isFinite(n)) onChange(clamp(n, min, max));
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="h-full w-full min-w-0 bg-transparent px-2.5 text-right text-sm font-semibold outline-none"
        style={{ color: C.ink }}
      />
      {suffix && (
        <span className="whitespace-nowrap pr-2.5 text-xs" style={{ color: C.faint }}>
          {suffix}
        </span>
      )}
    </div>
  );
}

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={checked ? "Incluido en el costo" : "Fuera del costo"}
      onClick={() => onChange(!checked)}
      className="fdm-focus relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
      style={{ background: checked ? C.ink : C.lineStrong }}
    >
      <span
        className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  );
}

function KindTag({ kind }) {
  const fuente = kind === "fuente";
  return (
    <span
      className="mr-1.5 inline-block rounded px-1.5 py-px text-[10px] font-bold"
      style={{ background: fuente ? "#E3F1EA" : "#E9ECF1", color: fuente ? "#0E6B49" : C.muted }}
    >
      {fuente ? "Dato" : "Estimado"}
    </span>
  );
}

/** Parámetro del taller con opción "No lo conozco, usar referencia". */
function Param({ k, label, prefix, suffix, min = 0, max = Infinity, s, setV, setRef }) {
  const usingRef = !!s.ref[k];
  const ref = REFS[k];
  const id = `p-${k}`;
  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm" style={{ color: C.inkSoft }}>
          {label}
        </label>
        {usingRef ? (
          <div
            id={id}
            className="flex h-9 w-36 shrink-0 items-center justify-end gap-1 rounded-lg border px-2.5 text-sm font-semibold"
            style={{ borderColor: C.yellowDeep, background: C.yellowWash, color: C.ink }}
          >
            {prefix && <span className="font-normal" style={{ color: C.muted }}>{prefix}</span>}
            {num(ref.value)}
            {suffix && (
              <span className="text-xs font-normal" style={{ color: C.muted }}>
                {suffix}
              </span>
            )}
          </div>
        ) : (
          <NumberInput
            id={id}
            value={s.v[k]}
            onChange={(n) => setV(k, n)}
            prefix={prefix}
            suffix={suffix}
            min={min}
            max={max}
            className="w-36 shrink-0"
          />
        )}
      </div>
      {ref && (
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs" style={{ color: C.muted }}>
          <input type="checkbox" className="fdm-check" checked={usingRef} onChange={(e) => setRef(k, e.target.checked)} />
          No lo conozco, usar valor de referencia
        </label>
      )}
      {usingRef && (
        <p className="mt-1.5 text-xs leading-relaxed" style={{ color: C.muted }}>
          <KindTag kind={ref.kind} />
          {ref.text}
        </p>
      )}
    </div>
  );
}

function SliderRow({ id, icon: Icon, label, value, onChange, min, max, step, unit }) {
  const fill = `${((clamp(value, min, max) - min) / (max - min)) * 100}%`;
  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium" style={{ color: C.inkSoft }}>
          <Icon size={15} style={{ color: C.muted }} />
          {label}
        </label>
        <NumberInput id={id} value={value} onChange={onChange} min={min} max={max} suffix={unit} className="w-28 shrink-0" />
      </div>
      <input
        type="range"
        aria-label={label}
        className="fdm-range mt-2"
        min={min}
        max={max}
        step={step}
        value={clamp(value, min, max)}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ "--fill": fill }}
      />
    </div>
  );
}

/** Componente de costo: monto en vivo, interruptor para incluirlo y parámetros desplegables. */
function CostItem({ icon: Icon, title, amount, share, included, onToggle, canExclude, open, onOpen, refsInUse, children }) {
  return (
    <div className="border-t" style={{ borderColor: C.line }}>
      <div className="flex items-center gap-3 py-3">
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={open}
          className="fdm-focus flex min-w-0 flex-1 items-center gap-3 rounded-md text-left"
        >
          <ChevronDown
            size={16}
            className="shrink-0 transition-transform duration-200"
            style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", color: C.faint }}
          />
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
            style={{ background: included ? C.wash : "transparent", color: included ? C.ink : C.faint }}
          >
            <Icon size={15} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold" style={{ color: included ? C.ink : C.faint }}>
              {title}
            </span>
            {included && refsInUse > 0 && (
              <span className="block text-[11px] font-medium" style={{ color: "#9A7A00" }}>
                {refsInUse === 1 ? "Con 1 valor de referencia" : `Con ${refsInUse} valores de referencia`}
              </span>
            )}
            {!included && (
              <span className="block text-[11px]" style={{ color: C.faint }}>
                Fuera del cálculo
              </span>
            )}
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-sm font-bold" style={{ color: included ? C.ink : C.faint }}>
              {included ? ars(amount) : "—"}
            </span>
            {included && (
              <span className="block text-[11px]" style={{ color: C.faint }}>
                {pct(share)}
              </span>
            )}
          </span>
        </button>
        {canExclude ? (
          <Switch checked={included} onChange={onToggle} label={`Incluir ${title.toLowerCase()} en el costo`} />
        ) : (
          <span className="w-9 shrink-0" aria-hidden="true" />
        )}
      </div>
      {open && (
        <div className="mb-3 ml-7 divide-y divide-slate-200 rounded-lg px-3" style={{ background: C.wash, opacity: included ? 1 : 0.55 }}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Resultados                                                         */
/* ================================================================== */

function SplitBar({ price, parts }) {
  const vis = parts.filter((x) => x.v > 0);
  if (!price) return null;
  return (
    <div>
      <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        {vis.map((x) => (
          <span key={x.label} style={{ width: `${(x.v / price) * 100}%`, background: x.color }} />
        ))}
      </div>
      <p className="mt-2 text-xs leading-snug" style={{ color: C.muted }}>
        De cada $100:{" "}
        {vis.map((x, i) => (
          <span key={x.label}>
            {i > 0 && (i === vis.length - 1 ? " y " : ", ")}
            <span className="font-semibold" style={{ color: C.ink }}>
              ${nf0.format(Math.round((x.v / price) * 100))}
            </span>{" "}
            {x.label}
          </span>
        ))}
      </p>
    </div>
  );
}

function Channel({ icon: Icon, name, factor, price, rows, split, children }) {
  return (
    <div className="flex flex-col p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: C.inkSoft }}>
          <Icon size={15} />
          {name}
        </span>
        <span className="rounded-md px-1.5 py-0.5 text-xs font-bold" style={{ background: C.wash, color: C.muted }}>
          {factor}
        </span>
      </div>
      <div className="fdm-wide mt-3 text-[28px] font-extrabold leading-none">{price}</div>
      <dl className="mt-4 space-y-1.5 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-3">
            <dt style={{ color: C.muted }}>{row.label}</dt>
            <dd className={row.strong ? "font-bold" : "font-medium"}>{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-auto pt-4">{split}</div>
      {children}
    </div>
  );
}

function TooltipShell({ children }) {
  return (
    <div
      className="fdm-root rounded-lg px-3.5 py-3 text-sm"
      style={{ background: C.ink, color: "#fff", boxShadow: "0 12px 32px -12px rgba(0,0,0,0.5)", minWidth: 210 }}
    >
      {children}
    </div>
  );
}

function ComponentTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <TooltipShell>
      <div className="font-semibold">{d.name}</div>
      <div className="mt-2 flex items-baseline justify-between gap-6">
        <span style={{ color: "#AEB6C4" }}>Monto</span>
        <span className="text-base font-bold">{ars(d.value)}</span>
      </div>
      <div className="flex items-baseline justify-between gap-6">
        <span style={{ color: "#AEB6C4" }}>Del costo total</span>
        <span className="font-semibold" style={{ color: C.yellow }}>
          {pct(d.pct)}
        </span>
      </div>
      <div className="mt-2 border-t pt-2 text-xs" style={{ borderColor: "rgba(255,255,255,0.14)", color: "#AEB6C4" }}>
        {d.formula}
      </div>
    </TooltipShell>
  );
}

function ChannelTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const rows = [
    { k: "Costo", v: d.costo, c: C.costo },
    { k: "Ganancia neta", v: d.ganancia, c: C.ganancia },
    { k: "Comisión", v: d.comision, c: C.comision },
  ].filter((x) => x.v > 0);
  return (
    <TooltipShell>
      <div className="flex items-baseline justify-between gap-6">
        <span className="font-semibold">{d.canal}</span>
        <span className="font-bold">{ars(d.precio)}</span>
      </div>
      <div className="mt-2 space-y-1">
        {rows.map((x) => (
          <div key={x.k} className="grid items-center gap-x-3" style={{ gridTemplateColumns: "10px 1fr auto auto" }}>
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: x.c }} />
            <span style={{ color: "#C9CFDA" }}>{x.k}</span>
            <span className="text-right font-semibold">{ars(x.v)}</span>
            <span className="w-12 text-right text-xs" style={{ color: "#AEB6C4" }}>
              {pct((x.v / d.precio) * 100)}
            </span>
          </div>
        ))}
      </div>
    </TooltipShell>
  );
}

function ComponentsChart({ data, maxKey, animate }) {
  const label = (props) => {
    const { x, y, width, height, index } = props;
    const d = data[index];
    return (
      <text x={x + width + 10} y={y + height / 2} dominantBaseline="central" fontSize={12} fill={C.ink}>
        <tspan fontWeight={700}>{ars(d.value)}</tspan>
        <tspan dx={6} fill={C.muted}>
          {pct(d.pct)}
        </tspan>
      </text>
    );
  };
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 46 + 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 112, bottom: 4, left: 4 }} barCategoryGap={12}>
        <defs>
          <pattern id="fdm-layer-ink" width="6" height="3" patternUnits="userSpaceOnUse">
            <rect width="6" height="3" fill={C.ink} />
            <rect y="2" width="6" height="1" fill="#3B475E" />
          </pattern>
          <pattern id="fdm-layer-yellow" width="6" height="3" patternUnits="userSpaceOnUse">
            <rect width="6" height="3" fill={C.yellow} />
            <rect y="2" width="6" height="1" fill={C.yellowDeep} />
          </pattern>
        </defs>
        <CartesianGrid horizontal={false} stroke={C.line} strokeDasharray="2 4" />
        <XAxis type="number" tickFormatter={ars} tick={{ fill: C.faint, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="short" width={116} tick={{ fill: C.ink, fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
        <Tooltip content={<ComponentTooltip />} cursor={{ fill: "rgba(21,28,40,0.05)" }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={animate} animationDuration={300}>
          {data.map((d) => (
            <Cell key={d.key} fill={d.key === maxKey ? "url(#fdm-layer-yellow)" : "url(#fdm-layer-ink)"} />
          ))}
          <LabelList dataKey="value" content={label} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function StackSegment({ x, y, width, height, fill, isTop }) {
  if (!height || height <= 0) return null;
  const rr = isTop ? Math.min(4, height) : 0;
  const d = `M${x},${y + height} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + width - rr},${y} Q${x + width},${y} ${x + width},${y + rr} L${x + width},${y + height} Z`;
  return <path d={d} fill={fill} stroke="#fff" strokeWidth={2} />;
}

function ChannelsChart({ data, animate }) {
  const seg = (key, fill) => (props) => {
    const { x, y, width, height, index } = props;
    const v = data[index][key];
    if (!v || height < 22) return null;
    return (
      <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill={fill}>
        {ars(v)}
      </text>
    );
  };
  const total = (props) => {
    const { x, y, width, index } = props;
    return (
      <text x={x + width / 2} y={y - 10} textAnchor="middle" fontSize={13} fontWeight={800} fill={C.ink}>
        {ars(data[index].precio)}
      </text>
    );
  };
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 28, right: 8, bottom: 4, left: 8 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke={C.line} strokeDasharray="2 4" />
        <XAxis dataKey="canal" tick={{ fill: C.ink, fontSize: 12, fontWeight: 600 }} axisLine={{ stroke: C.line }} tickLine={false} />
        <YAxis tickFormatter={ars} tick={{ fill: C.faint, fontSize: 11 }} axisLine={false} tickLine={false} width={72} />
        <Tooltip content={<ChannelTooltip />} cursor={{ fill: "rgba(21,28,40,0.05)" }} />
        <Bar dataKey="costo" stackId="s" fill={C.costo} isAnimationActive={animate} animationDuration={300} shape={(p) => <StackSegment {...p} isTop={false} />}>
          <LabelList dataKey="costo" content={seg("costo", "#FFFFFF")} />
        </Bar>
        <Bar dataKey="ganancia" stackId="s" fill={C.ganancia} isAnimationActive={animate} animationDuration={300} shape={(p) => <StackSegment {...p} isTop={!p.payload.comision} />}>
          <LabelList dataKey="ganancia" content={seg("ganancia", C.ink)} />
        </Bar>
        <Bar dataKey="comision" stackId="s" fill={C.comision} isAnimationActive={animate} animationDuration={300} shape={(p) => <StackSegment {...p} isTop />}>
          <LabelList dataKey="comision" content={seg("comision", C.ink)} />
          <LabelList dataKey="precio" content={total} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs" style={{ color: C.muted }}>
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/* ================================================================== */
/*  Persistencia (se guarda solo en este navegador)                    */
/* ================================================================== */

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL;
    const parsed = JSON.parse(raw);
    return {
      v: { ...DEFAULTS, ...(parsed.v || {}) },
      ref: parsed.ref || {},
      off: parsed.off || {},
    };
  } catch {
    return INITIAL;
  }
}

/* ================================================================== */
/*  App                                                                */
/* ================================================================== */

export default function SimuladorCostosFDM() {
  const [s, setS] = useState(loadState);
  const [open, setOpen] = useState({});
  const [tab, setTab] = useState("composicion");
  const [showDetail, setShowDetail] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const animate = !prefersReducedMotion();

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      /* sin almacenamiento disponible */
    }
  }, [s]);

  const setV = (k, n) => setS((p) => ({ ...p, v: { ...p.v, [k]: n } }));
  const setRef = (k, on) => setS((p) => ({ ...p, ref: { ...p.ref, [k]: on } }));
  const setOff = (k, off) => setS((p) => ({ ...p, off: { ...p.off, [k]: off } }));
  const toggleOpen = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  // Valores efectivos: si un parámetro usa referencia, se reemplaza.
  const e = useMemo(() => {
    const out = { ...s.v };
    Object.keys(REFS).forEach((k) => {
      if (s.ref[k]) out[k] = REFS[k].value;
    });
    return out;
  }, [s]);

  const r = useMemo(() => calcular(e, s.off), [e, s.off]);
  const ctu = r.ctu;
  const share = (v) => (ctu > 0 ? (v / ctu) * 100 : 0);

  const refKeys = Object.keys(REFS);
  const refsActive = refKeys.filter((k) => s.ref[k]).length;
  const allRefs = refsActive === refKeys.length;
  const countRefs = (keys) => keys.filter((k) => s.ref[k]).length;
  const setAllRefs = (on) => setS((p) => ({ ...p, ref: Object.fromEntries(refKeys.map((k) => [k, on])) }));

  const isPristine =
    Object.keys(DEFAULTS).every((k) => DEFAULTS[k] === s.v[k]) && refsActive === 0 && !Object.values(s.off).some(Boolean);

  const componentes = [
    { key: "material", name: "Material (filamento)", short: "Material", icon: Scale, value: r.costo_material, included: true, formula: `$${num(e.precioKg)}/kg ÷ 1000 × ${num(e.peso)} g` },
    { key: "energia", name: "Energía eléctrica", short: "Energía", icon: Zap, value: r.costo_energia, included: !s.off.energia, formula: `${num(e.potenciaW / 1000)} kW × ${num(e.tiempoImpresion)} h × $${num(e.costoKwh)}/kWh` },
    { key: "maquina", name: "Máquina (amortización y mantenimiento)", short: "Máquina", icon: Cog, value: r.costo_maquina, included: !s.off.maquina, formula: `$${num(e.valorImpresora)} ÷ ${num(e.vidaUtil)} h × ${num(1 + e.mantenimientoPct / 100)} × ${num(e.tiempoImpresion)} h` },
    { key: "fallos", name: "Merma y fallos", short: "Merma", icon: AlertTriangle, value: r.costo_fallos, included: !s.off.fallos, formula: `(material + energía + máquina) × ${num(e.fallaPct)}%` },
    { key: "manoObra", name: "Mano de obra", short: "Mano de obra", icon: Hand, value: r.costo_mano_obra, included: !s.off.manoObra, formula: `${num(e.manoObraMin)} min ÷ 60 × $${num(e.valorHora)}/h` },
    { key: "packaging", name: "Packaging e insumos", short: "Packaging", icon: Package, value: r.insumos_packaging, included: !s.off.packaging, formula: "Monto fijo por unidad" },
  ].map((x) => ({ ...x, pct: share(x.value) }));

  const comp = (k) => componentes.find((x) => x.key === k);
  const incluidos = componentes.filter((x) => x.included && x.value > 0);
  const maxKey = incluidos.length ? incluidos.reduce((a, b) => (b.value > a.value ? b : a)).key : null;
  const excluidos = componentes.filter((x) => !x.included);

  const canales = [
    { canal: "Mayorista", costo: ctu, ganancia: r.ganancia_mayorista, comision: 0, precio: r.precio_mayorista },
    { canal: "Minorista", costo: ctu, ganancia: r.ganancia_minorista, comision: 0, precio: r.precio_minorista },
    { canal: "MercadoLibre", costo: ctu, ganancia: r.ganancia_marketplace, comision: r.comision_marketplace, precio: r.precio_marketplace },
  ];

  const c = e.comisionPct / 100;
  const precioErroneo = r.precio_minorista * (1 + c);
  const perdida = r.precio_minorista - precioErroneo * (1 - c);

  const pp = { s, setV, setRef };
  const item = (k, refKeysForItem) => ({
    amount: comp(k).value,
    share: comp(k).pct,
    included: comp(k).included,
    onToggle: (on) => setOff(k, !on),
    open: !!open[k],
    onOpen: () => toggleOpen(k),
    refsInUse: countRefs(refKeysForItem),
  });

  return (
    <div className="fdm-root min-h-screen w-full pb-24 lg:pb-0" style={{ background: C.bg }}>
      <GlobalStyles />

      {/* ============================ Header ============================ */}
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur" style={{ borderColor: C.line }}>
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="fdm-layers flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: C.ink, color: C.yellow }}>
              <Layers size={18} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <h1 className="fdm-wide truncate text-lg font-extrabold leading-tight">Costeo de impresión 3D</h1>
              <p className="hidden truncate text-xs sm:block" style={{ color: C.muted }}>
                Costo real por pieza FDM y precio por canal. Montos en pesos argentinos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setS(INITIAL)}
            disabled={isPristine}
            className="fdm-focus inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors disabled:cursor-default disabled:opacity-40"
            style={{ borderColor: C.lineStrong, color: C.ink, background: C.panel }}
          >
            <RotateCcw size={15} />
            <span className="hidden sm:inline">Restaurar valores</span>
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        {/* ========================= Configuración ========================= */}
        <aside
          className="fdm-scroll rounded-xl border bg-white lg:sticky lg:top-[88px] lg:max-h-[calc(100vh-112px)] lg:overflow-y-auto"
          style={{ borderColor: C.line }}
          aria-label="Configuración"
        >
          <section className="px-5 pb-2 pt-5">
            <h2 className="text-[15px] font-bold">La pieza</h2>
            <p className="mt-0.5 text-xs" style={{ color: C.muted }}>
              Los datos que te da el slicer para esta impresión.
            </p>
            <div className="mt-1 divide-y divide-slate-200">
              <SliderRow id="peso" icon={Scale} label="Peso, con soportes y purga" value={s.v.peso} onChange={(n) => setV("peso", n)} min={10} max={1000} step={5} unit="g" />
              <SliderRow id="tiempo" icon={Timer} label="Tiempo de impresión" value={s.v.tiempoImpresion} onChange={(n) => setV("tiempoImpresion", n)} min={0.5} max={48} step={0.5} unit="h" />
              <SliderRow id="manoObraMin" icon={Clock} label="Tu tiempo de trabajo" value={s.v.manoObraMin} onChange={(n) => setV("manoObraMin", n)} min={5} max={120} step={5} unit="min" />
            </div>
          </section>

          <section className="border-t px-5 pb-2 pt-5" style={{ borderColor: C.line }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold">Costos del taller</h2>
                <p className="mt-0.5 text-xs" style={{ color: C.muted }}>
                  Abrí cada uno para cargar tus valores.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAllRefs(!allRefs)}
                className="fdm-focus inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold"
                style={{ borderColor: allRefs ? C.yellowDeep : C.lineStrong, background: allRefs ? C.yellowWash : C.panel, color: C.ink }}
              >
                <Wand2 size={13} />
                {allRefs ? "Volver a mis valores" : "No sé ninguno"}
              </button>
            </div>
            <p className="mb-3 mt-2 text-xs leading-relaxed" style={{ color: C.muted }}>
              Si no sabés un valor, marcá “No lo conozco” y se usa una referencia. Con el interruptor sacás ese costo del cálculo.
            </p>

            <CostItem icon={Scale} title="Material" canExclude={false} {...item("material", ["precioKg"])}>
              <Param k="precioKg" label="Precio del filamento" prefix="$" suffix="/kg" {...pp} />
            </CostItem>
            <CostItem icon={Zap} title="Energía" canExclude {...item("energia", ["costoKwh", "potenciaW"])}>
              <Param k="costoKwh" label="Precio de la luz" prefix="$" suffix="/kWh" {...pp} />
              <Param k="potenciaW" label="Consumo de la impresora" suffix="W" {...pp} />
            </CostItem>
            <CostItem icon={Cog} title="Máquina" canExclude {...item("maquina", ["valorImpresora", "vidaUtil", "mantenimientoPct"])}>
              <Param k="valorImpresora" label="Valor de la impresora" prefix="$" {...pp} />
              <Param k="vidaUtil" label="Vida útil" suffix="h" min={1} {...pp} />
              <Param k="mantenimientoPct" label="Mantenimiento" suffix="%" {...pp} />
            </CostItem>
            <CostItem icon={AlertTriangle} title="Merma y fallos" canExclude {...item("fallos", ["fallaPct"])}>
              <Param k="fallaPct" label="Tasa de fallo" suffix="%" max={100} {...pp} />
              <p className="py-3 text-xs" style={{ color: C.muted }}>
                Se aplica sobre material, energía y máquina. No sobre tu trabajo ni el packaging.
              </p>
            </CostItem>
            <CostItem icon={Hand} title="Mano de obra" canExclude {...item("manoObra", ["valorHora"])}>
              <Param k="valorHora" label="Valor de tu hora" prefix="$" suffix="/h" {...pp} />
            </CostItem>
            <CostItem icon={Package} title="Packaging e insumos" canExclude {...item("packaging", ["packaging"])}>
              <Param k="packaging" label="Costo por unidad" prefix="$" {...pp} />
            </CostItem>
          </section>

          <section className="border-t px-5 pb-3 pt-5" style={{ borderColor: C.line }}>
            <h2 className="text-[15px] font-bold">Precios de venta</h2>
            <p className="mt-0.5 text-xs" style={{ color: C.muted }}>
              Cuántas veces el costo cobrás en cada canal.
            </p>
            <div className="divide-y divide-slate-200">
              <div className="flex items-center justify-between gap-3 py-3">
                <label htmlFor="p-markupMay" className="text-sm" style={{ color: C.inkSoft }}>
                  Multiplicador mayorista
                </label>
                <NumberInput id="p-markupMay" value={s.v.markupMay} onChange={(n) => setV("markupMay", n)} min={1} max={20} suffix="×" className="w-28 shrink-0" />
              </div>
              <div className="flex items-center justify-between gap-3 py-3">
                <label htmlFor="p-markupMin" className="text-sm" style={{ color: C.inkSoft }}>
                  Multiplicador minorista
                </label>
                <NumberInput id="p-markupMin" value={s.v.markupMin} onChange={(n) => setV("markupMin", n)} min={1} max={20} suffix="×" className="w-28 shrink-0" />
              </div>
              <Param k="comisionPct" label="Comisión de MercadoLibre" suffix="%" max={95} {...pp} />
            </div>
          </section>
        </aside>

        {/* =========================== Resultados =========================== */}
        <main className="flex min-w-0 flex-col gap-6" aria-label="Resultados">
          <section className="fdm-layers flex flex-col gap-5 rounded-xl p-6 text-white sm:flex-row sm:items-end sm:justify-between" style={{ background: C.ink }}>
            <div>
              <h2 className="text-sm font-medium" style={{ color: "#C9CFDA" }}>
                Costo por unidad
              </h2>
              <div className="fdm-wide mt-2 text-5xl font-extrabold leading-none" style={{ color: C.yellow }}>
                {ars(ctu)}
              </div>
              <p className="mt-3 text-sm" style={{ color: "#AEB6C4" }}>
                {ars2(r.costo_por_gramo)} por gramo, para {num(e.peso)} g y {num(e.tiempoImpresion)} h de impresión
              </p>
            </div>
            <div className="flex flex-col gap-1.5 text-xs sm:items-end sm:text-right" style={{ color: "#AEB6C4" }}>
              {refsActive > 0 && (
                <span className="inline-flex items-center gap-1.5 self-start rounded-md px-2 py-1 sm:self-end" style={{ background: "rgba(245,196,0,0.14)", color: C.yellow }}>
                  <Info size={13} />
                  {refsActive === 1 ? "1 valor es de referencia" : `${refsActive} valores son de referencia`}
                </span>
              )}
              {excluidos.length > 0 && <span>Sin incluir: {excluidos.map((x) => x.short.toLowerCase()).join(", ")}</span>}
            </div>
          </section>

          <section className="rounded-xl border bg-white" style={{ borderColor: C.line }}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: C.line }}>
              <h2 className="text-[15px] font-bold">Precio de venta sugerido</h2>
              <Legend
                items={[
                  { label: "Costo", color: C.costo },
                  { label: "Ganancia", color: C.ganancia },
                  { label: "Comisión", color: C.comision },
                ]}
              />
            </div>
            <div className="grid grid-cols-1 divide-y divide-slate-200 md:grid-cols-3 md:divide-x md:divide-y-0">
              <Channel
                icon={Truck}
                name="Mayorista"
                factor={`×${num(e.markupMay)}`}
                price={ars(r.precio_mayorista)}
                rows={[
                  { label: "Ganancia neta", value: ars(r.ganancia_mayorista), strong: true },
                  { label: "Margen", value: pct(r.margen_mayorista) },
                ]}
                split={<SplitBar price={r.precio_mayorista} parts={[{ label: "costo", v: ctu, color: C.costo }, { label: "ganancia", v: r.ganancia_mayorista, color: C.ganancia }]} />}
              />
              <Channel
                icon={Store}
                name="Minorista directo"
                factor={`×${num(e.markupMin)}`}
                price={ars(r.precio_minorista)}
                rows={[
                  { label: "Ganancia neta", value: ars(r.ganancia_minorista), strong: true },
                  { label: "Margen", value: pct(r.margen_minorista) },
                ]}
                split={<SplitBar price={r.precio_minorista} parts={[{ label: "costo", v: ctu, color: C.costo }, { label: "ganancia", v: r.ganancia_minorista, color: C.ganancia }]} />}
              />
              <Channel
                icon={ShoppingBag}
                name="MercadoLibre"
                factor={`÷${num(1 - c)}`}
                price={ars(r.precio_marketplace)}
                rows={[
                  { label: `Comisión (${num(e.comisionPct)}%)`, value: ars(r.comision_marketplace) },
                  { label: "Ganancia neta", value: ars(r.ganancia_marketplace), strong: true },
                ]}
                split={
                  <SplitBar
                    price={r.precio_marketplace}
                    parts={[
                      { label: "costo", v: ctu, color: C.costo },
                      { label: "ganancia", v: r.ganancia_marketplace, color: C.ganancia },
                      { label: "comisión", v: r.comision_marketplace, color: C.comision },
                    ]}
                  />
                }
              />
            </div>
            <div className="flex gap-2.5 border-t px-5 py-3.5 text-xs leading-relaxed" style={{ borderColor: C.line, background: C.wash, color: C.muted }}>
              <Info size={14} className="mt-0.5 shrink-0" style={{ color: C.inkSoft }} />
              <p>
                El precio de MercadoLibre se divide por (1 − comisión) para que te quede la misma ganancia que en venta directa.{" "}
                <button
                  type="button"
                  onClick={() => setShowWhy((v) => !v)}
                  aria-expanded={showWhy}
                  className="fdm-focus font-semibold underline underline-offset-2"
                  style={{ color: C.ink }}
                >
                  {showWhy ? "Ocultar ejemplo" : "Ver ejemplo"}
                </button>
                {showWhy && (
                  <span className="mt-1 block">
                    Si multiplicaras por (1 + comisión) publicarías a {ars(precioErroneo)}, pero la comisión se cobra sobre ese precio final y perderías{" "}
                    <strong style={{ color: C.ink }}>{ars(perdida)}</strong> por venta.
                  </span>
                )}
              </p>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-5" style={{ borderColor: C.line }}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-[15px] font-bold">Análisis</h2>
              <div role="tablist" aria-label="Gráficos" className="inline-flex max-w-full self-start overflow-x-auto rounded-lg p-1" style={{ background: C.wash }}>
                {[
                  { id: "composicion", label: "Composición del costo" },
                  { id: "canales", label: "Rentabilidad por canal" },
                ].map((t) => {
                  const on = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      role="tab"
                      type="button"
                      aria-selected={on}
                      onClick={() => setTab(t.id)}
                      className="fdm-focus whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors"
                      style={{ background: on ? C.panel : "transparent", color: on ? C.ink : C.muted, boxShadow: on ? "0 1px 2px rgba(21,28,40,0.14)" : "none" }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="mt-2 text-sm" style={{ color: C.muted }}>
              {tab === "composicion"
                ? "Qué parte del costo aporta cada componente. En amarillo, el que más pesa."
                : "El mismo costo en los tres canales. En MercadoLibre el precio absorbe la comisión."}
            </p>
            <div className="mt-4" role="tabpanel">
              {tab === "composicion" ? <ComponentsChart data={incluidos} maxKey={maxKey} animate={animate} /> : <ChannelsChart data={canales} animate={animate} />}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: C.line }}>
            <button
              type="button"
              onClick={() => setShowDetail((v) => !v)}
              aria-expanded={showDetail}
              className="fdm-focus flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
            >
              <span>
                <span className="block text-[15px] font-bold">Detalle del cálculo</span>
                <span className="block text-xs" style={{ color: C.muted }}>
                  La fórmula de cada componente con los valores que estás usando.
                </span>
              </span>
              <ChevronDown size={18} className="shrink-0 transition-transform" style={{ transform: showDetail ? "rotate(180deg)" : "none", color: C.muted }} />
            </button>
            {showDetail && (
              <div className="overflow-x-auto border-t" style={{ borderColor: C.line }}>
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-xs" style={{ color: C.faint, background: C.wash }}>
                      <th className="px-5 py-2.5 font-medium">Componente</th>
                      <th className="px-3 py-2.5 font-medium">Fórmula</th>
                      <th className="px-3 py-2.5 text-right font-medium">Monto</th>
                      <th className="px-5 py-2.5 text-right font-medium">Del total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {componentes.map((x) => {
                      const Icon = x.icon;
                      return (
                        <tr key={x.key} className="border-t" style={{ borderColor: C.line, color: x.included ? C.ink : C.faint }}>
                          <td className="px-5 py-3">
                            <span className="flex items-center gap-2.5 font-semibold">
                              <Icon size={15} style={{ color: C.muted }} />
                              {x.name}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-xs" style={{ color: C.muted }}>
                            {x.included ? x.formula : "Fuera del cálculo"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right font-semibold">{x.included ? ars(x.value) : "—"}</td>
                          <td className="px-5 py-3 text-right">{x.included ? pct(x.pct) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2" style={{ borderColor: C.ink }}>
                      <td className="px-5 py-3.5 font-bold" colSpan={2}>
                        Costo por unidad
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-right text-base font-extrabold">{ars(ctu)}</td>
                      <td className="px-5 py-3.5 text-right font-bold">{pct(100)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Resumen fijo en mobile */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-4 border-t bg-white/95 px-5 py-3 backdrop-blur lg:hidden" style={{ borderColor: C.line }}>
        <div>
          <div className="text-[11px]" style={{ color: C.muted }}>
            Costo por unidad
          </div>
          <div className="fdm-wide text-lg font-extrabold leading-tight">{ars(ctu)}</div>
        </div>
        <div className="text-right">
          <div className="text-[11px]" style={{ color: C.muted }}>
            Precio minorista
          </div>
          <div className="fdm-wide text-lg font-extrabold leading-tight">{ars(r.precio_minorista)}</div>
        </div>
      </div>
    </div>
  );
}
