import { useEffect, useId, useState, type ReactNode } from 'react';
import { EARTH_RADIUS_KM, type Bounds } from '@hridayanp/geo-utils';
import { Button, cx } from '@hridayanp/ui';

/** Why a bounding box was rejected. `null` when it is valid. */
export function validateBounds(
  bounds: Bounds,
  { allowAntimeridian = false }: { allowAntimeridian?: boolean } = {},
): string | null {
  const [west, south, east, north] = bounds;
  if (![west, south, east, north].every(Number.isFinite)) return 'Every edge needs a number.';
  if (Math.abs(south) > 90 || Math.abs(north) > 90) return 'Latitudes must lie between −90 and 90.';
  if (Math.abs(west) > 180 || Math.abs(east) > 180) return 'Longitudes must lie between −180 and 180.';
  if (south >= north) return 'South must be less than north.';
  if (west === east) return 'West and east must differ.';
  if (west > east && !allowAntimeridian) return 'West must be less than east.';
  return null;
}

/** Area of a latitude/longitude box on the sphere, in km². Handles the antimeridian. */
export function boundsAreaKm2([west, south, east, north]: Bounds): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const span = east >= west ? east - west : 360 - (west - east);
  return (
    EARTH_RADIUS_KM ** 2 * toRad(span) * Math.abs(Math.sin(toRad(north)) - Math.sin(toRad(south)))
  );
}

export interface BboxEditorProps {
  /** Current box `[west, south, east, north]`, or `null` when unset. */
  value: Bounds | null;
  /** Fired with a valid box. Invalid input is reported inline, never emitted. */
  onChange: (value: Bounds) => void;
  /**
   * When given, shows a "Use map view" button that reads the box from the
   * host — typically `() => mapRef.current?.getMap()?.getBounds().toArray().flat()`.
   * Keeping it a callback leaves this package free of any map dependency.
   */
  onUseCurrentView?: () => Bounds | null | undefined;
  /** Accept boxes that cross 180° (west > east). Default `false`. */
  allowAntimeridian?: boolean;
  /** Decimal places shown and emitted. Default `3`. */
  precision?: number;
  /** Show the box's area beneath the fields. Default `true`. */
  showArea?: boolean;
  /** Heading above the fields. */
  label?: ReactNode;
  disabled?: boolean;
  className?: string;
}

const EDGES = [
  { key: 'north', label: 'North', index: 3 },
  { key: 'west', label: 'West', index: 0 },
  { key: 'east', label: 'East', index: 2 },
  { key: 'south', label: 'South', index: 1 },
] as const;

/**
 * Four fields for a geographic bounding box, laid out as a compass.
 *
 * Commits only valid boxes — south below north, west below east (unless the
 * antimeridian is allowed), latitudes within ±90 — and says which rule failed
 * otherwise. Used for data-extract regions, model domains and map exports.
 *
 * ```tsx
 * <BboxEditor value={region} onChange={setRegion} onUseCurrentView={readMapBounds} />
 * ```
 */
export function BboxEditor({
  value,
  onChange,
  onUseCurrentView,
  allowAntimeridian = false,
  precision = 3,
  showArea = true,
  label,
  disabled,
  className,
}: BboxEditorProps) {
  const baseId = useId();
  const toText = (bounds: Bounds | null) =>
    bounds ? bounds.map((v) => String(Number.parseFloat(v.toFixed(precision)))) : ['', '', '', ''];

  const [draft, setDraft] = useState<string[]>(() => toText(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(toText(value));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.[0], value?.[1], value?.[2], value?.[3], precision]);

  const commit = (texts: string[]) => {
    if (texts.some((text) => text.trim() === '')) {
      setError(null);
      return;
    }
    const round = (v: number) => Number.parseFloat(v.toFixed(precision));
    const candidate = texts.map((text) => round(Number.parseFloat(text))) as Bounds;
    const problem = validateBounds(candidate, { allowAntimeridian });
    setError(problem);
    if (problem) return;
    if (!value || candidate.some((v, i) => v !== value[i])) onChange(candidate);
  };

  const useView = () => {
    const bounds = onUseCurrentView?.();
    if (!bounds) return;
    const texts = toText(bounds);
    setDraft(texts);
    commit(texts);
  };

  const current = value && !error ? value : null;

  return (
    <fieldset className={cx('gcl-bbox', className)} disabled={disabled}>
      {label && <legend className="gcl-field__label">{label}</legend>}
      <div className="gcl-bbox__grid">
        {EDGES.map(({ key, label: edgeLabel, index }) => (
          <div key={key} className={`gcl-field gcl-bbox__${key}`}>
            <label className="gcl-field__label" htmlFor={`${baseId}-${key}`}>
              {edgeLabel}
            </label>
            <input
              id={`${baseId}-${key}`}
              className="gcl-input gcl-input--mono"
              type="number"
              inputMode="decimal"
              step="any"
              value={draft[index]}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${baseId}-error` : undefined}
              onChange={(event) => {
                const next = [...draft];
                next[index] = event.target.value;
                setDraft(next);
              }}
              onBlur={() => commit(draft)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commit(draft);
                }
              }}
            />
          </div>
        ))}
        {onUseCurrentView && (
          <div className="gcl-bbox__action">
            <Button variant="outline" size="sm" onClick={useView}>
              Use map view
            </Button>
          </div>
        )}
      </div>
      {error ? (
        <p className="gcl-field__error" id={`${baseId}-error`} role="alert">
          {error}
        </p>
      ) : (
        showArea &&
        current && (
          <p className="gcl-field__hint">
            ≈ {Math.round(boundsAreaKm2(current)).toLocaleString()} km²
          </p>
        )
      )}
    </fieldset>
  );
}
