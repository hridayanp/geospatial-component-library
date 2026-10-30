import { useCallback, type ReactNode } from 'react';
import type { MapMouseEvent } from 'maplibre-gl';
import type { LngLat } from '@hridayanp/geo-utils';
import { useMapCursor, useMapEvent } from '@hridayanp/map-container';
import { MapMarker } from './MapMarker';

export interface PointPickerProps {
  /** The picked point, or `null` before one is chosen. Controlled. */
  value: LngLat | null;
  /** Fired with the new point after a click or a marker drag. */
  onChange: (lngLat: LngLat) => void;
  /** Accept clicks on the map. Default `true`. */
  enabled?: boolean;
  /**
   * Snap to a regular grid, in degrees — pick the centres of a model's cells
   * rather than arbitrary coordinates. `0.25` snaps to x.125, x.375, … when
   * `gridOrigin` is `0.125`.
   */
  snap?: number;
  /** Origin of the snapping grid, in degrees. Default `0`. */
  gridOrigin?: number;
  /** Decimal places kept on the reported coordinates. Default `4` (~11 m). */
  precision?: number;
  /** Let the marker be dragged to adjust the pick. Default `true`. */
  draggable?: boolean;
  /** Pin colour. */
  color?: string;
  /** Custom marker content instead of the pin. */
  children?: ReactNode;
  /** Accessible name for the marker. Default `'Selected point'`. */
  label?: string;
}

/**
 * Click the map to choose a point; drag the marker to adjust it.
 *
 * The building block of every "pick a location" flow — a point forecast, a
 * meteogram, a sounding. Coordinates are rounded to `precision` and optionally
 * snapped to a model grid, so the value handed to the host is the one it should
 * actually query.
 *
 * ```tsx
 * const [point, setPoint] = useState<LngLat | null>(null);
 * <PointPicker value={point} onChange={setPoint} snap={0.25} gridOrigin={0.125} />
 * ```
 */
export function PointPicker({
  value,
  onChange,
  enabled = true,
  snap,
  gridOrigin = 0,
  precision = 4,
  draggable = true,
  color,
  children,
  label = 'Selected point',
}: PointPickerProps) {
  const normalise = useCallback(
    ([lng, lat]: LngLat): LngLat => {
      const round = (v: number) => Number.parseFloat(v.toFixed(precision));
      if (snap && snap > 0) {
        const snapTo = (v: number) => gridOrigin + Math.round((v - gridOrigin) / snap) * snap;
        return [round(snapTo(lng)), round(snapTo(lat))];
      }
      return [round(lng), round(lat)];
    },
    [snap, gridOrigin, precision],
  );

  useMapCursor(enabled ? 'crosshair' : null);

  useMapEvent(
    'click',
    enabled
      ? (event: MapMouseEvent) => onChange(normalise([event.lngLat.lng, event.lngLat.lat]))
      : null,
  );

  if (!value) return null;

  return (
    <MapMarker
      lngLat={value}
      draggable={draggable && enabled}
      onDragEnd={(lngLat) => onChange(normalise(lngLat))}
      label={label}
      {...(color ? { color } : {})}
    >
      {children}
    </MapMarker>
  );
}
