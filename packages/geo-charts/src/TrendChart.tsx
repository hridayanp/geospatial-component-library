import { useMemo, useRef, useState, type ReactNode } from 'react';
import { cx } from '@hridayanp/ui';
import { ChartFrame, type LegendEntry } from './ChartFrame';
import { CATEGORICAL_LIGHT } from './palette';
import {
  formatCompact,
  linearScale,
  niceDomain,
  niceTicks,
} from './scales';
import { projectSeries, type SeriesPoint } from './trend';

/** One plotted series. */
export interface TrendSeries {
  /** Stable identity and legend label. */
  id: string;
  /** Observed points, in any order; they are sorted by `x`. */
  points: readonly SeriesPoint[];
  /**
   * Colour of the series.
   *
   * Where the series also appears on a map — a land-cover class, a hazard band —
   * pass the colour the map uses for it. A chart that recolours what the map
   * already coloured forces the reader to learn the encoding twice.
   */
  color?: string;
  /** Legend and tooltip label. Defaults to `id`. */
  label?: string;
}

export interface TrendChartProps {
  series: readonly TrendSeries[];
  title?: ReactNode;
  subtitle?: ReactNode;
  /**
   * Extrapolate every series to this `x` under its least-squares trend.
   * Omit to plot observations only.
   */
  projectTo?: number;
  /**
   * Half-width of the prediction band, in standard errors. Default `1.96`
   * (95%). `0` draws the projected line without a band.
   */
  intervalZ?: number;
  /** Clamp projected values, e.g. `[0, Infinity]` for an area. */
  clampProjection?: [number, number];
  /** Axis label for `x`. */
  xLabel?: string;
  /** Axis label for `y`, including its unit. */
  yLabel?: string;
  /** Unit appended to values in the tooltip and table. */
  unit?: string;
  /**
   * Start the value axis at zero. Default `false`.
   *
   * A line chart of a quantity that never approaches zero reads better on a
   * fitted axis. Set `true` when the distance from zero is part of the story.
   */
  includeZero?: boolean;
  /** Plot height in pixels, excluding the axis band. Default `220`. */
  height?: number;
  /** Value formatter. Defaults to a precision derived from the axis span. */
  formatValue?: (value: number) => string;
  /** `x` formatter. Defaults to the raw value. */
  formatX?: (value: number) => string;
  footnote?: ReactNode;
  className?: string;
}

const MARGIN = { top: 12, right: 64, bottom: 30, left: 56 };
const VIEW_WIDTH = 720;

/**
 * A time series with an optional least-squares projection.
 *
 * Observed values are drawn solid; projected values are drawn dashed inside a
 * prediction band. The distinction is the point of the chart: dashing is the
 * established convention for "not measured", and a projection rendered
 * identically to an observation invites the reader to treat an extrapolation as
 * data.
 *
 * ```tsx
 * <TrendChart
 *   title="Land-cover area by class"
 *   yLabel="Area (km²)"
 *   unit="km²"
 *   projectTo={2030}
 *   clampProjection={[0, Infinity]}
 *   series={classes.map((c) => ({ id: c.label, color: c.color, points: c.series }))}
 * />
 * ```
 *
 * ### Interpretation
 *
 * The projection assumes the observed rate of change continues. It carries no
 * knowledge of saturation, policy or any driver of the process, and the band
 * widens with distance from the observed period because the observations
 * constrain a distant value only loosely. Where the series is short or noisy,
 * the band will be wide — which is the chart telling the truth, not a defect.
 *
 * ### Accessibility
 *
 * Every plotted value is available in the table view, so nothing is reachable
 * only by hovering or only by distinguishing colours.
 */
export function TrendChart({
  series,
  title,
  subtitle,
  projectTo,
  intervalZ = 1.96,
  clampProjection,
  xLabel,
  yLabel,
  unit,
  includeZero = false,
  height = 220,
  formatValue,
  formatX,
  footnote,
  className,
}: TrendChartProps) {
  const [hoverX, setHoverX] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const model = useMemo(() => {
    const prepared = series.map((entry, index) => {
      const observed = entry.points
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        .slice()
        .sort((a, b) => a.x - b.x);

      const color =
        entry.color ?? CATEGORICAL_LIGHT[index % CATEGORICAL_LIGHT.length]!;

      let projection: ReturnType<typeof projectSeries> | null = null;
      if (projectTo != null && observed.length >= 2) {
        try {
          projection = projectSeries(observed, {
            to: projectTo,
            intervalZ,
            ...(clampProjection ? { clamp: clampProjection } : {}),
          });
        } catch {
          // A series too short or too flat to fit is plotted as observations
          // only; refusing to render the whole chart would be worse.
          projection = null;
        }
      }

      return {
        id: entry.id,
        label: entry.label ?? entry.id,
        color,
        observed,
        projection,
      };
    });

    const xs: number[] = [];
    const ys: number[] = [];
    for (const entry of prepared) {
      for (const point of entry.observed) {
        xs.push(point.x);
        ys.push(point.y);
      }
      for (const point of entry.projection?.points ?? []) {
        xs.push(point.x);
        ys.push(point.upper, point.lower);
      }
    }

    return { prepared, xs, ys };
  }, [series, projectTo, intervalZ, clampProjection]);

  const { prepared, xs, ys } = model;
  const plotWidth = VIEW_WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = height;

  const xDomain: [number, number] =
    xs.length > 0 ? [Math.min(...xs), Math.max(...xs)] : [0, 1];
  const yDomain = niceDomain(ys, { includeZero });

  const x = linearScale(xDomain, [0, plotWidth]);
  const y = linearScale(yDomain, [plotHeight, 0]);

  const yTicks = niceTicks(yDomain, 5);
  const xTicks = niceTicks(xDomain, Math.min(8, Math.max(2, xs.length)));

  const span = Math.abs(yDomain[1] - yDomain[0]);
  const format = formatValue ?? ((value: number) => formatCompact(value, span));
  const formatAxisX =
    formatX ?? ((value: number) => String(Math.round(value * 100) / 100));

  const observedXs = useMemo(
    () =>
      Array.from(
        new Set(prepared.flatMap((entry) => entry.observed.map((p) => p.x))),
      ).sort((a, b) => a - b),
    [prepared],
  );

  const legend: LegendEntry[] = prepared.map((entry) => ({
    label: entry.label,
    color: entry.color,
  }));
  if (projectTo != null && prepared.some((entry) => entry.projection)) {
    legend.push({ label: 'Projected', color: 'currentColor', dashed: true });
  }

  const columns = [
    { key: 'x', header: xLabel ?? 'x', numeric: false },
    ...prepared.map((entry) => ({
      key: entry.id,
      header: unit ? `${entry.label} (${unit})` : entry.label,
    })),
  ];

  const allXs = useMemo(
    () =>
      Array.from(
        new Set([
          ...observedXs,
          ...prepared.flatMap((entry) =>
            (entry.projection?.points ?? []).map((p) => p.x),
          ),
        ]),
      ).sort((a, b) => a - b),
    [observedXs, prepared],
  );

  const rows = allXs.map((value) => {
    const row: Record<string, ReactNode> = { x: formatAxisX(value) };
    for (const entry of prepared) {
      const observed = entry.observed.find((p) => p.x === value);
      if (observed) {
        row[entry.id] = format(observed.y);
        continue;
      }
      const projected = entry.projection?.points.find((p) => p.x === value);
      row[entry.id] = projected ? `${format(projected.y)} (projected)` : '—';
    }
    return row;
  });

  const nearestX = (clientX: number): number | null => {
    const svg = svgRef.current;
    if (!svg || allXs.length === 0) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return null;
    // The SVG scales to its container, so client pixels convert through the
    // viewBox rather than being usable directly.
    const viewX = ((clientX - rect.left) / rect.width) * VIEW_WIDTH;
    const value = x.invert(viewX - MARGIN.left);
    return allXs.reduce((best, candidate) =>
      Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best,
    );
  };

  const hovered = hoverX;

  return (
    <ChartFrame
      {...(title ? { title } : {})}
      {...(subtitle ? { subtitle } : {})}
      legend={legend}
      columns={columns}
      rows={rows}
      {...(footnote ? { footnote } : {})}
      {...(className ? { className } : {})}
    >
      <div className="gcl-chart__plot">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_WIDTH} ${plotHeight + MARGIN.top + MARGIN.bottom}`}
          className="gcl-chart__svg"
          role="img"
          aria-label={
            typeof title === 'string' ? title : 'Time series with trend'
          }
          onPointerMove={(event) => setHoverX(nearestX(event.clientX))}
          onPointerLeave={() => setHoverX(null)}
        >
          <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
            {/* Hairline, solid, one step off the surface. Dashing here would
                read as a threshold rather than as a grid. */}
            {yTicks.map((tick) => (
              <line
                key={`grid-${tick}`}
                x1={0}
                x2={plotWidth}
                y1={y(tick)}
                y2={y(tick)}
                className="gcl-chart__grid"
              />
            ))}

            {yTicks.map((tick) => (
              <text
                key={`ty-${tick}`}
                x={-10}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                className="gcl-chart__tick"
              >
                {format(tick)}
              </text>
            ))}
            {xTicks.map((tick) => (
              <text
                key={`tx-${tick}`}
                x={x(tick)}
                y={plotHeight + 20}
                textAnchor="middle"
                className="gcl-chart__tick"
              >
                {formatAxisX(tick)}
              </text>
            ))}

            {/* Prediction bands first, so lines and markers sit above them. */}
            {prepared.map((entry) =>
              entry.projection && intervalZ > 0 ? (
                <path
                  key={`band-${entry.id}`}
                  d={bandPath(
                    [entry.projection.anchor!, ...entry.projection.points],
                    x,
                    y,
                  )}
                  fill={entry.color}
                  className="gcl-chart__band"
                />
              ) : null,
            )}

            {prepared.map((entry) => (
              <g key={entry.id}>
                {entry.projection && entry.projection.points.length > 0 && (
                  <path
                    d={linePath(
                      [entry.projection.anchor!, ...entry.projection.points],
                      x,
                      y,
                    )}
                    stroke={entry.color}
                    className="gcl-chart__line gcl-chart__line--projected"
                  />
                )}
                <path
                  d={linePath(entry.observed, x, y)}
                  stroke={entry.color}
                  className="gcl-chart__line"
                />
              </g>
            ))}

            {hovered != null && (
              <line
                x1={x(hovered)}
                x2={x(hovered)}
                y1={0}
                y2={plotHeight}
                className="gcl-chart__crosshair"
              />
            )}

            {/* Markers only on observations: a marker on a projected point
                would present an extrapolation as a measurement. */}
            {prepared.map((entry) =>
              entry.observed.map((point) => (
                <circle
                  key={`${entry.id}-${point.x}`}
                  cx={x(point.x)}
                  cy={y(point.y)}
                  r={hovered === point.x ? 5 : 4}
                  fill={entry.color}
                  className="gcl-chart__marker"
                />
              )),
            )}

            {/* One direct label per series, at its final value. Labelling every
                point would be unreadable; the axis and table carry the rest. */}
            {prepared.map((entry) => {
              const last =
                entry.projection?.points[entry.projection.points.length - 1] ??
                entry.observed[entry.observed.length - 1];
              if (!last) return null;
              return (
                <text
                  key={`end-${entry.id}`}
                  x={x(last.x) + 8}
                  y={y(last.y)}
                  dy="0.32em"
                  className="gcl-chart__end-label"
                >
                  {format(last.y)}
                </text>
              );
            })}
          </g>

          {yLabel && (
            <text
              transform={`translate(12, ${MARGIN.top + plotHeight / 2}) rotate(-90)`}
              textAnchor="middle"
              className="gcl-chart__axis-label"
            >
              {yLabel}
            </text>
          )}
          {xLabel && (
            <text
              x={MARGIN.left + plotWidth / 2}
              y={plotHeight + MARGIN.top + MARGIN.bottom - 1}
              textAnchor="middle"
              className="gcl-chart__axis-label"
            >
              {xLabel}
            </text>
          )}
        </svg>

        {hovered != null && (
          <div
            className={cx(
              'gcl-chart__tooltip',
              x(hovered) / plotWidth > 0.6 && 'gcl-chart__tooltip--left',
            )}
            style={{
              left: `${((MARGIN.left + x(hovered)) / VIEW_WIDTH) * 100}%`,
            }}
            role="status"
          >
            <div className="gcl-chart__tooltip-title">
              {formatAxisX(hovered)}
            </div>
            {prepared.map((entry) => {
              const observed = entry.observed.find((p) => p.x === hovered);
              const projected = entry.projection?.points.find(
                (p) => p.x === hovered,
              );
              const point = observed ?? projected;
              if (!point) return null;
              return (
                <div key={entry.id} className="gcl-chart__tooltip-row">
                  <span
                    className="gcl-chart__key"
                    style={{ color: entry.color }}
                    aria-hidden="true"
                  />
                  <span className="gcl-chart__tooltip-label">
                    {entry.label}
                    {!observed && projected ? ' (projected)' : ''}
                  </span>
                  <span className="gcl-chart__tooltip-value">
                    {format(point.y)}
                    {unit ? ` ${unit}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ChartFrame>
  );
}

function linePath(
  points: readonly SeriesPoint[],
  x: (value: number) => number,
  y: (value: number) => number,
): string {
  if (points.length === 0) return '';
  return points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${x(point.x).toFixed(2)},${y(point.y).toFixed(2)}`,
    )
    .join(' ');
}

function bandPath(
  points: ReadonlyArray<{ x: number; lower: number; upper: number }>,
  x: (value: number) => number,
  y: (value: number) => number,
): string {
  if (points.length < 2) return '';
  const upper = points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${x(point.x).toFixed(2)},${y(point.upper).toFixed(2)}`,
    )
    .join(' ');
  const lower = points
    .slice()
    .reverse()
    .map((point) => `L${x(point.x).toFixed(2)},${y(point.lower).toFixed(2)}`)
    .join(' ');
  return `${upper} ${lower} Z`;
}
