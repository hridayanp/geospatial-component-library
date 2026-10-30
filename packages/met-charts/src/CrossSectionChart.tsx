import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ChartFrame, formatCompact, linearScale, niceTicks } from '@hridayanp/geo-charts';
import { colorAt, colorScaleToCss, type ColorScaleInput } from '@hridayanp/raster-utils';
import { formatValue } from './format';
import { TooltipRow } from './SkewTChart';

export interface CrossSectionChartProps {
  /** Horizontal positions, km along the section, ascending. */
  distancesKm: readonly number[];
  /**
   * Vertical coordinate of each row: pressure (hPa) or height (m). Pressure is
   * drawn with the surface at the bottom on a log axis.
   */
  levels: readonly number[];
  /** `values[levelIndex][distanceIndex]`; `null` for missing cells (terrain, NoData). */
  values: ReadonlyArray<ReadonlyArray<number | null>>;
  /** `'pressure'` (log, decreasing upward) or `'height'` (linear). Default `'pressure'`. */
  verticalAxis?: 'pressure' | 'height';
  colorScale: ColorScaleInput;
  /** Colour range; default the data's own range. */
  min?: number;
  max?: number;
  title?: ReactNode;
  subtitle?: ReactNode;
  unit?: string;
  /** Plot height in viewBox units. Default `260`. */
  height?: number;
  footnote?: ReactNode;
  className?: string;
}

const VIEW_WIDTH = 720;
const MARGIN = { top: 12, right: 18, bottom: 54, left: 60 };

/**
 * A vertical cross-section: a variable through the depth of the atmosphere
 * along a line drawn on the map — humidity under a front, wind in a jet.
 *
 * The data is the host's (a model's levels sampled along the line); the chart
 * draws it as coloured cells on distance against pressure or height, with a
 * colour key beneath.
 */
export function CrossSectionChart({
  distancesKm,
  levels,
  values,
  verticalAxis = 'pressure',
  colorScale,
  min,
  max,
  title,
  subtitle,
  unit,
  height = 260,
  footnote,
  className,
}: CrossSectionChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ row: number; column: number } | null>(null);
  const plotWidth = VIEW_WIDTH - MARGIN.left - MARGIN.right;

  const range = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const row of values) for (const v of row) if (v != null && Number.isFinite(v)) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    return [min ?? (Number.isFinite(lo) ? lo : 0), max ?? (Number.isFinite(hi) ? hi : 1)] as [number, number];
  }, [values, min, max]);

  const x = linearScale([distancesKm[0] ?? 0, distancesKm[distancesKm.length - 1] ?? 1], [0, plotWidth]);
  const pressure = verticalAxis === 'pressure';
  const vertical = (value: number) => (pressure ? Math.log(value) : value);
  const vMin = Math.min(...levels.map(vertical));
  const vMax = Math.max(...levels.map(vertical));
  // Pressure: high pressure (surface) at the bottom. Height: high at the top.
  const y = linearScale(pressure ? [vMin, vMax] : [vMin, vMax], pressure ? [0, height] : [height, 0]);

  // Cell edges sit halfway between neighbouring samples.
  const edges = (positions: number[]) =>
    positions.map((p, i) => {
      const prev = positions[i - 1];
      const next = positions[i + 1];
      return [
        prev != null ? (p + prev) / 2 : p - ((next ?? p) - p) / 2,
        next != null ? (p + next) / 2 : p + (p - (prev ?? p)) / 2,
      ] as const;
    });
  const columnEdges = edges(distancesKm.map((d) => x(d)));
  const rowEdges = edges(levels.map((l) => y(vertical(l))));

  const normalise = (v: number) => (range[1] > range[0] ? (v - range[0]) / (range[1] - range[0]) : 0.5);
  const verticalTicks = pressure
    ? [1000, 925, 850, 700, 500, 400, 300, 250, 200, 150, 100].filter(
        (p) => Math.log(p) >= vMin - 1e-9 && Math.log(p) <= vMax + 1e-9,
      )
    : niceTicks([vMin, vMax], 5);

  const hovered = hover ? values[hover.row]?.[hover.column] : undefined;

  return (
    <ChartFrame
      {...(title ? { title } : {})}
      {...(subtitle ? { subtitle } : {})}
      {...(footnote ? { footnote } : {})}
      className={['gcl-met', className].filter(Boolean).join(' ')}
    >
      <div className="gcl-chart__plot">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_WIDTH} ${height + MARGIN.top + MARGIN.bottom}`}
          className="gcl-chart__svg"
          role="img"
          aria-label={typeof title === 'string' ? title : 'Vertical cross-section'}
          onPointerLeave={() => setHover(null)}
        >
          <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
            {values.map((row, r) =>
              row.map((v, c) => {
                if (v == null || !Number.isFinite(v) || !columnEdges[c] || !rowEdges[r]) return null;
                const [x0, x1] = columnEdges[c]!;
                const [y0, y1] = rowEdges[r]!;
                return (
                  <rect
                    key={`${r}-${c}`}
                    x={Math.min(x0, x1)}
                    y={Math.min(y0, y1)}
                    width={Math.abs(x1 - x0) + 0.5}
                    height={Math.abs(y1 - y0) + 0.5}
                    fill={colorAt(colorScale, normalise(v))}
                    onPointerEnter={() => setHover({ row: r, column: c })}
                  />
                );
              }),
            )}
            <rect x={0} y={0} width={plotWidth} height={height} className="gcl-met__frame" />
            {verticalTicks.map((tick) => (
              <text key={tick} x={-8} y={y(vertical(tick))} dy="0.32em" textAnchor="end" className="gcl-chart__tick">
                {formatCompact(tick, 1000)}
              </text>
            ))}
            {niceTicks(x.domain, 6).map((tick) => (
              <text key={tick} x={x(tick)} y={height + 16} textAnchor="middle" className="gcl-chart__tick">
                {formatCompact(tick, x.domain[1])}
              </text>
            ))}
          </g>
          <text transform={`translate(12, ${MARGIN.top + height / 2}) rotate(-90)`} textAnchor="middle" className="gcl-chart__axis-label">
            {pressure ? 'Pressure (hPa)' : 'Height (m)'}
          </text>
          <text x={MARGIN.left + plotWidth / 2} y={height + MARGIN.top + 32} textAnchor="middle" className="gcl-chart__axis-label">
            Distance (km)
          </text>
        </svg>
        {hover && (
          <div className="gcl-chart__tooltip" style={{ left: `${((MARGIN.left + x(distancesKm[hover.column] ?? 0)) / VIEW_WIDTH) * 100}%` }}>
            <div className="gcl-chart__tooltip-title">
              {formatValue(distancesKm[hover.column], 0)} km · {formatValue(levels[hover.row], 0)} {pressure ? 'hPa' : 'm'}
            </div>
            <TooltipRow label="Value" value={`${formatValue(hovered ?? null, 2)}${unit ? ` ${unit}` : ''}`} />
          </div>
        )}
      </div>
      <div className="gcl-chart__scale">
        <span>{formatValue(range[0], 1)}</span>
        <span className="gcl-chart__scale-ramp" style={{ background: colorScaleToCss(colorScale) }} />
        <span>
          {formatValue(range[1], 1)}
          {unit ? ` ${unit}` : ''}
        </span>
      </div>
    </ChartFrame>
  );
}
