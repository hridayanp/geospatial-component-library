import { useId, useState, type ReactNode } from 'react';
import { cx } from '@hridayanp/ui';

/** One entry in a chart legend. */
export interface LegendEntry {
  label: string;
  color: string;
  /** Renders a dashed key instead of a solid one — used for projected series. */
  dashed?: boolean;
}

/** Column definition for the table view. */
export interface TableColumn {
  key: string;
  header: string;
  /** Right-align and apply tabular figures. Default `true` for numbers. */
  numeric?: boolean;
}

export interface ChartFrameProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Shown when two or more series are plotted. */
  legend?: readonly LegendEntry[];
  /** Column definitions for the table view. */
  columns?: readonly TableColumn[];
  /** Rows for the table view, keyed by column `key`. */
  rows?: ReadonlyArray<Record<string, ReactNode>>;
  /** Caption beneath the figure — the source, the method, the caveat. */
  footnote?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Shared shell for every chart: heading, legend, table view and caption.
 *
 * The table view is not an optional extra. A chart encodes values as position
 * and colour, both of which are unavailable to a screen-reader user and
 * unreliable for a reader with a colour vision deficiency; the table is the
 * accessible equivalent, and it is also what makes an exact value readable
 * without hovering. Every chart in this package ships one, and the toggle is
 * keyboard-reachable.
 *
 * The figure is announced as a `figure` with its title as the accessible name,
 * so the chart is one navigable landmark rather than a run of unlabelled
 * graphics.
 */
export function ChartFrame({
  title,
  subtitle,
  legend,
  columns,
  rows,
  footnote,
  className,
  children,
}: ChartFrameProps) {
  const [showTable, setShowTable] = useState(false);
  const titleId = useId();
  const tableId = useId();

  const hasTable = Boolean(columns?.length && rows?.length);
  // A single series needs no legend box: the title already names what is
  // plotted, and one swatch restates it.
  const showLegend = (legend?.length ?? 0) > 1;

  return (
    <figure
      className={cx('gcl-chart', className)}
      {...(title ? { 'aria-labelledby': titleId } : {})}
    >
      {(title || subtitle || hasTable) && (
        <div className="gcl-chart__head">
          <div className="gcl-chart__titles">
            {title && (
              <figcaption className="gcl-chart__title" id={titleId}>
                {title}
              </figcaption>
            )}
            {subtitle && <p className="gcl-chart__subtitle">{subtitle}</p>}
          </div>
          {hasTable && (
            <button
              type="button"
              className="gcl-button gcl-button--sm gcl-button--outline"
              aria-expanded={showTable}
              aria-controls={tableId}
              onClick={() => setShowTable((open) => !open)}
            >
              {showTable ? 'Chart' : 'Table'}
            </button>
          )}
        </div>
      )}

      {showLegend && (
        <ul className="gcl-chart__legend">
          {legend!.map((entry) => (
            <li key={entry.label} className="gcl-chart__legend-item">
              <span
                className={cx(
                  'gcl-chart__key',
                  entry.dashed && 'gcl-chart__key--dashed',
                )}
                style={{ color: entry.color }}
                aria-hidden="true"
              />
              {entry.label}
            </li>
          ))}
        </ul>
      )}

      <div className="gcl-chart__body" id={tableId}>
        {showTable && hasTable ? (
          <DataTable columns={columns!} rows={rows!} />
        ) : (
          children
        )}
      </div>

      {footnote && <p className="gcl-chart__footnote">{footnote}</p>}
    </figure>
  );
}

/** The accessible equivalent of a chart: every plotted value, as text. */
export function DataTable({
  columns,
  rows,
}: {
  columns: readonly TableColumn[];
  rows: ReadonlyArray<Record<string, ReactNode>>;
}) {
  return (
    <div className="gcl-chart__table-wrap">
      <table className="gcl-chart__table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cx(
                  column.numeric !== false && 'gcl-chart__cell--numeric',
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row[columns[0]!.key] ?? index)}>
              {columns.map((column, columnIndex) => {
                const content = row[column.key] ?? '—';
                const numeric = column.numeric !== false && columnIndex > 0;
                return columnIndex === 0 ? (
                  <th key={column.key} scope="row">
                    {content}
                  </th>
                ) : (
                  <td
                    key={column.key}
                    className={cx(numeric && 'gcl-chart__cell--numeric')}
                  >
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
