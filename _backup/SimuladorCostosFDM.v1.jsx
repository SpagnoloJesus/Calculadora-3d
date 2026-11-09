import React, { useMemo, useState } from "react";
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
  Info,
  Scale,
  Timer,
  Clock,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Tokens de diseño                                                   */
/* ------------------------------------------------------------------ */

const C = {
  bg: "#E8EBEF", // gris acero frío
  panel: "#FFFFFF",
  ink: "#18202E", // grafito azulado (texto y superficies oscuras)
  inkSoft: "#2B3549",
  muted: "#5D6778",
  faint: "#8A93A3",
  line: "#D8DDE4",
  wash: "#F3F5F8",
  yellow: "#F5C400", // amarillo PLA: el único acento
  yellowDeep: "#D6A900",
  // Serie categórica validada (CVD-safe) para el gráfico de canales
  costo: "#2A78D6",
  ganancia: "#1BAF7A",
  comision: "#EB6834",
};

const SHADOW =
  "0 1px 2px rgba(24,32,46,0.06), 0 10px 28px -16px rgba(24,32,46,0.28)";

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
};

/* ------------------------------------------------------------------ */
/*  Formato (es-AR)                                                    */
/* ------------------------------------------------------------------ */

const nf0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const nf2 = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const nfN = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

const ars = (v) => (Number.isFinite(v) ? `$${nf0.format(Math.round(v))}` : "—");
const ars2 = (v) => (Number.isFinite(v) ? `$${nf2.format(v)}` : "—");
const pct = (v) => (Number.isFinite(v) ? `${nf1.format(v)}%` : "—");
const num = (v) => (Number.isFinite(v) ? nfN.format(v) : "—");

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------ */
/*  Lógica de costeo (fórmulas exactas del pliego)                     */
/* ------------------------------------------------------------------ */

function calcular(p) {
  const costo_material = (p.precioKg / 1000) * p.peso;
  const costo_energia = (p.potenciaW / 1000) * p.tiempoImpresion * p.costoKwh;
  const costo_maquina =
    (p.valorImpresora / p.vidaUtil) *
    (1 + p.mantenimientoPct / 100) *
    p.tiempoImpresion;
  const costo_fallos =
    (costo_material + costo_energia + costo_maquina) * (p.fallaPct / 100);
  const costo_mano_obra = (p.manoObraMin / 60) * p.valorHora;
  const insumos_packaging = p.packaging;

  const costo_total_unitario =
    costo_material +
    costo_energia +
    costo_maquina +
    costo_fallos +
    costo_mano_obra +
    insumos_packaging;

  const precio_mayorista = costo_total_unitario * 2;
  const precio_minorista = costo_total_unitario * 3;
  const precio_marketplace = precio_minorista / (1 - p.comisionPct / 100);
  const comision_marketplace = precio_marketplace * (p.comisionPct / 100);
  const ganancia_marketplace =
    precio_marketplace - comision_marketplace - costo_total_unitario;

  return {
    costo_material,
    costo_energia,
    costo_maquina,
    costo_fallos,
    costo_mano_obra,
    insumos_packaging,
    costo_total_unitario,
    costo_por_gramo: costo_total_unitario / p.peso,
    precio_mayorista,
    ganancia_mayorista: precio_mayorista - costo_total_unitario,
    margen_mayorista:
      ((precio_mayorista - costo_total_unitario) / precio_mayorista) * 100,
    precio_minorista,
    ganancia_minorista: precio_minorista - costo_total_unitario,
    margen_minorista:
      ((precio_minorista - costo_total_unitario) / precio_minorista) * 100,
    precio_marketplace,
    comision_marketplace,
    ganancia_marketplace,
    margen_marketplace: (ganancia_marketplace / precio_marketplace) * 100,
  };
}

/* ------------------------------------------------------------------ */
/*  Estilos globales del componente                                    */
/* ------------------------------------------------------------------ */

const GlobalStyles = () => (
  <style>{`
@import url('https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..800&display=swap');

.fdm-root { font-family: 'Archivo', ui-sans-serif, system-ui, sans-serif; font-variant-numeric: tabular-nums; color: ${C.ink}; -webkit-font-smoothing: antialiased; }
.fdm-wide { font-stretch: 125%; letter-spacing: -0.01em; }
.fdm-semi { font-stretch: 112%; }
.fdm-narrow { font-stretch: 85%; }

/* Líneas de capa: el motivo del sistema, como una pieza recién impresa */
.fdm-layers {
  background-image: repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 4px);
}

/* Slider */
.fdm-range { -webkit-appearance: none; appearance: none; width: 100%; height: 22px; background: transparent; cursor: pointer; }
.fdm-range:focus { outline: none; }
.fdm-range::-webkit-slider-runnable-track {
  height: 6px; border-radius: 999px;
  background: linear-gradient(to right, ${C.ink} 0 var(--fill), ${C.line} var(--fill) 100%);
}
.fdm-range::-moz-range-track { height: 6px; border-radius: 999px; background: ${C.line}; }
.fdm-range::-moz-range-progress { height: 6px; border-radius: 999px; background: ${C.ink}; }
.fdm-range::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none; width: 20px; height: 20px; margin-top: -7px;
  border-radius: 999px; background: ${C.yellow}; border: 3px solid ${C.ink};
  transition: transform 120ms ease;
}
.fdm-range::-moz-range-thumb {
  width: 14px; height: 14px; border-radius: 999px; background: ${C.yellow}; border: 3px solid ${C.ink};
}
.fdm-range:active::-webkit-slider-thumb { transform: scale(1.12); }
.fdm-range:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 4px rgba(245,196,0,0.45); }
.fdm-range:focus-visible::-moz-range-thumb { box-shadow: 0 0 0 4px rgba(245,196,0,0.45); }

.fdm-focus:focus-visible { outline: 2px solid ${C.ink}; outline-offset: 2px; }
.fdm-field:focus-within { border-color: ${C.ink}; box-shadow: 0 0 0 3px rgba(245,196,0,0.35); }

@media (prefers-reduced-motion: reduce) {
  .fdm-root *, .fdm-root *::before, .fdm-root *::after { transition: none !important; animation: none !important; }
}
`}</style>
);

/* ------------------------------------------------------------------ */
/*  Inputs                                                             */
/* ------------------------------------------------------------------ */

/** Interpreta números escritos a la argentina (20.000 / 4,5) o con punto decimal (4.5). */
function parseNum(raw) {
  const s = String(raw).trim().replace(/\s|\$/g, "");
  if (!s) return NaN;
  if (s.includes(",")) return parseFloat(s.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return parseFloat(s.replace(/\./g, ""));
  return parseFloat(s);
}

/** Input numérico: se escribe libremente y se confirma (con límites) al salir o con Enter. */
function NumberInput({ id, value, onChange, min = 0, max = Infinity, prefix, suffix, ariaLabel, className = "" }) {
  const [draft, setDraft] = useState(null);
  const shown = draft !== null ? draft : num(value);

  return (
    <div
      className={`fdm-field flex items-center rounded-lg border bg-white transition-colors ${className}`}
      style={{ borderColor: C.line }}
    >
      {prefix && (
        <span className="pl-3 text-sm" style={{ color: C.faint }}>
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
        className="w-full min-w-0 bg-transparent px-3 py-2 text-right text-sm font-semibold outline-none"
        style={{ color: C.ink }}
      />
      {suffix && (
        <span className="whitespace-nowrap pr-3 text-xs" style={{ color: C.faint }}>
          {suffix}
        </span>
      )}
    </div>
  );
}

function SliderField({ id, icon: Icon, label, hint, value, onChange, min, max, step, unit, minLabel, maxLabel }) {
  const fill = `${((clamp(value, min, max) - min) / (max - min)) * 100}%`;
  return (
    <div className="py-5 first:pt-1">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: C.wash, color: C.ink }}
          >
            <Icon size={16} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <label htmlFor={id} className="block text-sm font-semibold leading-tight">
              {label}
            </label>
            {hint && (
              <p className="mt-0.5 text-xs leading-snug" style={{ color: C.muted }}>
                {hint}
              </p>
            )}
          </div>
        </div>
        <NumberInput
          id={id}
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          suffix={unit}
          className="w-32 shrink-0"
        />
      </div>
      <input
        type="range"
        aria-label={label}
        className="fdm-range mt-4"
        min={min}
        max={max}
        step={step}
        value={clamp(value, min, max)}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ "--fill": fill }}
      />
      <div className="mt-1 flex justify-between text-xs" style={{ color: C.faint }}>
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

function AdvField({ id, label, value, onChange, prefix, suffix, min = 0, max = Infinity }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium" style={{ color: C.muted }}>
        {label}
      </label>
      <NumberInput id={id} value={value} onChange={onChange} prefix={prefix} suffix={suffix} min={min} max={max} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tarjetas KPI                                                       */
/* ------------------------------------------------------------------ */

function StatRow({ label, value, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <span style={{ color: C.muted }}>{label}</span>
      <span className={strong ? "font-semibold" : "font-medium"} style={{ color: C.ink }}>
        {value}
      </span>
    </div>
  );
}

/** Barra "de cada $100 cobrados": cómo se reparte el precio del canal. */
function PriceSplit({ price, parts }) {
  const visibles = parts.filter((x) => x.v > 0);
  return (
    <div className="mt-auto pt-4">
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        {visibles.map((x) => (
          <span key={x.label} style={{ width: `${(x.v / price) * 100}%`, background: x.color }} />
        ))}
      </div>
      <p className="mt-2 text-xs leading-snug" style={{ color: C.muted }}>
        De cada $100 cobrados:{" "}
        {visibles.map((x, i) => (
          <span key={x.label}>
            {i > 0 && (i === visibles.length - 1 ? " y " : ", ")}
            <span className="font-semibold" style={{ color: C.ink }}>
              ${nf0.format(Math.round((x.v / price) * 100))}
            </span>{" "}
            {x.label}
          </span>
        ))}
        .
      </p>
    </div>
  );
}

function ChannelCard({ icon: Icon, title, factor, price, children, footer }) {
  return (
    <div
      className="flex flex-col rounded-xl border bg-white"
      style={{ borderColor: C.line, boxShadow: SHADOW }}
    >
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: C.inkSoft }}>
            <Icon size={16} strokeWidth={2} />
            {title}
          </div>
          <span
            className="fdm-wide rounded-md px-2 py-0.5 text-xs font-bold"
            style={{ background: C.wash, color: C.inkSoft }}
            title="Factor aplicado sobre el costo"
          >
            {factor}
          </span>
        </div>
        <div className="fdm-wide mt-4 text-3xl font-extrabold leading-none" style={{ color: C.ink }}>
          {price}
        </div>
        <div className="mt-4 flex flex-1 flex-col border-t pt-2" style={{ borderColor: C.line }}>
          {children}
        </div>
      </div>
      {footer}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tooltips de Recharts                                               */
/* ------------------------------------------------------------------ */

function TooltipShell({ children }) {
  return (
    <div
      className="fdm-root rounded-lg px-3.5 py-3 text-sm"
      style={{ background: C.ink, color: "#fff", boxShadow: "0 12px 32px -12px rgba(0,0,0,0.5)", minWidth: 200 }}
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
        <span className="fdm-semi text-base font-bold">{ars(d.value)}</span>
      </div>
      <div className="flex items-baseline justify-between gap-6">
        <span style={{ color: "#AEB6C4" }}>Peso en el costo</span>
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
    { k: "Costo total unitario", v: d.costo, c: C.costo },
    { k: "Ganancia neta", v: d.ganancia, c: C.ganancia },
    { k: "Comisión plataforma", v: d.comision, c: C.comision },
  ];
  return (
    <TooltipShell>
      <div className="flex items-baseline justify-between gap-6">
        <span className="font-semibold">{d.canal}</span>
        <span className="fdm-semi font-bold">{ars(d.precio)}</span>
      </div>
      <div className="mt-2 space-y-1">
        {rows.map((r) => (
          <div key={r.k} className="grid items-center gap-x-3" style={{ gridTemplateColumns: "10px 1fr auto auto" }}>
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.c }} />
            <span style={{ color: "#C9CFDA" }}>{r.k}</span>
            <span className="text-right font-semibold">{ars(r.v)}</span>
            <span className="w-12 text-right text-xs" style={{ color: "#AEB6C4" }}>
              {pct(d.precio ? (r.v / d.precio) * 100 : 0)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 border-t pt-2 text-xs" style={{ borderColor: "rgba(255,255,255,0.14)", color: "#AEB6C4" }}>
        Porcentajes sobre el precio de venta del canal.
      </div>
    </TooltipShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Gráficos                                                           */
/* ------------------------------------------------------------------ */

function ComponentsChart({ data, maxKey, animate }) {
  const renderLabel = (props) => {
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
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 116, bottom: 4, left: 0 }} barCategoryGap={10}>
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
        <XAxis
          type="number"
          tickFormatter={(v) => ars(v)}
          tick={{ fill: C.faint, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="short"
          width={112}
          tick={{ fill: C.ink, fontSize: 12, fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<ComponentTooltip />} cursor={{ fill: "rgba(24,32,46,0.05)" }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={animate} animationDuration={350}>
          {data.map((d) => (
            <Cell key={d.key} fill={d.key === maxKey ? "url(#fdm-layer-yellow)" : "url(#fdm-layer-ink)"} />
          ))}
          <LabelList dataKey="value" content={renderLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function StackSegment({ x, y, width, height, fill, isTop }) {
  if (!height || height <= 0) return null;
  const r = isTop ? Math.min(4, height) : 0;
  const path = `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
  return <path d={path} fill={fill} stroke="#fff" strokeWidth={2} />;
}

function ChannelsChart({ data, animate }) {
  const segLabel = (key, textFill) => (props) => {
    const { x, y, width, height, index } = props;
    const v = data[index][key];
    if (!v || height < 22) return null;
    return (
      <text
        x={x + width / 2}
        y={y + height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={700}
        fill={textFill}
      >
        {ars(v)}
      </text>
    );
  };

  const totalLabel = (props) => {
    const { x, y, width, index } = props;
    const d = data[index];
    return (
      <text x={x + width / 2} y={y - 10} textAnchor="middle" fontSize={13} fontWeight={800} fill={C.ink} className="fdm-semi">
        {ars(d.precio)}
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 28, right: 8, bottom: 4, left: 8 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke={C.line} strokeDasharray="2 4" />
        <XAxis dataKey="canal" tick={{ fill: C.ink, fontSize: 12, fontWeight: 600 }} axisLine={{ stroke: C.line }} tickLine={false} />
        <YAxis tickFormatter={(v) => ars(v)} tick={{ fill: C.faint, fontSize: 11 }} axisLine={false} tickLine={false} width={72} />
        <Tooltip content={<ChannelTooltip />} cursor={{ fill: "rgba(24,32,46,0.05)" }} />
        <Bar
          dataKey="costo"
          stackId="s"
          fill={C.costo}
          isAnimationActive={animate}
          animationDuration={350}
          shape={(p) => <StackSegment {...p} isTop={false} />}
        >
          <LabelList dataKey="costo" content={segLabel("costo", "#FFFFFF")} />
        </Bar>
        <Bar
          dataKey="ganancia"
          stackId="s"
          fill={C.ganancia}
          isAnimationActive={animate}
          animationDuration={350}
          shape={(p) => <StackSegment {...p} isTop={!p.payload.comision} />}
        >
          <LabelList dataKey="ganancia" content={segLabel("ganancia", C.ink)} />
        </Bar>
        <Bar
          dataKey="comision"
          stackId="s"
          fill={C.comision}
          isAnimationActive={animate}
          animationDuration={350}
          shape={(p) => <StackSegment {...p} isTop />}
        >
          <LabelList dataKey="comision" content={segLabel("comision", C.ink)} />
          <LabelList dataKey="precio" content={totalLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs" style={{ color: C.muted }}>
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Componente principal                                               */
/* ------------------------------------------------------------------ */

export default function SimuladorCostosFDM() {
  const [p, setP] = useState(DEFAULTS);
  const [advOpen, setAdvOpen] = useState(true);
  const [tab, setTab] = useState("composicion");
  const animate = !prefersReducedMotion();

  const set = (key) => (v) => setP((prev) => ({ ...prev, [key]: v }));
  const isDefault = Object.keys(DEFAULTS).every((k) => DEFAULTS[k] === p[k]);

  const r = useMemo(() => calcular(p), [p]);
  const ctu = r.costo_total_unitario;

  const componentes = useMemo(() => {
    const base = [
      {
        key: "material",
        name: "Material (filamento)",
        short: "Material",
        icon: Scale,
        value: r.costo_material,
        formula: `$${num(p.precioKg)}/kg ÷ 1000 × ${num(p.peso)} g`,
      },
      {
        key: "energia",
        name: "Energía eléctrica",
        short: "Energía",
        icon: Zap,
        value: r.costo_energia,
        formula: `${num(p.potenciaW / 1000)} kW × ${num(p.tiempoImpresion)} h × $${num(p.costoKwh)}/kWh`,
      },
      {
        key: "maquina",
        name: "Máquina (amortización + mantenimiento)",
        short: "Máquina",
        icon: Cog,
        value: r.costo_maquina,
        formula: `$${num(p.valorImpresora)} ÷ ${num(p.vidaUtil)} h × ${num(1 + p.mantenimientoPct / 100)} × ${num(p.tiempoImpresion)} h`,
      },
      {
        key: "fallos",
        name: "Merma y fallos",
        short: "Merma",
        icon: AlertTriangle,
        value: r.costo_fallos,
        formula: `(${ars(r.costo_material)} + ${ars(r.costo_energia)} + ${ars(r.costo_maquina)}) × ${num(p.fallaPct)}%`,
      },
      {
        key: "manoObra",
        name: "Mano de obra operativa",
        short: "Mano de obra",
        icon: Hand,
        value: r.costo_mano_obra,
        formula: `${num(p.manoObraMin)} min ÷ 60 × $${num(p.valorHora)}/h`,
      },
      {
        key: "packaging",
        name: "Packaging e insumos",
        short: "Packaging",
        icon: Package,
        value: r.insumos_packaging,
        formula: "Monto fijo por unidad",
      },
    ];
    return base.map((c) => ({ ...c, pct: ctu > 0 ? (c.value / ctu) * 100 : 0 }));
  }, [r, p, ctu]);

  const maxKey = componentes.reduce((a, b) => (b.value > a.value ? b : a), componentes[0]).key;
  const maxComp = componentes.find((c) => c.key === maxKey);

  const canales = [
    { canal: "Mayorista", costo: ctu, ganancia: r.ganancia_mayorista, comision: 0, precio: r.precio_mayorista },
    { canal: "Minorista", costo: ctu, ganancia: r.ganancia_minorista, comision: 0, precio: r.precio_minorista },
    {
      canal: "Marketplace",
      costo: ctu,
      ganancia: r.ganancia_marketplace,
      comision: r.comision_marketplace,
      precio: r.precio_marketplace,
    },
  ];

  // Ejemplo concreto del error de multiplicar por (1 + comisión)
  const c = p.comisionPct / 100;
  const precioErroneo = r.precio_minorista * (1 + c);
  const netoErroneo = precioErroneo * (1 - c);
  const perdida = r.precio_minorista - netoErroneo;

  return (
    <div className="fdm-root min-h-screen w-full" style={{ background: C.bg }}>
      <GlobalStyles />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ---------------- Header ---------------- */}
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className="fdm-layers flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
              style={{ background: C.ink, color: C.yellow }}
            >
              <Layers size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="fdm-wide text-2xl font-extrabold leading-tight sm:text-3xl">Costeo de impresión 3D</h1>
              <p className="mt-1 text-sm" style={{ color: C.muted }}>
                Costo real por pieza FDM y precio sugerido para cada canal de venta. Montos en pesos argentinos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setP(DEFAULTS)}
            disabled={isDefault}
            className="fdm-focus inline-flex items-center gap-2 self-start rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-default disabled:opacity-50 sm:self-auto"
            style={{ borderColor: C.ink, color: C.ink, background: isDefault ? "transparent" : C.panel }}
          >
            <RotateCcw size={15} strokeWidth={2.2} />
            Restaurar valores por defecto
          </button>
        </header>

        {/* ---------------- KPIs ---------------- */}
        <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resultados">
          {/* CTU: la tarjeta ancla */}
          <div
            className="fdm-layers relative flex flex-col overflow-hidden rounded-xl p-5 text-white"
            style={{ background: C.ink, boxShadow: SHADOW }}
          >
            <div className="text-sm font-semibold" style={{ color: "#C9CFDA" }}>
              Costo total unitario
            </div>
            <div className="fdm-wide mt-4 text-4xl font-extrabold leading-none" style={{ color: C.yellow }}>
              {ars(ctu)}
            </div>
            <div className="mt-2 text-sm" style={{ color: "#AEB6C4" }}>
              {ars2(r.costo_por_gramo)} por gramo de pieza terminada
            </div>
            <div className="mt-auto pt-5">
              {/* Barra de composición: las 6 capas del costo */}
              <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                {componentes.map((comp) => (
                  <span
                    key={comp.key}
                    style={{
                      width: `${comp.pct}%`,
                      background: comp.key === maxKey ? C.yellow : "rgba(255,255,255,0.32)",
                    }}
                  />
                ))}
              </div>
              <div className="mt-2 text-xs" style={{ color: "#AEB6C4" }}>
                Lo que más pesa: <span className="font-semibold text-white">{maxComp.short.toLowerCase()}</span>{" "}
                ({pct(maxComp.pct)})
              </div>
            </div>
          </div>

          <ChannelCard icon={Truck} title="Precio mayorista" factor="×2" price={ars(r.precio_mayorista)}>
            <StatRow label="Ganancia neta" value={ars(r.ganancia_mayorista)} strong />
            <StatRow label="Margen bruto" value={pct(r.margen_mayorista)} />
            <PriceSplit
              price={r.precio_mayorista}
              parts={[
                { label: "costo", v: ctu, color: C.costo },
                { label: "ganancia", v: r.ganancia_mayorista, color: C.ganancia },
              ]}
            />
          </ChannelCard>

          <ChannelCard icon={Store} title="Precio minorista directo" factor="×3" price={ars(r.precio_minorista)}>
            <StatRow label="Ganancia neta" value={ars(r.ganancia_minorista)} strong />
            <StatRow label="Margen bruto" value={pct(r.margen_minorista)} />
            <PriceSplit
              price={r.precio_minorista}
              parts={[
                { label: "costo", v: ctu, color: C.costo },
                { label: "ganancia", v: r.ganancia_minorista, color: C.ganancia },
              ]}
            />
          </ChannelCard>

          <ChannelCard
            icon={ShoppingBag}
            title="Marketplace / ML"
            factor={`÷${num(1 - c)}`}
            price={ars(r.precio_marketplace)}
            footer={
              <div
                className="flex gap-2.5 rounded-b-xl border-t px-5 py-3.5 text-xs leading-relaxed"
                style={{ borderColor: C.line, background: C.wash, color: C.muted }}
              >
                <Info size={14} className="mt-0.5 shrink-0" style={{ color: C.inkSoft }} />
                <p>
                  Se divide por (1 − comisión) porque MercadoLibre cobra sobre el precio final. Con ×(1 + comisión)
                  publicarías a {ars(precioErroneo)} y perderías{" "}
                  <span className="font-semibold" style={{ color: C.ink }}>
                    {ars(perdida)}
                  </span>{" "}
                  por venta.
                </p>
              </div>
            }
          >
            <StatRow label={`Comisión (${num(p.comisionPct)}%)`} value={ars(r.comision_marketplace)} />
            <StatRow label="Ganancia neta" value={ars(r.ganancia_marketplace)} strong />
            <PriceSplit
              price={r.precio_marketplace}
              parts={[
                { label: "costo", v: ctu, color: C.costo },
                { label: "ganancia", v: r.ganancia_marketplace, color: C.ganancia },
                { label: "comisión", v: r.comision_marketplace, color: C.comision },
              ]}
            />
          </ChannelCard>
        </section>

        {/* ---------------- Cuerpo ---------------- */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* -------- Controles -------- */}
          <section className="flex flex-col gap-6 lg:col-span-5" aria-label="Parámetros">
            <div className="rounded-xl border bg-white px-5 pb-2 pt-5" style={{ borderColor: C.line, boxShadow: SHADOW }}>
              <h2 className="fdm-semi text-base font-bold">La pieza</h2>
              <p className="mt-0.5 text-xs" style={{ color: C.muted }}>
                Ajustá con el slider o escribí el valor exacto.
              </p>
              <div className="mt-3 divide-y divide-slate-200">
                <SliderField
                  id="peso"
                  icon={Scale}
                  label="Peso de la pieza"
                  hint="Incluye soportes y purga"
                  value={p.peso}
                  onChange={set("peso")}
                  min={10}
                  max={1000}
                  step={5}
                  unit="g"
                  minLabel="10 g"
                  maxLabel="1000 g"
                />
                <SliderField
                  id="tiempoImpresion"
                  icon={Timer}
                  label="Tiempo de impresión"
                  hint="Lo que estima el slicer"
                  value={p.tiempoImpresion}
                  onChange={set("tiempoImpresion")}
                  min={0.5}
                  max={48}
                  step={0.5}
                  unit="h"
                  minLabel="0,5 h"
                  maxLabel="48 h"
                />
                <SliderField
                  id="manoObraMin"
                  icon={Clock}
                  label="Mano de obra"
                  hint="Preparar, retirar soportes, postprocesar, embalar"
                  value={p.manoObraMin}
                  onChange={set("manoObraMin")}
                  min={5}
                  max={120}
                  step={5}
                  unit="min"
                  minLabel="5 min"
                  maxLabel="120 min"
                />
              </div>
            </div>

            <div className="rounded-xl border bg-white" style={{ borderColor: C.line, boxShadow: SHADOW }}>
              <button
                type="button"
                onClick={() => setAdvOpen((o) => !o)}
                aria-expanded={advOpen}
                aria-controls="fdm-adv"
                className="fdm-focus flex w-full items-center justify-between gap-4 rounded-xl px-5 py-4 text-left"
              >
                <div>
                  <h2 className="fdm-semi text-base font-bold">Parámetros avanzados de costeo</h2>
                  <p className="mt-0.5 text-xs" style={{ color: C.muted }}>
                    La estructura fija de tu taller. Se cambia poco, pero mueve todo.
                  </p>
                </div>
                <ChevronDown
                  size={18}
                  className="shrink-0 transition-transform duration-200"
                  style={{ transform: advOpen ? "rotate(180deg)" : "none", color: C.inkSoft }}
                />
              </button>

              {advOpen && (
                <div id="fdm-adv" className="border-t px-5 pb-5 pt-4" style={{ borderColor: C.line }}>
                  <div>
                    <h3 className="mb-3 text-sm font-semibold" style={{ color: C.inkSoft }}>
                      Material e insumos
                    </h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <AdvField id="precioKg" label="Precio del filamento" value={p.precioKg} onChange={set("precioKg")} prefix="$" suffix="/kg" />
                      <AdvField id="packaging" label="Insumos y packaging" value={p.packaging} onChange={set("packaging")} prefix="$" suffix="/u" />
                      <AdvField id="fallaPct" label="Tasa de fallo / merma" value={p.fallaPct} onChange={set("fallaPct")} suffix="%" max={100} />
                    </div>
                  </div>

                  <div className="mt-5 border-t pt-4" style={{ borderColor: C.line }}>
                    <h3 className="mb-3 text-sm font-semibold" style={{ color: C.inkSoft }}>
                      Impresora y energía
                    </h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <AdvField id="valorImpresora" label="Valor de reposición" value={p.valorImpresora} onChange={set("valorImpresora")} prefix="$" />
                      <AdvField id="vidaUtil" label="Vida útil" value={p.vidaUtil} onChange={set("vidaUtil")} suffix="h" min={1} />
                      <AdvField id="mantenimientoPct" label="Mantenimiento y repuestos" value={p.mantenimientoPct} onChange={set("mantenimientoPct")} suffix="% amort." />
                      <AdvField id="potenciaW" label="Potencia media" value={p.potenciaW} onChange={set("potenciaW")} suffix="W" />
                      <AdvField id="costoKwh" label="Costo de la energía" value={p.costoKwh} onChange={set("costoKwh")} prefix="$" suffix="/kWh" />
                    </div>
                  </div>

                  <div className="mt-5 border-t pt-4" style={{ borderColor: C.line }}>
                    <h3 className="mb-3 text-sm font-semibold" style={{ color: C.inkSoft }}>
                      Trabajo y venta
                    </h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <AdvField id="valorHora" label="Valor de tu hora" value={p.valorHora} onChange={set("valorHora")} prefix="$" suffix="/h" />
                      <AdvField id="comisionPct" label="Comisión marketplace / impuestos" value={p.comisionPct} onChange={set("comisionPct")} suffix="%" max={95} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* -------- Visualización -------- */}
          <section className="flex min-w-0 flex-col gap-6 lg:col-span-7" aria-label="Análisis">
            <div className="rounded-xl border bg-white p-5" style={{ borderColor: C.line, boxShadow: SHADOW }}>
              <div className="flex flex-col gap-3">
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
                        className="fdm-focus whitespace-nowrap rounded-md px-3.5 py-2 text-sm font-semibold transition-colors"
                        style={{
                          background: on ? C.ink : "transparent",
                          color: on ? "#fff" : C.muted,
                        }}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                {tab === "canales" && (
                  <Legend
                    items={[
                      { label: "Costo total unitario", color: C.costo },
                      { label: "Ganancia neta", color: C.ganancia },
                      { label: "Comisión plataforma", color: C.comision },
                    ]}
                  />
                )}
              </div>

              <p className="mt-4 text-sm" style={{ color: C.muted }}>
                {tab === "composicion" ? (
                  <>
                    Cuánto aporta cada uno de los 6 componentes a los{" "}
                    <span className="font-semibold" style={{ color: C.ink }}>
                      {ars(ctu)}
                    </span>{" "}
                    de costo. En amarillo, el que más pesa.
                  </>
                ) : (
                  <>
                    Mismo costo, tres precios. En marketplace la ganancia neta iguala a la del minorista porque el precio
                    absorbe la comisión.
                  </>
                )}
              </p>

              <div className="mt-3" role="tabpanel">
                {tab === "composicion" ? (
                  <ComponentsChart data={componentes} maxKey={maxKey} animate={animate} />
                ) : (
                  <ChannelsChart data={canales} animate={animate} />
                )}
              </div>
            </div>

            {/* -------- Tabla -------- */}
            <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: C.line, boxShadow: SHADOW }}>
              <div className="px-5 pb-3 pt-5">
                <h2 className="fdm-semi text-base font-bold">Desglose del costo unitario</h2>
                <p className="mt-0.5 text-xs" style={{ color: C.muted }}>
                  La merma se aplica solo sobre material, energía y máquina.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 560 }}>
                  <thead>
                    <tr className="text-left text-xs" style={{ color: C.faint, background: C.wash }}>
                      <th className="px-5 py-2.5 font-medium">Componente</th>
                      <th className="px-3 py-2.5 font-medium">Fórmula aplicada</th>
                      <th className="px-3 py-2.5 text-right font-medium">Monto</th>
                      <th className="px-5 py-2.5 text-right font-medium">% del CTU</th>
                    </tr>
                  </thead>
                  <tbody>
                    {componentes.map((comp) => {
                      const Icon = comp.icon;
                      const top = comp.key === maxKey;
                      return (
                        <tr key={comp.key} className="border-t" style={{ borderColor: C.line }}>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5 font-semibold">
                              <Icon size={15} style={{ color: C.muted }} />
                              {comp.name}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-xs" style={{ color: C.muted }}>
                            {comp.formula}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right font-semibold">{ars(comp.value)}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-3">
                              <div className="hidden h-1.5 w-20 overflow-hidden rounded-full sm:block" style={{ background: C.wash }}>
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${Math.min(100, comp.pct)}%`, background: top ? C.yellow : C.ink }}
                                />
                              </div>
                              <span className="w-12 text-right font-medium">{pct(comp.pct)}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2" style={{ borderColor: C.ink }}>
                      <td className="px-5 py-3.5 font-bold" colSpan={2}>
                        Costo total unitario
                      </td>
                      <td className="fdm-semi whitespace-nowrap px-3 py-3.5 text-right text-base font-extrabold">{ars(ctu)}</td>
                      <td className="px-5 py-3.5 text-right font-bold">{pct(100)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
