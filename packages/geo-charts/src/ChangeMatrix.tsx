import { useMemo, useState, type ReactNode } from 'react';
import { cx } from '@hridayanp/ui';
import { ChartFrame } from './ChartFrame';
import { estimateTextWidth, formatCompact, formatPercent } from './scales';

/** A class on one axis of the matrix. */
export interface MatrixClass {
  label: string;
  /** Colour this class is drawn with on the map, used for the axis keys. */
  color: string;
}

export interface ChangeMatrixProps {
  /** Classes, in one order shared by both axes. */
  classes: readonly MatrixClass[];
  /** `values[from][to]` — the quantity converted from row class to column class. */
  values: readonly (readonly number[])[];
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Axis caption for the rows. Default `'From'`. */
  fromLabel?: string;
  /** Axis caption for the columns. Default `'To'`. */
  toLabel?: string;
  /** Unit for cell values. */
  unit?: string;
  /**
   * Exclude the diagonal from the colour scale. Default `true`.
   *
   * Persistence usually accounts for most of the area, so including it
   * compresses every conversion into the ramp's lightest step and the matrix
   * reads as empty. The diagonal is still drawn and still labelled — it is
   * simply not what the ramp is stretched across.
   */
  excludeDiagonal?: boolean;
  footnote?: ReactNode;
  className?: string;
}

const CELL = 46;
const GAP = 2;
const ROW_LABEL = 118;
const COLUMN_LABEL = 96;

/**
 * A class transition matrix — what became what, between two epochs.
 *
 * Rows are the earlier class, columns the later one, so the diagonal is
 * persistence and everything off it is conversion. Reading across a row shows
 * where a class went; reading down a column shows where a class came from.
 *
 * ```tsx
 * const matrix = transitionMatrix(epoch2017, epoch2024, LAND_COVER);
 *
 * <ChangeMatrix
 *   title="Land-cover transitions, 2017 → 2024"
 *   unit="km²"
 *   classes={matrix.classes}
 *   values={matrix.areaKm2}
 * />
 * ```
 *
 * ### Encoding
 *
 * Cell colour encodes magnitude, so it is a **single-hue ramp with monotone
 * lightness**. A multi-hue ramp has no perceptual ordering — a reader cannot say
 * whether green means more than orange without consulting the legend for every
 * cell, which is precisely the work encoding magnitude as colour is meant to
 * save.
 *
 * Class identity lives on the axes, where each label carries the colour the map
 * paints that class. Colouring the *cells* by class would put two encodings on
 * one channel and leave magnitude unreadable.
 *
 * Exact values sit in the cells wherever they fit, and in the table view
 * regardless, so no value is reachable only by matching a shade to a legend.
 */
export function ChangeMatrix({
  classes,
  values,
  title,
  subtitle,
  fromLabel = 'From',
  toLabel = 'To',
  unit,
  excludeDiagonal = true,
  footnote,
  className,
}: ChangeMatrixProps) {
  const [hovered, setHovered] = useState<[number, number] | null>(null);

  const { max, total } = useMemo(() => {
    let maximum = 0;
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      for (let j = 0; j < (values[i]?.length ?? 0); j++) {
        const value = values[i]![j] ?? 0;
        sum += value;
        if (excludeDiagonal && i === j) continue;
        if (value > maximum) maximum = value;
      }
    }
    return { max: maximum || 1, total: sum };
  }, [values, excludeDiagonal]);

  const size = classes.length;
  const width = ROW_LABEL + size * (CELL + GAP);
  const height = COLUMN_LABEL + size * (CELL + GAP);
  const format = (value: number) => formatCompact(value, max);

  const columns = [
    { key: 'from', header: fromLabel, numeric: false },
    ...classes.map((klass) => ({
      key: klass.label,
      header: unit ? `${klass.label} (${unit})` : klass.label,
    })),
  ];

  const rows = classes.map((klass, i) => {
    const row: Record<string, ReactNode> = { from: klass.label };
    classes.forEach((target, j) => {
      const value = values[i]?.[j] ?? 0;
      row[target.label] = value > 0 ? format(value) : '—';
    });
    return row;
  });

  return (
    <ChartFrame
      {...(title ? { title } : {})}
      {...(subtitle ? { subtitle } : {})}
      columns={columns}
      rows={rows}
      footnote={
        footnote ?? (
          <>
            Rows are the earlier class, columns the later one. The diagonal is
            unchanged area
            {excludeDiagonal ? ' and is excluded from the colour scale' : ''}.
          </>
        )
      }
      {...(className ? { className } : {})}
    >
      <div className="gcl-chart__matrix-wrap">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="gcl-chart__svg gcl-chart__matrix"
          role="img"
          aria-label={
            typeof title === 'string' ? title : 'Class transition matrix'
          }
          style={{ maxWidth: width }}
        >
          <text
            x={ROW_LABEL}
            y={14}
            className="gcl-chart__axis-label"
            textAnchor="start"
          >
            {toLabel} →
          </text>

          {classes.map((klass, j) => (
            <g
              key={`col-${klass.label}`}
              transform={`translate(${ROW_LABEL + j * (CELL + GAP) + CELL / 2}, ${COLUMN_LABEL - 8})`}
            >
              <circle cy={-2} r={3.5} fill={klass.color} />
              <text
                transform="rotate(-45)"
                x={8}
                y={-8}
                className="gcl-chart__row-label"
                textAnchor="start"
              >
                {klass.label}
              </text>
            </g>
          ))}

          {classes.map((rowClass, i) => (
            <g key={`row-${rowClass.label}`}>
              <circle
                cx={12}
                cy={COLUMN_LABEL + i * (CELL + GAP) + CELL / 2}
                r={3.5}
                fill={rowClass.color}
              />
              <text
                x={ROW_LABEL - 14}
                y={COLUMN_LABEL + i * (CELL + GAP) + CELL / 2}
                dy="0.32em"
                textAnchor="end"
                className="gcl-chart__row-label"
              >
                {rowClass.label}
              </text>

              {classes.map((columnClass, j) => {
                const value = values[i]?.[j] ?? 0;
                const diagonal = i === j;
                const intensity =
                  excludeDiagonal && diagonal ? 0 : Math.min(1, value / max);
                // Six discrete steps rather than a continuous interpolation:
                // adjacent shades stay separable, and each step is a validated
                // colour with a matching ink token.
                const step =
                  value <= 0 ? -1 : Math.min(5, Math.floor(intensity * 5.999));

                const text = format(value);
                const fits = value > 0 && estimateTextWidth(text, 10) < CELL - 8;
                const active = hovered?.[0] === i && hovered?.[1] === j;

                return (
                  <g
                    key={columnClass.label}
                    onPointerEnter={() => setHovered([i, j])}
                    onPointerLeave={() => setHovered(null)}
                  >
                    <rect
                      x={ROW_LABEL + j * (CELL + GAP)}
                      y={COLUMN_LABEL + i * (CELL + GAP)}
                      width={CELL}
                      height={CELL}
                      rx={3}
                      className={cx(
                        'gcl-chart__cell',
                        step < 0 && 'gcl-chart__cell--empty',
                        diagonal && 'gcl-chart__cell--diagonal',
                        active && 'is-hovered',
                      )}
                      {...(step >= 0
                        ? { fill: `var(--gcl-viz-seq-${step})` }
                        : {})}
                    />
                    {fits && (
                      <text
                        x={ROW_LABEL + j * (CELL + GAP) + CELL / 2}
                        y={COLUMN_LABEL + i * (CELL + GAP) + CELL / 2}
                        dy="0.32em"
                        textAnchor="middle"
                        className="gcl-chart__cell-value"
                        {...(step >= 0
                          ? { fill: `var(--gcl-viz-seq-${step}-ink)` }
                          : {})}
                      >
                        {text}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          ))}
        </svg>

        <div className="gcl-chart__scale" aria-hidden="true">
          <span className="gcl-chart__scale-label">0</span>
          <span className="gcl-chart__scale-ramp" />
          <span className="gcl-chart__scale-label">
            {format(max)}
            {unit ? ` ${unit}` : ''}
          </span>
        </div>

        {hovered && (
          <p className="gcl-chart__matrix-readout" role="status">
            <strong>{classes[hovered[0]]?.label}</strong> →{' '}
            <strong>{classes[hovered[1]]?.label}</strong>
            {': '}
            {format(values[hovered[0]]?.[hovered[1]] ?? 0)}
            {unit ? ` ${unit}` : ''}
            {total > 0
              ? ` · ${formatPercent((values[hovered[0]]?.[hovered[1]] ?? 0) / total)} of compared area`
              : ''}
          </p>
        )}
      </div>
    </ChartFrame>
  );
}
