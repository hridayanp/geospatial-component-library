import { useMemo, useState, type ReactNode } from 'react';
import { cx } from '@hridayanp/ui';
import { ChartFrame } from './ChartFrame';
import { inkOn } from './palette';
import { estimateTextWidth, formatCompact, formatPercent } from './scales';

/** One class in a composition or change chart. */
export interface ClassAreaDatum {
  label: string;
  /** Colour this class is drawn with on the map. */
  color: string;
  /** Area, count or any non-negative magnitude. */
  value: number;
  /** Optional second-epoch value, enabling `mode="change"`. */
  compareValue?: number;
}

export interface ClassAreaChartProps {
  data: readonly ClassAreaDatum[];
  title?: ReactNode;
  subtitle?: ReactNode;
  /**
   * `'composition'` ranks classes by magnitude.
   * `'change'` plots the signed difference between `compareValue` and `value`,
   * diverging either side of zero.
   *
   * Default `'composition'`.
   */
  mode?: 'composition' | 'change';
  /** Unit shown on values. */
  unit?: string;
  /** Also show each class's share of the total. Default `true` in composition. */
  showShare?: boolean;
  /** Sort classes by magnitude rather than keeping table order. Default `true`. */
  sorted?: boolean;
  /** Label for the first epoch, used in the change legend and table. */
  beforeLabel?: string;
  /** Label for the second epoch. */
  afterLabel?: string;
  footnote?: ReactNode;
  className?: string;
}

const BAR_HEIGHT = 20;
const BAR_GAP = 10;
const LABEL_WIDTH = 132;
const VALUE_WIDTH = 96;
const VIEW_WIDTH = 720;

/**
 * Class composition, or the change in it between two epochs.
 *
 * Horizontal bars, because class names are words: rotating them under columns
 * costs the reader a head-tilt for no gain, and a horizontal bar leaves room for
 * a full label and its value on one line.
 *
 * Colour carries class identity and comes from the caller — pass the same
 * colours the map paints, so the chart and the map are one encoding.
 *
 * ```tsx
 * const areas = classAreas(landCover, LAND_COVER);
 *
 * <ClassAreaChart
 *   title="Land-cover composition"
 *   unit="km²"
 *   data={areas.classes.map((c) => ({ label: c.label, color: c.color, value: c.areaKm2 }))}
 * />
 * ```
 *
 * In `change` mode the bars diverge from a central zero: gains extend right,
 * losses left. A signed quantity plotted as unsigned magnitude — two bars of the
 * same length for a gain and a loss — is the standard way a change chart becomes
 * unreadable.
 */
export function ClassAreaChart({
  data,
  title,
  subtitle,
  mode = 'composition',
  unit,
  showShare,
  sorted = true,
  beforeLabel = 'Before',
  afterLabel = 'After',
  footnote,
  className,
}: ClassAreaChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const model = useMemo(() => {
    const rows = data.map((datum) => {
      const delta =
        datum.compareValue != null ? datum.compareValue - datum.value : 0;
      return { ...datum, delta };
    });

    const total = rows.reduce((sum, row) => sum + Math.max(0, row.value), 0);
    const magnitude =
      mode === 'change'
        ? Math.max(1e-9, ...rows.map((row) => Math.abs(row.delta)))
        : Math.max(1e-9, ...rows.map((row) => Math.max(0, row.value)));

    const ordered = sorted
      ? [...rows].sort((a, b) =>
          mode === 'change'
            ? Math.abs(b.delta) - Math.abs(a.delta)
            : b.value - a.value,
        )
      : rows;

    return { rows: ordered, total, magnitude };
  }, [data, mode, sorted]);

  const { rows, total, magnitude } = model;
  const trackWidth = VIEW_WIDTH - LABEL_WIDTH - VALUE_WIDTH;
  const plotHeight = Math.max(
    BAR_HEIGHT,
    rows.length * (BAR_HEIGHT + BAR_GAP) - BAR_GAP,
  );

  const span = mode === 'change' ? magnitude * 2 : magnitude;
  const format = (value: number) => formatCompact(value, span);
  const withShare = showShare ?? mode === 'composition';

  const columns =
    mode === 'change'
      ? [
          { key: 'label', header: 'Class', numeric: false },
          { key: 'before', header: unit ? `${beforeLabel} (${unit})` : beforeLabel },
          { key: 'after', header: unit ? `${afterLabel} (${unit})` : afterLabel },
          { key: 'delta', header: unit ? `Change (${unit})` : 'Change' },
        ]
      : [
          { key: 'label', header: 'Class', numeric: false },
          { key: 'value', header: unit ? `Area (${unit})` : 'Value' },
          { key: 'share', header: 'Share' },
        ];

  const tableRows = rows.map((row) =>
    mode === 'change'
      ? {
          label: row.label,
          before: format(row.value),
          after: format(row.compareValue ?? row.value),
          delta: `${row.delta >= 0 ? '+' : '−'}${format(Math.abs(row.delta))}`,
        }
      : {
          label: row.label,
          value: format(row.value),
          share: total > 0 ? formatPercent(row.value / total) : '—',
        },
  );

  // The zero line sits centre-track in change mode and at the left otherwise.
  const zeroX = mode === 'change' ? LABEL_WIDTH + trackWidth / 2 : LABEL_WIDTH;
  const scale = mode === 'change' ? trackWidth / 2 / magnitude : trackWidth / magnitude;

  return (
    <ChartFrame
      {...(title ? { title } : {})}
      {...(subtitle ? { subtitle } : {})}
      columns={columns}
      rows={tableRows}
      {...(footnote ? { footnote } : {})}
      {...(className ? { className } : {})}
    >
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${plotHeight + 24}`}
        className="gcl-chart__svg"
        role="img"
        aria-label={
          typeof title === 'string'
            ? title
            : mode === 'change'
              ? 'Change by class'
              : 'Composition by class'
        }
      >
        {mode === 'change' && (
          <line
            x1={zeroX}
            x2={zeroX}
            y1={0}
            y2={plotHeight}
            className="gcl-chart__grid"
          />
        )}

        {rows.map((row, index) => {
          const value = mode === 'change' ? row.delta : Math.max(0, row.value);
          const length = Math.abs(value) * scale;
          const top = index * (BAR_HEIGHT + BAR_GAP);
          const negative = mode === 'change' && value < 0;
          const barX = negative ? zeroX - length : zeroX;

          const text = `${format(Math.abs(value))}${unit ? ` ${unit}` : ''}`;
          const shareText =
            withShare && total > 0 ? ` · ${formatPercent(row.value / total)}` : '';
          const label = `${mode === 'change' && value >= 0 ? '+' : mode === 'change' ? '−' : ''}${text}${shareText}`;

          // Only set a value inside the bar when it genuinely fits; otherwise it
          // is placed past the bar end. Clipping the label would be worse than
          // moving it.
          const fitsInside =
            length > estimateTextWidth(label, 11) + 20 && !negative;

          return (
            <g
              key={row.label}
              onPointerEnter={() => setHovered(row.label)}
              onPointerLeave={() => setHovered(null)}
              className={cx(
                'gcl-chart__bar-row',
                hovered === row.label && 'is-hovered',
              )}
            >
              {/* A full-width hit target, so hovering a short bar does not
                  require landing on the bar itself. */}
              <rect
                x={0}
                y={top - BAR_GAP / 2}
                width={VIEW_WIDTH}
                height={BAR_HEIGHT + BAR_GAP}
                fill="transparent"
              />

              <text
                x={LABEL_WIDTH - 12}
                y={top + BAR_HEIGHT / 2}
                dy="0.32em"
                textAnchor="end"
                className="gcl-chart__row-label"
              >
                {row.label}
              </text>

              <rect
                x={barX}
                y={top}
                width={Math.max(1, length)}
                height={BAR_HEIGHT}
                rx={4}
                fill={row.color}
                className="gcl-chart__bar"
              />

              <text
                x={
                  fitsInside
                    ? barX + length - 10
                    : negative
                      ? barX - 10
                      : barX + length + 10
                }
                y={top + BAR_HEIGHT / 2}
                dy="0.32em"
                textAnchor={fitsInside || negative ? 'end' : 'start'}
                className={cx(
                  'gcl-chart__bar-value',
                  fitsInside && 'gcl-chart__bar-value--inside',
                )}
                {...(fitsInside ? { fill: inkOn(row.color) } : {})}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}
