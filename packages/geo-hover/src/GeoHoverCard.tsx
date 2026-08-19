import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@hridayanp/ui';
import type { HoverSection } from './types';

export interface GeoHoverCardProps {
  /** Pointer position in page coordinates. */
  x: number;
  y: number;
  /** One section per layer contributing data. Empty renders nothing. */
  sections: HoverSection[];
  /** Distance in pixels between the pointer and the card. Default `12`. */
  offset?: number;
  /**
   * Render the whole card yourself, keeping the positioning and portalling.
   * Use when the default label/value layout is not the right shape for your
   * data.
   */
  render?: (sections: HoverSection[]) => ReactNode;
  /** Portal target. Defaults to `document.body`. */
  container?: HTMLElement | null;
  className?: string;
}

/**
 * Round a value the way a readout should: to a sensible precision, never
 * scientific notation, and leaving already-formatted strings alone.
 */
function formatValue(value: HoverSection['rows'][number]['value']): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '—';
    const magnitude = Math.abs(value);
    if (Number.isInteger(value)) return String(value);
    const decimals = magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : 2;
    return value.toFixed(decimals);
  }
  return String(value);
}

/**
 * A floating readout card anchored to the pointer.
 *
 * Portalled to `document.body` so it floats above the map regardless of the
 * surrounding stacking context — a tooltip clipped by a panel's `overflow` is
 * the single most common failure in map UIs.
 *
 * It also flips and clamps against the viewport edges rather than running off
 * screen, which matters most at exactly the moment the user is inspecting the
 * edge of the data.
 */
export function GeoHoverCard({
  x,
  y,
  sections,
  offset = 12,
  render,
  container,
  className,
}: GeoHoverCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 200, height: 110 });

  // Measure after paint so the flip decision uses the card's real size rather
  // than an assumed one.
  useLayoutEffect(() => {
    const element = cardRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setSize({ width: rect.width, height: rect.height });
    }
  }, [x, y, sections]);

  if (!sections || sections.length === 0) return null;
  if (typeof document === 'undefined') return null;

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768;

  // Prefer right of and above the pointer; flip when that would overflow, then
  // clamp so the card is always fully visible.
  let left = x + offset;
  if (left + size.width > viewportWidth - offset) left = x - size.width - offset;
  left = Math.max(offset, Math.min(left, viewportWidth - size.width - offset));

  let top = y - offset - size.height;
  if (top < offset) top = y + offset;
  top = Math.max(offset, Math.min(top, viewportHeight - size.height - offset));

  const card = (
    <div
      ref={cardRef}
      className={cx('gcl-hover-card', className)}
      style={{ left, top }}
      role="tooltip"
    >
      {render
        ? render(sections)
        : sections.map((section, sectionIndex) => (
            <div className="gcl-hover-card__section" key={`${section.title}-${sectionIndex}`}>
              <div
                className="gcl-hover-card__title"
                style={section.accentColor ? { color: section.accentColor } : undefined}
              >
                <span
                  className="gcl-hover-card__dot"
                  style={
                    section.accentColor
                      ? { background: section.accentColor }
                      : undefined
                  }
                />
                {section.title}
              </div>
              {section.subtitle && (
                <div className="gcl-hover-card__subtitle">{section.subtitle}</div>
              )}
              {section.rows.map((row, rowIndex) => (
                <div className="gcl-hover-card__row" key={`${row.label}-${rowIndex}`}>
                  <span className="gcl-hover-card__label">{row.label}</span>
                  <span className="gcl-hover-card__value">
                    {formatValue(row.value)}
                    {row.unit && row.value != null ? ` ${row.unit}` : ''}
                  </span>
                </div>
              ))}
            </div>
          ))}
    </div>
  );

  return createPortal(card, container ?? document.body);
}
