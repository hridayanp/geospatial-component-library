import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  CATEGORICAL_LIGHT,
  ChartFrame,
  formatCompact,
  linearScale,
  niceDomain,
  niceTicks,
  type LegendEntry,
} from '@hridayanp/geo-charts';
import { formatUtcLong, formatUtcShort, formatValue } from './format';
import { TooltipRow } from './SkewTChart';
import { barbPath } from './wind';

/** One plotted variable. */
export interface MeteogramSeries {
  id: string;
  label?: string;
  /** One value per entry in `times`; `null` leaves a gap. */
  values: ReadonlyArray<number | null>;
  color?: string;
  /** `'line'` for states (temperature), `'bar'` for accumulations (rain), `'area'` for cover. Default `'line'`. */
  type?: 'line' | 'bar' | 'area';
  /** Draw dashed — a second model, or a climatology. */
  dashed?: boolean;
}

/** A horizontal band with its own value axis. */
export interface MeteogramPanel {
  id: string;
  /** Axis title, e.g. `"Temperature"`. */
  label: string;
  /** Unit shown on the axis and in tooltips. */
  unit?: string;
  series: readonly MeteogramSeries[];
  /** Fixed value range; default fits the data. */
  domain?: [number, number];
  /** Panel height in viewBox units. Default `110`. */
  height?: number;
}

export interface MeteogramProps {
  /** Valid times, epoch milliseconds, ascending. */
  times: readonly number[];
  panels: readonly MeteogramPanel[];
  /** Optional wind row of barbs beneath the panels. Speeds in knots. */
  wind?: {
    speed: ReadonlyArray<number | null>;
    direction: ReadonlyArray<number | null>;
    /** Draw one barb every `every` steps. Default chosen to keep ~24 px between barbs. */
    every?: number;
  };
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Draw a vertical marker at this time — "now", or the selected frame. */
  marker?: number;
  /** Time-axis label formatter. Default `Wed 16 12Z`. */
  formatTime?: (time: number) => string;
  footnote?: ReactNode;
  className?: string;
}

const VIEW_WIDTH = 760;
const MARGIN = { top: 10, right: 16, bottom: 26, left: 64 };
const GAP = 24;
const WIND_ROW = 40;

/**
 * A meteogram: several variables at one place, stacked on a shared UTC time
 * axis, with a single crosshair across every panel.
 *
 * ```tsx
 * <Meteogram
 *   times={validTimes}
 *   panels={[
 *     { id: 't', label: 'Temperature', unit: '°C', series: [{ id: 't2m', values: t2m }, { id: 'td', values: td, color: '#1baf7a' }] },
 *     { id: 'rain', label: 'Rain', unit: 'mm', series: [{ id: 'tp', values: rain, type: 'bar' }] },
 *   ]}
 *   wind={{ speed: ws, direction: wd }}
 * />
 * ```
 *
 * Times are formatted in UTC throughout; forecasts are issued in UTC and a
 * local-time axis is a reliable source of off-by-hours misreadings.
 */
export function Meteogram({
  times,
  panels,
  wind,
  title,
  subtitle,
  marker,
  formatTime = formatUtcShort,
  footnote,
  className,
}: MeteogramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const plotWidth = VIEW_WIDTH - MARGIN.left - MARGIN.right;
  const x = linearScale([times[0] ?? 0, times[times.length - 1] ?? 1], [0, plotWidth]);
  const step = times.length > 1 ? plotWidth / (times.length - 1) : plotWidth;

  const layout = useMemo(() => {
    let top = 0;
    return panels.map((panel, panelIndex) => {
      const height = panel.height ?? 110;
      const values = panel.series.flatMap((s) => s.values.filter((v): v is number => v != null && Number.isFinite(v)));
      const hasBars = panel.series.some((s) => s.type === 'bar' || s.type === 'area');
      const domain = panel.domain ?? niceDomain(values, { includeZero: hasBars });
      const y = linearScale(domain, [height, 0]);
      const entry = { panel, top, height, domain, y, panelIndex };
      top += height + GAP;
      return entry;
    });
  }, [panels]);

  const panelsHeight = layout.reduce((sum, p) => sum + p.height + GAP, 0) - (layout.length ? GAP : 0);
  const windTop = panelsHeight + (wind ? GAP : 0);
  const plotHeight = windTop + (wind ? WIND_ROW : 0);
  const viewHeight = plotHeight + MARGIN.top + MARGIN.bottom;

  const timeTicks = useMemo(() => {
    const target = Math.max(2, Math.floor(plotWidth / 90));
    const every = Math.max(1, Math.ceil(times.length / target));
    return times.filter((_, i) => i % every === 0);
  }, [times, plotWidth]);

  const windEvery = wind?.every ?? Math.max(1, Math.ceil(24 / step));

  let paletteIndex = 0;
  const colored = layout.map((entry) => ({
    ...entry,
    series: entry.panel.series.map((s) => ({
      ...s,
      color: s.color ?? CATEGORICAL_LIGHT[paletteIndex++ % CATEGORICAL_LIGHT.length]!,
    })),
  }));

  const legend: LegendEntry[] = colored.flatMap((entry) =>
    entry.series.map((s) => ({ label: s.label ?? s.id, color: s.color, ...(s.dashed ? { dashed: true } : {}) })),
  );

  const columns = [
    { key: 'time', header: 'Valid (UTC)', numeric: false },
    ...colored.flatMap((entry) =>
      entry.series.map((s) => ({ key: `${entry.panel.id}:${s.id}`, header: `${s.label ?? s.id}${entry.panel.unit ? ` (${entry.panel.unit})` : ''}` })),
    ),
    ...(wind ? [{ key: 'wind', header: 'Wind (°/kt)' }] : []),
  ];
  const rows = times.map((time, i) => {
    const row: Record<string, ReactNode> = { time: formatUtcLong(time) };
    for (const entry of colored) {
      for (const s of entry.series) row[`${entry.panel.id}:${s.id}`] = formatValue(s.values[i]);
    }
    if (wind) row['wind'] = `${formatValue(wind.direction[i], 0)} / ${formatValue(wind.speed[i], 0)}`;
    return row;
  });

  const onPointerMove = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg || times.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const viewX = ((clientX - rect.left) / rect.width) * VIEW_WIDTH - MARGIN.left;
    const value = x.invert(viewX);
    let best = 0;
    times.forEach((t, i) => {
      if (Math.abs(t - value) < Math.abs(times[best]! - value)) best = i;
    });
    setHover(best);
  };

  const linePath = (values: ReadonlyArray<number | null>, y: (v: number) => number) => {
    let d = '';
    let pen = false;
    values.forEach((v, i) => {
      if (v == null || !Number.isFinite(v)) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(times[i]!).toFixed(1)} ${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const hoverX = hover != null ? x(times[hover]!) : null;

  return (
    <ChartFrame
      {...(title ? { title } : {})}
      {...(subtitle ? { subtitle } : {})}
      legend={legend}
      columns={columns}
      rows={rows}
      {...(footnote ? { footnote } : {})}
      className={['gcl-met', className].filter(Boolean).join(' ')}
    >
      <div className="gcl-chart__plot">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_WIDTH} ${viewHeight}`}
          className="gcl-chart__svg"
          role="img"
          aria-label={typeof title === 'string' ? title : 'Meteogram'}
          onPointerMove={(event) => onPointerMove(event.clientX)}
          onPointerLeave={() => setHover(null)}
        >
          <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
            {colored.map(({ panel, top, height, domain, y, series }) => {
              const ticks = niceTicks(domain, Math.max(2, Math.round(height / 36)));
              const span = Math.abs(domain[1] - domain[0]);
              const bars = series.filter((s) => s.type === 'bar');
              const barWidth = Math.max(1, (step * 0.7) / Math.max(1, bars.length));
              return (
                <g key={panel.id} transform={`translate(0, ${top})`}>
                  {ticks.map((tick) => (
                    <g key={tick}>
                      <line x1={0} x2={plotWidth} y1={y(tick)} y2={y(tick)} className="gcl-chart__grid" />
                      <text x={-8} y={y(tick)} dy="0.32em" textAnchor="end" className="gcl-chart__tick">
                        {formatCompact(tick, span)}
                      </text>
                    </g>
                  ))}
                  <text
                    transform={`translate(${-MARGIN.left + 12}, ${height / 2}) rotate(-90)`}
                    textAnchor="middle"
                    className="gcl-chart__axis-label"
                  >
                    {panel.unit ? `${panel.label} (${panel.unit})` : panel.label}
                  </text>
                  {series.map((s) => {
                    if (s.type === 'bar') {
                      const offset = bars.indexOf(s) * barWidth - (bars.length * barWidth) / 2;
                      const base = y(Math.max(domain[0], Math.min(domain[1], 0)));
                      return (
                        <g key={s.id} fill={s.color}>
                          {s.values.map((v, i) =>
                            v == null || !Number.isFinite(v) ? null : (
                              <rect
                                key={i}
                                x={x(times[i]!) + offset}
                                y={Math.min(base, y(v))}
                                width={barWidth}
                                height={Math.abs(base - y(v))}
                                className="gcl-chart__bar"
                              />
                            ),
                          )}
                        </g>
                      );
                    }
                    const d = linePath(s.values, y);
                    return (
                      <g key={s.id}>
                        {s.type === 'area' && d && (
                          <path
                            d={`${d}L${x(times[times.length - 1]!)} ${y(Math.max(domain[0], 0))}L${x(times[0]!)} ${y(Math.max(domain[0], 0))}Z`}
                            fill={s.color}
                            className="gcl-chart__band"
                          />
                        )}
                        <path
                          d={d}
                          stroke={s.color}
                          className={s.dashed ? 'gcl-chart__line gcl-chart__line--projected' : 'gcl-chart__line'}
                        />
                      </g>
                    );
                  })}
                  {hover != null &&
                    series
                      .filter((s) => s.type !== 'bar' && s.values[hover] != null)
                      .map((s) => (
                        <circle key={s.id} cx={hoverX!} cy={y(s.values[hover] as number)} r={4} fill={s.color} className="gcl-chart__marker" />
                      ))}
                </g>
              );
            })}

            {wind && (
              <g transform={`translate(0, ${windTop + WIND_ROW / 2})`}>
                <text
                  transform={`translate(${-MARGIN.left + 12}, 0) rotate(-90)`}
                  textAnchor="middle"
                  className="gcl-chart__axis-label"
                >
                  Wind
                </text>
                {times.map((time, i) => {
                  const speed = wind.speed[i];
                  const direction = wind.direction[i];
                  if (i % windEvery !== 0 || speed == null || direction == null) return null;
                  const barb = barbPath(speed, 18);
                  return (
                    <g key={time} transform={`translate(${x(time)}, 0) rotate(${direction})`} className="gcl-met__barb">
                      {barb.calm ? (
                        <circle r={3.5} />
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
            )}

            {marker != null && marker >= (times[0] ?? 0) && marker <= (times[times.length - 1] ?? 0) && (
              <line x1={x(marker)} x2={x(marker)} y1={0} y2={plotHeight} className="gcl-met__now" />
            )}
            {hoverX != null && (
              <line x1={hoverX} x2={hoverX} y1={0} y2={plotHeight} className="gcl-chart__crosshair" />
            )}

            {timeTicks.map((time) => (
              <text key={time} x={x(time)} y={plotHeight + 18} textAnchor="middle" className="gcl-chart__tick">
                {formatTime(time)}
              </text>
            ))}
          </g>
        </svg>

        {hover != null && (
          <div
            className={['gcl-chart__tooltip', hoverX! > plotWidth * 0.6 ? 'gcl-chart__tooltip--left' : ''].join(' ')}
            style={{ left: `${((MARGIN.left + hoverX!) / VIEW_WIDTH) * 100}%` }}
          >
            <div className="gcl-chart__tooltip-title">{formatUtcLong(times[hover]!)}</div>
            {colored.flatMap((entry) =>
              entry.series.map((s) => (
                <TooltipRow
                  key={`${entry.panel.id}:${s.id}`}
                  label={s.label ?? s.id}
                  value={`${formatValue(s.values[hover])}${entry.panel.unit ? ` ${entry.panel.unit}` : ''}`}
                  color={s.color}
                />
              )),
            )}
            {wind && wind.speed[hover] != null && (
              <TooltipRow label="Wind" value={`${formatValue(wind.direction[hover], 0)}° / ${formatValue(wind.speed[hover], 0)} kt`} />
            )}
          </div>
        )}
      </div>
    </ChartFrame>
  );
}
