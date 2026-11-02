import type { CSSProperties } from 'react';

export interface SparklineProps {
  /** Values in order; `null` leaves a gap. */
  values: ReadonlyArray<number | null>;
  /** Width in pixels. Default `96`. */
  width?: number;
  /** Height in pixels. Default `24`. */
  height?: number;
  /** Line colour. Default `currentColor`, so it inherits the text colour. */
  color?: string;
  /** Shade beneath the line. Default `false`. */
  fill?: boolean;
  /** Mark the last value with a dot. Default `true`. */
  showLast?: boolean;
  /** Fixed value range. Default fits the data. */
  domain?: [number, number];
  /** Accessible description, e.g. `"Rain over the last 24 h, rising"`. Required: a sparkline has no axes to read. */
  label: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * A word-sized line chart for a table cell, a stat tile or a popup.
 *
 * Shows the shape of a series — rising, falling, spiking — and nothing else:
 * no axes, no grid. The `label` carries the meaning for assistive technology.
 */
export function Sparkline({
  values,
  width = 96,
  height = 24,
  color = 'currentColor',
  fill = false,
  showLast = true,
  domain,
  label,
  className,
  style,
}: SparklineProps) {
  const finite = values.filter((v): v is number => v != null && Number.isFinite(v));
  const lo = domain?.[0] ?? Math.min(...finite);
  const hi = domain?.[1] ?? Math.max(...finite);
  const pad = 2;
  const x = (i: number) => pad + (values.length > 1 ? (i / (values.length - 1)) * (width - pad * 2) : (width - pad * 2) / 2);
  const y = (v: number) => (hi > lo ? pad + (1 - (v - lo) / (hi - lo)) * (height - pad * 2) : height / 2);

  let d = '';
  let pen = false;
  let lastIndex = -1;
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) {
      pen = false;
      return;
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
    pen = true;
    lastIndex = i;
  });

  const last = lastIndex >= 0 ? (values[lastIndex] as number) : null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className={['gcl-sparkline', className].filter(Boolean).join(' ')}
      style={{ color, ...style }}
    >
      {fill && finite.length > 1 && (
        <path
          d={`${d}L${x(lastIndex)} ${height}L${x(values.findIndex((v) => v != null && Number.isFinite(v)))} ${height}Z`}
          fill="currentColor"
          opacity={0.15}
        />
      )}
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {showLast && last != null && <circle cx={x(lastIndex)} cy={y(last)} r={2.25} fill="currentColor" />}
    </svg>
  );
}
