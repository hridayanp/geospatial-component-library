import { useMemo, useState, type ReactNode } from 'react';
import { ChartFrame, niceTicks } from '@hridayanp/geo-charts';
import { colorAt, type ColorScaleInput } from '@hridayanp/raster-utils';
import { formatValue } from './format';
import { TooltipRow } from './SkewTChart';
import { windToUV } from './wind';

/** One wind level on the hodograph. */
export interface HodographLevel {
  /** Wind speed, in the chart's unit. */
  speed: number;
  /** Direction the wind blows from, degrees. */
  direction: number;
  /** Height (m) or pressure (hPa) — whatever orders the profile. Used for colour and labels. */
  level: number;
  /** Optional point label, e.g. `"3 km"`. */
  label?: string;
}

export interface HodographProps {
  /** Levels ordered from the surface upward. */
  levels: readonly HodographLevel[];
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Unit of `speed`, for rings and the table. Default `'kt'`. */
  unit?: string;
  /** Outer ring speed. Default: rounded up from the strongest wind. */
  maxSpeed?: number;
  /**
   * Colour the trace by `level` — the usual 0–3 / 3–6 / 6–9 km banding, or a
   * continuous ramp. Default: a sequential ramp from surface to top.
   */
  colorScale?: ColorScaleInput;
  /** Mark and label each level. Default `true`. */
  showPoints?: boolean;
  /** Plot size in viewBox units. Default `360`. */
  size?: number;
  footnote?: ReactNode;
  className?: string;
}

const DEFAULT_RAMP = ['#1baf7a', '#eda100', '#e34948', '#4a3aa7'];

/**
 * A hodograph: the wind profile traced as the tip of each level's wind vector.
 *
 * Curvature shows directional shear, length shows speed shear — the two
 * ingredients of storm organisation that a single wind barb column hides.
 * Rings mark speed; the trace is coloured from the surface upward.
 *
 * ```tsx
 * <Hodograph levels={profile.map((l) => ({ speed: l.ws, direction: l.wd, level: l.height }))} />
 * ```
 */
export function Hodograph({
  levels,
  title,
  subtitle,
  unit = 'kt',
  maxSpeed,
  colorScale = DEFAULT_RAMP,
  showPoints = true,
  size = 360,
  footnote,
  className,
}: HodographProps) {
  const [hover, setHover] = useState<number | null>(null);
  const valid = useMemo(
    () => levels.filter((l) => Number.isFinite(l.speed) && Number.isFinite(l.direction)),
    [levels],
  );

  const strongest = Math.max(10, ...valid.map((l) => l.speed));
  const outer = maxSpeed ?? (niceTicks([0, strongest * 1.05], 4).at(-1) ?? strongest);
  const rings = niceTicks([0, outer], 4).filter((r) => r > 0);
  const pad = 22;
  const radius = size / 2 - pad;
  const scale = radius / outer;
  const centre = size / 2;

  const points = valid.map((level) => {
    const [u, v] = windToUV(level.speed, level.direction);
    return { level, x: centre + u * scale, y: centre - v * scale };
  });

  const lo = Math.min(...valid.map((l) => l.level));
  const hi = Math.max(...valid.map((l) => l.level));
  const colorOf = (value: number) => colorAt(colorScale, hi > lo ? (value - lo) / (hi - lo) : 0);

  const columns = [
    { key: 'level', header: 'Level', numeric: false },
    { key: 'dir', header: 'Direction (°)' },
    { key: 'speed', header: `Speed (${unit})` },
  ];
  const rows = valid.map((l) => ({
    level: l.label ?? formatValue(l.level, 0),
    dir: formatValue(l.direction, 0),
    speed: formatValue(l.speed, 0),
  }));

  const hovered = hover != null ? points[hover] : undefined;

  return (
    <ChartFrame
      {...(title ? { title } : {})}
      {...(subtitle ? { subtitle } : {})}
      columns={columns}
      rows={rows}
      {...(footnote ? { footnote } : {})}
      className={['gcl-met', className].filter(Boolean).join(' ')}
    >
      <div className="gcl-chart__plot gcl-met__square">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="gcl-chart__svg"
          role="img"
          aria-label={typeof title === 'string' ? title : 'Hodograph'}
          onPointerLeave={() => setHover(null)}
        >
          {rings.map((ring) => (
            <g key={ring}>
              <circle cx={centre} cy={centre} r={ring * scale} className="gcl-met__ring" />
              <text x={centre + ring * scale * 0.707 + 2} y={centre - ring * scale * 0.707 - 2} className="gcl-chart__tick">
                {ring}
              </text>
            </g>
          ))}
          <line x1={centre - radius} x2={centre + radius} y1={centre} y2={centre} className="gcl-chart__grid" />
          <line x1={centre} x2={centre} y1={centre - radius} y2={centre + radius} className="gcl-chart__grid" />
          <text x={centre} y={pad - 8} textAnchor="middle" className="gcl-chart__axis-label">N</text>
          <text x={size - pad + 10} y={centre} dy="0.32em" textAnchor="middle" className="gcl-chart__axis-label">E</text>

          {points.slice(1).map((point, i) => {
            const previous = points[i]!;
            return (
              <line
                key={`seg${i}`}
                x1={previous.x}
                y1={previous.y}
                x2={point.x}
                y2={point.y}
                stroke={colorOf((previous.level.level + point.level.level) / 2)}
                className="gcl-chart__line gcl-met__hodo-segment"
              />
            );
          })}

          {showPoints &&
            points.map((point, index) => (
              <g key={`pt${index}`} onPointerEnter={() => setHover(index)}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={hover === index ? 5 : 3.5}
                  fill={colorOf(point.level.level)}
                  className="gcl-chart__marker"
                />
                {point.level.label && (
                  <text x={point.x + 6} y={point.y - 6} className="gcl-chart__tick">
                    {point.level.label}
                  </text>
                )}
              </g>
            ))}
        </svg>
        {hovered && (
          <div
            className="gcl-chart__tooltip"
            style={{ left: `${(hovered.x / size) * 100}%`, top: `${(hovered.y / size) * 100}%` }}
          >
            <div className="gcl-chart__tooltip-title">{hovered.level.label ?? formatValue(hovered.level.level, 0)}</div>
            <TooltipRow label="Wind" value={`${formatValue(hovered.level.direction, 0)}° / ${formatValue(hovered.level.speed, 0)} ${unit}`} />
          </div>
        )}
      </div>
    </ChartFrame>
  );
}
