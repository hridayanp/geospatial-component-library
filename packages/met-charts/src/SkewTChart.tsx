import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChartFrame } from '@hridayanp/geo-charts';
import { formatValue } from './format';
import {
  analyzeParcel,
  dryAdiabatTemperature,
  moistAdiabat,
  temperatureAtMixingRatio,
  type SoundingLevel,
} from './thermo';
import { barbPath } from './wind';

export interface SkewTChartProps {
  /** Sounding levels in any order; sorted by pressure internally. */
  levels: readonly SoundingLevel[];
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Top of the diagram, hPa. Default `100`. */
  pressureTop?: number;
  /** Bottom of the diagram, hPa. Default `1050`. */
  pressureBottom?: number;
  /** Temperature range along the bottom edge, °C. Default `[-40, 50]`. */
  temperatureRange?: [number, number];
  /** Draw dry adiabats, moist adiabats and mixing-ratio lines. Default `true`. */
  showReferenceLines?: boolean;
  /** Lift the lowest level and draw its path, with LCL, LFC, EL, CAPE and CIN. Default `true`. */
  showParcel?: boolean;
  /** Draw wind barbs in a column at the right edge. Default `true`. */
  showWindBarbs?: boolean;
  /** Temperature trace colour. Default `'#e34948'`. */
  temperatureColor?: string;
  /** Dewpoint trace colour. Default `'#1baf7a'`. */
  dewpointColor?: string;
  /** Plot size in viewBox units; the SVG scales to its container. Default `560`. */
  size?: number;
  footnote?: ReactNode;
  className?: string;
}

const STANDARD_ISOBARS = [1000, 925, 850, 700, 600, 500, 400, 300, 250, 200, 150, 100];
const MIXING_RATIOS = [0.4, 1, 2, 4, 7, 10, 16, 24];
const MARGIN = { top: 12, right: 64, bottom: 30, left: 46 };

/**
 * A Skew-T log-P diagram of an upper-air sounding.
 *
 * Pressure falls logarithmically up the vertical axis and isotherms lean at
 * 45°, the layout forecasters read stability from: dry adiabats (solid,
 * faint), moist adiabats (dashed) and saturation mixing-ratio lines (dotted)
 * form the background; temperature and dewpoint are plotted over them; a
 * surface parcel is lifted and its LCL, LFC, EL, CAPE and CIN reported.
 *
 * ```tsx
 * <SkewTChart title="VOCI 00Z" levels={sounding} />
 * ```
 *
 * Every level is also available in the table view.
 */
export function SkewTChart({
  levels,
  title,
  subtitle,
  pressureTop = 100,
  pressureBottom = 1050,
  temperatureRange = [-40, 50],
  showReferenceLines = true,
  showParcel = true,
  showWindBarbs = true,
  temperatureColor = '#e34948',
  dewpointColor = '#1baf7a',
  size = 560,
  footnote,
  className,
}: SkewTChartProps) {
  const clipId = `gcl-skewt-${useId().replace(/[^a-z0-9]/gi, '')}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const width = size + MARGIN.left + MARGIN.right;
  const height = size + MARGIN.top + MARGIN.bottom;
  const plot = size;
  const [tMin, tMax] = temperatureRange;
  const lnTop = Math.log(pressureTop);
  const lnBottom = Math.log(pressureBottom);

  const y = (p: number) => ((Math.log(p) - lnTop) / (lnBottom - lnTop)) * plot;
  // Skew: one pixel right for every pixel up, so isotherms run at 45°.
  const x = (t: number, p: number) => ((t - tMin) / (tMax - tMin)) * plot + (plot - y(p));
  const path = (points: ReadonlyArray<readonly [number, number]>) =>
    points.map(([t, p], i) => `${i ? 'L' : 'M'}${x(t, p).toFixed(1)} ${y(p).toFixed(1)}`).join('');

  const sorted = useMemo(
    () =>
      levels
        .filter((l) => Number.isFinite(l.pressure) && Number.isFinite(l.temperature))
        .slice()
        .sort((a, b) => b.pressure - a.pressure),
    [levels],
  );

  const reference = useMemo(() => {
    if (!showReferenceLines) return null;
    const pressures: number[] = [];
    for (let i = 0; i <= 40; i++) {
      pressures.push(Math.exp(lnBottom + ((lnTop - lnBottom) * i) / 40));
    }
    const dry = [];
    for (let theta = 250; theta <= 470; theta += 10) {
      dry.push(pressures.map((p) => [dryAdiabatTemperature(theta, p), p] as const));
    }
    const moistPressures = pressures.filter((p) => p >= 200 && p <= 1000);
    const moist = [];
    for (let t0 = -16; t0 <= 36; t0 += 4) {
      const temps = moistAdiabat(t0, 1000, [1000, ...moistPressures]);
      moist.push([1000, ...moistPressures].map((p, i) => [temps[i]!, p] as const));
    }
    const mixingPressures = pressures.filter((p) => p >= 600);
    const mixing = MIXING_RATIOS.map((w) => ({
      w,
      points: mixingPressures.map((p) => [temperatureAtMixingRatio(w / 1000, p), p] as const),
    }));
    return { dry, moist, mixing };
  }, [showReferenceLines, lnBottom, lnTop]);

  const parcel = useMemo(() => (showParcel ? analyzeParcel(sorted) : null), [showParcel, sorted]);

  const temperaturePath = path(sorted.map((l) => [l.temperature, l.pressure] as const));
  const dewpointPath = path(
    sorted
      .filter((l) => l.dewpoint != null && Number.isFinite(l.dewpoint))
      .map((l) => [l.dewpoint as number, l.pressure] as const),
  );

  // Barbs need ~16 px of vertical room each; thin the column to fit.
  const barbs = useMemo(() => {
    if (!showWindBarbs) return [];
    const out: SoundingLevel[] = [];
    let lastY = -Infinity;
    for (const level of sorted) {
      if (level.windSpeed == null || level.windDirection == null) continue;
      if (level.pressure < pressureTop || level.pressure > pressureBottom) continue;
      const position = y(level.pressure);
      if (Math.abs(position - lastY) < 16) continue;
      out.push(level);
      lastY = position;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted, showWindBarbs, pressureTop, pressureBottom, size]);

  const hovered = hover != null ? sorted[hover] : undefined;

  const onPointerMove = (clientY: number) => {
    const svg = svgRef.current;
    if (!svg || sorted.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const viewY = ((clientY - rect.top) / rect.height) * height - MARGIN.top;
    let best = 0;
    sorted.forEach((level, index) => {
      if (Math.abs(y(level.pressure) - viewY) < Math.abs(y(sorted[best]!.pressure) - viewY)) best = index;
    });
    setHover(best);
  };

  const columns = [
    { key: 'p', header: 'Pressure (hPa)', numeric: false },
    { key: 'z', header: 'Height (m)' },
    { key: 't', header: 'T (°C)' },
    { key: 'td', header: 'Td (°C)' },
    { key: 'wd', header: 'Wind dir (°)' },
    { key: 'ws', header: 'Wind (kt)' },
  ];
  const rows = sorted.map((l) => ({
    p: formatValue(l.pressure, 0),
    z: formatValue(l.height, 0),
    t: formatValue(l.temperature),
    td: formatValue(l.dewpoint),
    wd: formatValue(l.windDirection, 0),
    ws: formatValue(l.windSpeed, 0),
  }));

  const legend = [
    { label: 'Temperature', color: temperatureColor },
    { label: 'Dewpoint', color: dewpointColor },
    ...(parcel ? [{ label: 'Surface parcel', color: 'currentColor', dashed: true }] : []),
  ];

  const indices = parcel
    ? `LCL ${formatValue(parcel.lcl.pressure, 0)} hPa · LFC ${parcel.lfc ? `${formatValue(parcel.lfc, 0)} hPa` : '—'} · EL ${parcel.el ? `${formatValue(parcel.el, 0)} hPa` : '—'} · CAPE ${formatValue(parcel.cape, 0)} J/kg · CIN ${formatValue(parcel.cin, 0)} J/kg`
    : null;

  return (
    <ChartFrame
      {...(title ? { title } : {})}
      subtitle={subtitle ?? indices ?? undefined}
      legend={legend}
      columns={columns}
      rows={rows}
      {...(footnote ? { footnote } : {})}
      className={['gcl-met', className].filter(Boolean).join(' ')}
    >
      <div className="gcl-chart__plot">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="gcl-chart__svg"
          role="img"
          aria-label={typeof title === 'string' ? title : 'Skew-T log-P diagram'}
          onPointerMove={(event) => onPointerMove(event.clientY)}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={0} y={0} width={plot} height={plot} />
            </clipPath>
          </defs>
          <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
            <g clipPath={`url(#${clipId})`}>
              {STANDARD_ISOBARS.filter((p) => p >= pressureTop && p <= pressureBottom).map((p) => (
                <line key={`p${p}`} x1={0} x2={plot} y1={y(p)} y2={y(p)} className="gcl-chart__grid" />
              ))}
              {Array.from({ length: 18 }, (_, i) => -120 + i * 10).map((t) => (
                <path
                  key={`t${t}`}
                  d={path([
                    [t, pressureBottom],
                    [t, pressureTop],
                  ])}
                  className={t === 0 ? 'gcl-met__isotherm gcl-met__isotherm--zero' : 'gcl-met__isotherm'}
                />
              ))}
              {reference?.dry.map((points, i) => (
                <path key={`d${i}`} d={path(points)} className="gcl-met__dry-adiabat" />
              ))}
              {reference?.moist.map((points, i) => (
                <path key={`m${i}`} d={path(points)} className="gcl-met__moist-adiabat" />
              ))}
              {reference?.mixing.map(({ w, points }) => (
                <path key={`w${w}`} d={path(points)} className="gcl-met__mixing-ratio" />
              ))}

              {parcel && (
                <path
                  d={path(parcel.path.map((point) => [point.temperature, point.pressure] as const))}
                  className="gcl-met__parcel"
                />
              )}
              <path d={dewpointPath} stroke={dewpointColor} className="gcl-chart__line gcl-met__trace" />
              <path d={temperaturePath} stroke={temperatureColor} className="gcl-chart__line gcl-met__trace" />

              {parcel && (
                <g className="gcl-met__marker">
                  <line
                    x1={x(parcel.lcl.temperature, parcel.lcl.pressure) - 10}
                    x2={x(parcel.lcl.temperature, parcel.lcl.pressure) + 10}
                    y1={y(parcel.lcl.pressure)}
                    y2={y(parcel.lcl.pressure)}
                  />
                  <text x={x(parcel.lcl.temperature, parcel.lcl.pressure) + 13} y={y(parcel.lcl.pressure)} dy="0.32em" className="gcl-chart__tick">
                    LCL
                  </text>
                </g>
              )}

              {hovered && (
                <line x1={0} x2={plot} y1={y(hovered.pressure)} y2={y(hovered.pressure)} className="gcl-chart__crosshair" />
              )}
            </g>

            <rect x={0} y={0} width={plot} height={plot} className="gcl-met__frame" />

            {STANDARD_ISOBARS.filter((p) => p >= pressureTop && p <= pressureBottom).map((p) => (
              <text key={`lp${p}`} x={-8} y={y(p)} dy="0.32em" textAnchor="end" className="gcl-chart__tick">
                {p}
              </text>
            ))}
            {Array.from({ length: 10 }, (_, i) => tMin + i * 10)
              .filter((t) => t <= tMax)
              .map((t) => (
                <text key={`lt${t}`} x={x(t, pressureBottom)} y={plot + 18} textAnchor="middle" className="gcl-chart__tick">
                  {t}
                </text>
              ))}

            {barbs.map((level) => {
              const barb = barbPath(level.windSpeed as number, 22);
              return (
                <g
                  key={`b${level.pressure}`}
                  transform={`translate(${plot + 34}, ${y(level.pressure)}) rotate(${level.windDirection})`}
                  className="gcl-met__barb"
                >
                  {barb.calm ? (
                    <circle r={4} />
                  ) : (
                    <>
                      <path d={barb.shaft} />
                      <path d={barb.feathers} />
                      <path d={barb.pennants} className="gcl-met__pennant" />
                    </>
                  )}
                </g>
              );
            })}
          </g>

          <text transform={`translate(12, ${MARGIN.top + plot / 2}) rotate(-90)`} textAnchor="middle" className="gcl-chart__axis-label">
            Pressure (hPa)
          </text>
          <text x={MARGIN.left + plot / 2} y={height - 1} textAnchor="middle" className="gcl-chart__axis-label">
            Temperature (°C)
          </text>
        </svg>

        {hovered && (
          <div
            className="gcl-chart__tooltip"
            style={{ left: `${((MARGIN.left + 8) / width) * 100}%`, top: `${((MARGIN.top + y(hovered.pressure)) / height) * 100}%` }}
          >
            <div className="gcl-chart__tooltip-title">{formatValue(hovered.pressure, 0)} hPa</div>
            <TooltipRow label="Temperature" value={`${formatValue(hovered.temperature)} °C`} color={temperatureColor} />
            <TooltipRow label="Dewpoint" value={`${formatValue(hovered.dewpoint)} °C`} color={dewpointColor} />
            {hovered.height != null && <TooltipRow label="Height" value={`${formatValue(hovered.height, 0)} m`} />}
            {hovered.windSpeed != null && (
              <TooltipRow
                label="Wind"
                value={`${formatValue(hovered.windDirection, 0)}° / ${formatValue(hovered.windSpeed, 0)} kt`}
              />
            )}
          </div>
        )}
      </div>
    </ChartFrame>
  );
}

export function TooltipRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="gcl-chart__tooltip-row">
      {color && <span className="gcl-chart__key" style={{ color }} aria-hidden="true" />}
      <span className="gcl-chart__tooltip-label">{label}</span>
      <span className="gcl-chart__tooltip-value">{value}</span>
    </div>
  );
}
