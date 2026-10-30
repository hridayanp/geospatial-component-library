import { useMemo, useState, type ReactNode } from 'react';
import { COMPASS_16 } from '@hridayanp/geo-utils';
import { ChartFrame, formatPercent, niceTicks } from '@hridayanp/geo-charts';
import { sampleColorScale, type ColorScaleInput } from '@hridayanp/raster-utils';
import { TooltipRow } from './SkewTChart';
import {
  windRoseBins,
  type WindRoseData,
  type WindRoseOptions,
  type WindSample,
} from './wind';

export interface WindRoseProps extends WindRoseOptions {
  /** Raw observations, binned with `windRoseBins`. Ignored when `data` is given. */
  samples?: readonly WindSample[];
  /** Pre-binned frequencies, e.g. computed on a server over years of data. */
  data?: WindRoseData;
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Speed unit for the legend. Default `'kt'`. */
  unit?: string;
  /** Colours for the speed classes, light to dark. Default a sequential blue ramp. */
  colorScale?: ColorScaleInput;
  /** Plot size in viewBox units. Default `360`. */
  size?: number;
  footnote?: ReactNode;
  className?: string;
}

const DEFAULT_RAMP = ['#cde2fb', '#6da7ec', '#256abf', '#104281', '#0b1f45'];

/**
 * A wind rose: how often the wind blows from each direction, split by speed.
 *
 * Each petal points to where the wind comes **from**; its length is the share
 * of time, stacked by speed class from calm outward. Calms have no direction
 * and are printed in the centre rather than spread across the petals.
 *
 * ```tsx
 * <WindRose samples={hourly.map((h) => ({ direction: h.wd, speed: h.ws }))} speedBins={[0, 5, 10, 20, 30]} />
 * ```
 */
export function WindRose({
  samples,
  data,
  sectors,
  speedBins,
  calmBelow,
  title,
  subtitle,
  unit = 'kt',
  colorScale = DEFAULT_RAMP,
  size = 360,
  footnote,
  className,
}: WindRoseProps) {
  const [hover, setHover] = useState<{ sector: number; speedClass: number } | null>(null);

  const rose = useMemo(
    () =>
      data ??
      windRoseBins(samples ?? [], {
        ...(sectors != null ? { sectors } : {}),
        ...(speedBins ? { speedBins } : {}),
        ...(calmBelow != null ? { calmBelow } : {}),
      }),
    [data, samples, sectors, speedBins, calmBelow],
  );

  const colors = sampleColorScale(colorScale, rose.speedBins.length);
  const totals = rose.frequencies.map((row) => row.reduce((sum, f) => sum + f, 0));
  const largest = Math.max(0.01, ...totals);
  const rings = niceTicks([0, largest], 4).filter((r) => r > 0);
  const outer = Math.max(largest, rings.at(-1) ?? largest);

  const pad = 26;
  const centre = size / 2;
  const radius = size / 2 - pad;
  const inner = radius * 0.08;
  const r = (fraction: number) => inner + (fraction / outer) * (radius - inner);
  const width = (Math.PI * 2) / rose.sectors;
  const gap = width * 0.08;

  const wedge = (sector: number, from: number, to: number) => {
    const a0 = sector * width - width / 2 + gap / 2 - Math.PI / 2;
    const a1 = sector * width + width / 2 - gap / 2 - Math.PI / 2;
    const r0 = r(from);
    const r1 = r(to);
    const p = (radiusValue: number, angle: number) =>
      `${(centre + radiusValue * Math.cos(angle)).toFixed(2)} ${(centre + radiusValue * Math.sin(angle)).toFixed(2)}`;
    return `M${p(r0, a0)} L${p(r1, a0)} A${r1} ${r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`;
  };

  const classLabel = (i: number) => {
    const low = rose.speedBins[i]!;
    const high = rose.speedBins[i + 1];
    return high != null ? `${low}–${high} ${unit}` : `≥ ${low} ${unit}`;
  };

  const sectorLabel = (i: number) =>
    rose.sectors === 16 ? COMPASS_16[i]! : `${Math.round((i * 360) / rose.sectors)}°`;

  const columns = [
    { key: 'sector', header: 'From', numeric: false },
    ...rose.speedBins.map((_, i) => ({ key: `c${i}`, header: classLabel(i) })),
    { key: 'total', header: 'Total' },
  ];
  const rows = rose.frequencies.map((row, sector) => {
    const entry: Record<string, ReactNode> = { sector: sectorLabel(sector), total: formatPercent(totals[sector]!) };
    row.forEach((f, i) => {
      entry[`c${i}`] = formatPercent(f);
    });
    return entry;
  });

  const hoveredFraction = hover ? rose.frequencies[hover.sector]![hover.speedClass]! : 0;

  return (
    <ChartFrame
      {...(title ? { title } : {})}
      subtitle={subtitle ?? `${rose.total.toLocaleString()} observations · calm ${formatPercent(rose.calm)}`}
      legend={rose.speedBins.map((_, i) => ({ label: classLabel(i), color: colors[i]! }))}
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
          aria-label={typeof title === 'string' ? title : 'Wind rose'}
          onPointerLeave={() => setHover(null)}
        >
          {rings.map((ring) => (
            <g key={ring}>
              <circle cx={centre} cy={centre} r={r(ring)} className="gcl-met__ring" />
              <text x={centre + 3} y={centre - r(ring) - 2} className="gcl-chart__tick">
                {formatPercent(ring, 0)}
              </text>
            </g>
          ))}
          {rose.frequencies.map((row, sector) => {
            let cumulative = 0;
            return row.map((fraction, speedClass) => {
              if (fraction <= 0) return null;
              const from = cumulative;
              cumulative += fraction;
              return (
                <path
                  key={`${sector}-${speedClass}`}
                  d={wedge(sector, from, cumulative)}
                  fill={colors[speedClass]}
                  className="gcl-met__petal"
                  onPointerEnter={() => setHover({ sector, speedClass })}
                />
              );
            });
          })}
          <circle cx={centre} cy={centre} r={inner} className="gcl-met__calm" />
          {['N', 'E', 'S', 'W'].map((label, i) => {
            const angle = (i * Math.PI) / 2 - Math.PI / 2;
            return (
              <text
                key={label}
                x={centre + (radius + 13) * Math.cos(angle)}
                y={centre + (radius + 13) * Math.sin(angle)}
                dy="0.32em"
                textAnchor="middle"
                className="gcl-chart__axis-label"
              >
                {label}
              </text>
            );
          })}
        </svg>
        {hover && (
          <div className="gcl-chart__tooltip" style={{ left: '50%', top: 0 }}>
            <div className="gcl-chart__tooltip-title">From {sectorLabel(hover.sector)}</div>
            <TooltipRow label={classLabel(hover.speedClass)} value={formatPercent(hoveredFraction)} color={colors[hover.speedClass]!} />
            <TooltipRow label="All speeds" value={formatPercent(totals[hover.sector]!)} />
          </div>
        )}
      </div>
    </ChartFrame>
  );
}
