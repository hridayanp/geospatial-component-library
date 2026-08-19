import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Button,
  ChevronIcon,
  Panel,
  cx,
  type PanelPlacement,
} from '@hridayanp/ui';
import {
  buildTicks,
  defaultFormat,
  normalizeStops,
  scaleToGradient,
  type LegendColorScale,
} from './colorScale';

/** One entry in a discrete, class-based legend. */
export interface LegendClass {
  color: string;
  label: ReactNode;
  /** Optional numeric bounds, used when no explicit label is given. */
  from?: number;
  to?: number;
}

export interface GeoLegendProps {
  /** Heading. Omit for a bare ramp. */
  title?: ReactNode;
  /** Secondary line under the title. */
  subtitle?: ReactNode;
  /**
   * Colour ramp. Accepts bare colours (spread evenly) or explicit
   * `[value, colour]` stops.
   */
  colorScale?: LegendColorScale;
  /** Low end of the value range. */
  min?: number;
  /** High end of the value range. */
  max?: number;
  /** Unit shown beside the scale — `'mm'`, `'kt'`, `'°C'`, anything. */
  unit?: string;
  /**
   * `'continuous'` draws a gradient bar; `'discrete'` draws flat bands, or a
   * swatch list when `classes` is supplied.
   */
  mode?: 'continuous' | 'discrete';
  /**
   * Explicit classes for a categorical or classed legend. When present these
   * replace the ramp entirely.
   */
  classes?: LegendClass[];
  orientation?: 'horizontal' | 'vertical';
  /** Number of evenly spaced ticks, or the exact values to label. Default `2`. */
  ticks?: number | number[];
  /** Custom value formatting. Defaults to precision chosen from the range. */
  formatValue?: (value: number) => string;
  /** Extra content under the ramp — a timestamp, a source note, a control. */
  footer?: ReactNode;
  /** Content in the header, to the right of the title. */
  actions?: ReactNode;
  /** Let the user collapse the legend to just its header. Default `false`. */
  collapsible?: boolean;
  /** Initial collapsed state for an uncontrolled collapsible legend. */
  defaultCollapsed?: boolean;
  /** Dock to a corner of the map. Omit to position it yourself. */
  placement?: PanelPlacement;
  className?: string;
  style?: CSSProperties;
  /** Replaces the ramp entirely, keeping the panel chrome. */
  children?: ReactNode;
}

/**
 * A map legend for arbitrary geospatial data.
 *
 * Nothing here is domain-specific: a legend is a colour ramp, a value range, a
 * unit and a title, and every one of those is a prop. The same component
 * labels rainfall in millimetres, a probability in percent and a land-cover
 * classification.
 *
 * @example Continuous
 * ```tsx
 * <GeoLegend
 *   title="Accumulated rainfall"
 *   colorScale={['#f7fbff', '#6baed6', '#08306b']}
 *   min={0}
 *   max={120}
 *   unit="mm"
 *   ticks={5}
 * />
 * ```
 *
 * @example Classed
 * ```tsx
 * <GeoLegend
 *   title="Land cover"
 *   mode="discrete"
 *   classes={[
 *     { color: '#166534', label: 'Forest' },
 *     { color: '#a16207', label: 'Cropland' },
 *     { color: '#0284c7', label: 'Water' },
 *   ]}
 * />
 * ```
 */
export function GeoLegend({
  title,
  subtitle,
  colorScale = ['#0b2545', '#f4d35e'],
  min = 0,
  max = 1,
  unit,
  mode = 'continuous',
  classes,
  orientation = 'horizontal',
  ticks = 2,
  formatValue,
  footer,
  actions,
  collapsible = false,
  defaultCollapsed = false,
  placement,
  className,
  style,
  children,
}: GeoLegendProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const range = max - min;
  const format = useMemo(
    () => formatValue ?? ((value: number) => defaultFormat(value, range)),
    [formatValue, range],
  );

  const tickValues = useMemo(() => {
    if (Array.isArray(ticks)) return ticks;
    return buildTicks(min, max, Math.max(2, ticks));
  }, [ticks, min, max]);

  const gradient = useMemo(
    () =>
      scaleToGradient(
        colorScale,
        orientation === 'horizontal' ? 'to right' : 'to top',
        mode === 'discrete',
      ),
    [colorScale, orientation, mode],
  );

  const resolvedClasses = useMemo<LegendClass[] | null>(() => {
    if (!classes) return null;
    return classes.map((entry) => ({
      ...entry,
      label:
        entry.label ??
        (entry.from != null && entry.to != null
          ? `${format(entry.from)} – ${format(entry.to)}`
          : ''),
    }));
  }, [classes, format]);

  const header = collapsible ? (
    <>
      {actions}
      <Button
        variant="ghost"
        size="sm"
        aria-label={collapsed ? 'Expand legend' : 'Collapse legend'}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((value) => !value)}
      >
        <ChevronIcon direction={collapsed ? 'up' : 'down'} size={13} />
      </Button>
    </>
  ) : (
    actions
  );

  return (
    <Panel
      {...(title ? { title } : {})}
      {...(subtitle ? { subtitle } : {})}
      {...(header ? { actions: header } : {})}
      {...(placement ? { placement } : {})}
      className={cx('gcl-legend', `gcl-legend--${orientation}`, className)}
      {...(style ? { style } : {})}
    >
      {!collapsed && (
        <>
          {children ??
            (resolvedClasses ? (
              <div className="gcl-legend__classes">
                {resolvedClasses.map((entry, index) => (
                  <div className="gcl-legend__class" key={index}>
                    <span
                      className="gcl-legend__swatch"
                      style={{ background: entry.color }}
                    />
                    <span>{entry.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={
                  orientation === 'vertical'
                    ? { display: 'flex', alignItems: 'stretch' }
                    : undefined
                }
              >
                <div
                  className="gcl-legend__ramp"
                  style={{ background: gradient }}
                  role="img"
                  aria-label={
                    typeof title === 'string'
                      ? `${title} colour scale from ${format(min)} to ${format(max)}${unit ? ` ${unit}` : ''}`
                      : `Colour scale from ${format(min)} to ${format(max)}`
                  }
                />
                <div className="gcl-legend__scale">
                  {tickValues.map((value, index) => (
                    <span key={index}>{format(value)}</span>
                  ))}
                </div>
              </div>
            ))}

          {unit && !resolvedClasses && (
            <div className="gcl-legend__unit" style={{ marginTop: 2 }}>
              {unit}
            </div>
          )}

          {footer && <div className="gcl-legend__footer">{footer}</div>}
        </>
      )}
    </Panel>
  );
}

/** Count of stops in a ramp — useful when laying out a custom swatch row. */
export function colorScaleStopCount(scale: LegendColorScale): number {
  return normalizeStops(scale).length;
}
