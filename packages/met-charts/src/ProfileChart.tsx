import { useRef, useState, type ReactNode } from 'react';
import {
  ChartFrame,
  formatCompact,
  linearScale,
  niceDomain,
  niceTicks,
} from '@hridayanp/geo-charts';
import { formatValue } from './format';
import { TooltipRow } from './SkewTChart';
import type { ProfileSample } from './statistics';

export interface ProfileChartProps {
  /** Samples along the line, e.g. from `profileAlongPath`. */
  samples: readonly Pick<ProfileSample, 'distanceKm' | 'value'>[];
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Value axis label, including the unit. */
  yLabel?: string;
  unit?: string;
  /** Line and fill colour. Default `'#2a78d6'`. */
  color?: string;
  /** Shade beneath the line — terrain, rainfall. Default `true`. */
  fill?: boolean;
  /** Fixed value range. Default fits the data. */
  domain?: [number, number];
  /** Fired with the sample under the pointer, `null` on leave — link it to a map marker. */
  onHoverSample?: (index: number | null) => void;
  /** Plot height in viewBox units. Default `200`. */
  height?: number;
  footnote?: ReactNode;
  className?: string;
}

const VIEW_WIDTH = 720;
const MARGIN = { top: 12, right: 18, bottom: 32, left: 56 };

/**
 * A profile of one value along a line drawn on the map — terrain, rainfall or
 * temperature against distance.
 *
 * Distance is great-circle distance, so the horizontal axis is honest however
 * long or oblique the line. Gaps in the data (NoData) break the line rather
 * than being bridged.
 *
 * ```tsx
 * const samples = profileAlongPath(raster, drawnLine);
 * <ProfileChart samples={samples} yLabel="Rain (mm)" onHoverSample={(i) => setCursor(i == null ? null : samples[i].lngLat)} />
 * ```
 */
export function ProfileChart({
  samples,
  title,
  subtitle,
  yLabel,
  unit,
  color = '#2a78d6',
  fill = true,
  domain,
  onHoverSample,
  height = 200,
  footnote,
  className,
}: ProfileChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const plotWidth = VIEW_WIDTH - MARGIN.left - MARGIN.right;
  const distances = samples.map((s) => s.distanceKm);
  const values = samples.map((s) => s.value).filter((v): v is number => v != null && Number.isFinite(v));
  const x = linearScale([0, Math.max(1e-6, distances[distances.length - 1] ?? 1)], [0, plotWidth]);
  const yDomain = domain ?? niceDomain(values, { includeZero: false });
  const y = linearScale(yDomain, [height, 0]);
  const span = Math.abs(yDomain[1] - yDomain[0]);

  const segments: string[] = [];
  let current = '';
  samples.forEach((sample) => {
    if (sample.value == null || !Number.isFinite(sample.value)) {
      if (current) segments.push(current);
      current = '';
      return;
    }
    current += `${current ? 'L' : 'M'}${x(sample.distanceKm).toFixed(1)} ${y(sample.value).toFixed(1)}`;
  });
  if (current) segments.push(current);

  const baseline = y(yDomain[0]);

  const pick = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg || samples.length === 0) return null;
    const rect = svg.getBoundingClientRect();
    const km = x.invert(((clientX - rect.left) / rect.width) * VIEW_WIDTH - MARGIN.left);
    let best = 0;
    samples.forEach((s, i) => {
      if (Math.abs(s.distanceKm - km) < Math.abs(samples[best]!.distanceKm - km)) best = i;
    });
    return best;
  };

  const hovered = hover != null ? samples[hover] : undefined;
  const format = (v: number) => formatCompact(v, span);

  return (
    <ChartFrame
      {...(title ? { title } : {})}
      {...(subtitle ? { subtitle } : {})}
      columns={[
        { key: 'd', header: 'Distance (km)', numeric: false },
        { key: 'v', header: unit ? `Value (${unit})` : 'Value' },
      ]}
      rows={samples.map((s) => ({ d: formatValue(s.distanceKm, 1), v: formatValue(s.value, 2) }))}
      {...(footnote ? { footnote } : {})}
      className={['gcl-met', className].filter(Boolean).join(' ')}
    >
      <div className="gcl-chart__plot">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_WIDTH} ${height + MARGIN.top + MARGIN.bottom}`}
          className="gcl-chart__svg"
          role="img"
          aria-label={typeof title === 'string' ? title : 'Profile along a line'}
          onPointerMove={(event) => {
            const index = pick(event.clientX);
            setHover(index);
            onHoverSample?.(index);
          }}
          onPointerLeave={() => {
            setHover(null);
            onHoverSample?.(null);
          }}
        >
          <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
            {niceTicks(yDomain, 5).map((tick) => (
              <g key={tick}>
                <line x1={0} x2={plotWidth} y1={y(tick)} y2={y(tick)} className="gcl-chart__grid" />
                <text x={-8} y={y(tick)} dy="0.32em" textAnchor="end" className="gcl-chart__tick">
                  {format(tick)}
                </text>
              </g>
            ))}
            {niceTicks(x.domain, 6).map((tick) => (
              <text key={tick} x={x(tick)} y={height + 18} textAnchor="middle" className="gcl-chart__tick">
                {formatCompact(tick, x.domain[1])}
              </text>
            ))}
            {fill &&
              segments.map((d, i) => {
                const start = /^M([\d.-]+)/.exec(d)?.[1];
                const end = /([\d.-]+) [\d.-]+$/.exec(d)?.[1];
                return (
                  <path key={`f${i}`} d={`${d}L${end} ${baseline}L${start} ${baseline}Z`} fill={color} className="gcl-chart__band" />
                );
              })}
            {segments.map((d, i) => (
              <path key={`l${i}`} d={d} stroke={color} className="gcl-chart__line" />
            ))}
            {hovered && (
              <>
                <line x1={x(hovered.distanceKm)} x2={x(hovered.distanceKm)} y1={0} y2={height} className="gcl-chart__crosshair" />
                {hovered.value != null && (
                  <circle cx={x(hovered.distanceKm)} cy={y(hovered.value)} r={4.5} fill={color} className="gcl-chart__marker" />
                )}
              </>
            )}
          </g>
          {yLabel && (
            <text transform={`translate(12, ${MARGIN.top + height / 2}) rotate(-90)`} textAnchor="middle" className="gcl-chart__axis-label">
              {yLabel}
            </text>
          )}
          <text x={MARGIN.left + plotWidth / 2} y={height + MARGIN.top + MARGIN.bottom - 1} textAnchor="middle" className="gcl-chart__axis-label">
            Distance (km)
          </text>
        </svg>
        {hovered && (
          <div
            className={['gcl-chart__tooltip', x(hovered.distanceKm) > plotWidth * 0.6 ? 'gcl-chart__tooltip--left' : ''].join(' ')}
            style={{ left: `${((MARGIN.left + x(hovered.distanceKm)) / VIEW_WIDTH) * 100}%` }}
          >
            <div className="gcl-chart__tooltip-title">{formatValue(hovered.distanceKm, 1)} km</div>
            <TooltipRow label="Value" value={`${formatValue(hovered.value, 2)}${unit ? ` ${unit}` : ''}`} color={color} />
          </div>
        )}
      </div>
    </ChartFrame>
  );
}
