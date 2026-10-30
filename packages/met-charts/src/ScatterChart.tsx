import { useMemo, useState, type ReactNode } from 'react';
import { ChartFrame, formatCompact, linearScale, niceDomain, niceTicks } from '@hridayanp/geo-charts';
import { formatValue } from './format';
import { TooltipRow } from './SkewTChart';
import { verificationStats, type VerificationPair } from './statistics';

/** One point: an observation and the forecast for it. */
export interface ScatterPoint extends VerificationPair {
  /** Station, time or case identifier, shown on hover. */
  label?: string;
}

export interface ScatterChartProps {
  points: readonly ScatterPoint[];
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Unit of both axes. */
  unit?: string;
  /** Axis labels. Default `'Observed'` and `'Forecast'`. */
  xLabel?: string;
  yLabel?: string;
  /** Draw the 1:1 line of a perfect forecast. Default `true`. */
  showIdentity?: boolean;
  /** Draw the least-squares fit. Default `true`. */
  showFit?: boolean;
  /** Print n, bias, MAE, RMSE and r beneath the chart. Default `true`. */
  showStats?: boolean;
  /** Point colour. Default `'#2a78d6'`. */
  color?: string;
  /** Plot size in viewBox units. Default `360`. */
  size?: number;
  footnote?: ReactNode;
  className?: string;
}

/**
 * Forecast against observation, for verification.
 *
 * Both axes share one range so the 1:1 line runs corner to corner at 45°:
 * points above it were over-forecast, below it under-forecast. The fitted line
 * shows conditional bias — a slope below one is a forecast that is too timid
 * at the extremes — and the scores summarise the sample.
 */
export function ScatterChart({
  points,
  title,
  subtitle,
  unit,
  xLabel = 'Observed',
  yLabel = 'Forecast',
  showIdentity = true,
  showFit = true,
  showStats = true,
  color = '#2a78d6',
  size = 360,
  footnote,
  className,
}: ScatterChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const valid = useMemo(
    () => points.filter((p) => Number.isFinite(p.observed) && Number.isFinite(p.forecast)),
    [points],
  );
  const stats = useMemo(() => verificationStats(valid), [valid]);

  const margin = { top: 10, right: 12, bottom: 40, left: 52 };
  const plot = size - Math.max(margin.left + margin.right, margin.top + margin.bottom);
  const domain = niceDomain(valid.flatMap((p) => [p.observed, p.forecast]), { includeZero: false });
  const x = linearScale(domain, [0, plot]);
  const y = linearScale(domain, [plot, 0]);
  const ticks = niceTicks(domain, 5);
  const span = Math.abs(domain[1] - domain[0]);
  const u = unit ? ` ${unit}` : '';

  const fitLine =
    showFit && Number.isFinite(stats.slope)
      ? ([domain[0], domain[1]].map((o) => [o, stats.slope * o + stats.intercept]) as [number, number][])
      : null;

  const hovered = hover != null ? valid[hover] : undefined;

  const statsLine = showStats && stats.n > 0
    ? `n ${stats.n} · bias ${formatValue(stats.bias, 2)}${u} · MAE ${formatValue(stats.mae, 2)}${u} · RMSE ${formatValue(stats.rmse, 2)}${u} · r ${formatValue(stats.r, 3)}`
    : null;

  return (
    <ChartFrame
      {...(title ? { title } : {})}
      subtitle={subtitle ?? statsLine ?? undefined}
      columns={[
        { key: 'label', header: 'Case', numeric: false },
        { key: 'o', header: `${xLabel}${unit ? ` (${unit})` : ''}` },
        { key: 'f', header: `${yLabel}${unit ? ` (${unit})` : ''}` },
        { key: 'e', header: 'Error' },
      ]}
      rows={valid.map((p, i) => ({
        label: p.label ?? String(i + 1),
        o: formatValue(p.observed, 2),
        f: formatValue(p.forecast, 2),
        e: formatValue(p.forecast - p.observed, 2),
      }))}
      {...(footnote ? { footnote } : {})}
      className={['gcl-met', className].filter(Boolean).join(' ')}
    >
      <div className="gcl-chart__plot gcl-met__square">
        <svg
          viewBox={`0 0 ${plot + margin.left + margin.right} ${plot + margin.top + margin.bottom}`}
          className="gcl-chart__svg"
          role="img"
          aria-label={typeof title === 'string' ? title : 'Forecast against observation'}
          onPointerLeave={() => setHover(null)}
        >
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={0} x2={plot} y1={y(tick)} y2={y(tick)} className="gcl-chart__grid" />
                <line x1={x(tick)} x2={x(tick)} y1={0} y2={plot} className="gcl-chart__grid" />
                <text x={-8} y={y(tick)} dy="0.32em" textAnchor="end" className="gcl-chart__tick">
                  {formatCompact(tick, span)}
                </text>
                <text x={x(tick)} y={plot + 16} textAnchor="middle" className="gcl-chart__tick">
                  {formatCompact(tick, span)}
                </text>
              </g>
            ))}
            {showIdentity && (
              <line x1={x(domain[0])} y1={y(domain[0])} x2={x(domain[1])} y2={y(domain[1])} className="gcl-met__identity" />
            )}
            {fitLine && (
              <line
                x1={x(fitLine[0]![0])}
                y1={y(fitLine[0]![1])}
                x2={x(fitLine[1]![0])}
                y2={y(fitLine[1]![1])}
                stroke={color}
                className="gcl-chart__line gcl-chart__line--projected"
              />
            )}
            {valid.map((p, i) => (
              <circle
                key={i}
                cx={x(p.observed)}
                cy={y(p.forecast)}
                r={hover === i ? 5 : 3.5}
                fill={color}
                fillOpacity={0.7}
                className="gcl-met__point"
                onPointerEnter={() => setHover(i)}
              />
            ))}
          </g>
          <text transform={`translate(12, ${margin.top + plot / 2}) rotate(-90)`} textAnchor="middle" className="gcl-chart__axis-label">
            {yLabel}
          </text>
          <text x={margin.left + plot / 2} y={plot + margin.top + margin.bottom - 6} textAnchor="middle" className="gcl-chart__axis-label">
            {xLabel}
          </text>
        </svg>
        {hovered && (
          <div
            className="gcl-chart__tooltip"
            style={{
              left: `${((margin.left + x(hovered.observed)) / (plot + margin.left + margin.right)) * 100}%`,
              top: `${((margin.top + y(hovered.forecast)) / (plot + margin.top + margin.bottom)) * 100}%`,
            }}
          >
            {hovered.label && <div className="gcl-chart__tooltip-title">{hovered.label}</div>}
            <TooltipRow label={xLabel} value={`${formatValue(hovered.observed, 2)}${u}`} />
            <TooltipRow label={yLabel} value={`${formatValue(hovered.forecast, 2)}${u}`} />
            <TooltipRow label="Error" value={`${formatValue(hovered.forecast - hovered.observed, 2)}${u}`} />
          </div>
        )}
      </div>
    </ChartFrame>
  );
}
