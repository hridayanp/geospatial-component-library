import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { LngLat } from '@hridayanp/geo-utils';
import { formatLatLon, type CoordinateFormat } from '@hridayanp/geo-inputs';
import { useMap } from '@hridayanp/map-container';
import { cx, placementClass, type PanelPlacement } from '@hridayanp/ui';

export interface CoordinateReadoutProps {
  /** Notation. Default `'decimal'` (`9.80°N 75.90°E`). */
  format?: CoordinateFormat;
  /** Decimal places for the notation. */
  precision?: number;
  /** Append the current zoom level. Default `false`. */
  showZoom?: boolean;
  /** Shown when the pointer is off the map. Default: the map centre. */
  idleText?: string;
  /** Corner of the map to dock to. Default `'bottom-right'`. */
  placement?: PanelPlacement;
  className?: string;
  style?: CSSProperties;
}

/**
 * The coordinate under the pointer, latitude first.
 *
 * Updates at most once per animation frame however fast the pointer moves,
 * and falls back to the map centre when the pointer leaves, so the readout is
 * never stale and never blank.
 */
export function CoordinateReadout({
  format = 'decimal',
  precision,
  showZoom = false,
  idleText,
  placement = 'bottom-right',
  className,
  style,
}: CoordinateReadoutProps) {
  const { map } = useMap();
  const [position, setPosition] = useState<LngLat | null>(null);
  const [hovering, setHovering] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const frame = useRef(0);
  const hoveringRef = useRef(hovering);
  hoveringRef.current = hovering;

  useEffect(() => {
    if (!map) return;
    const centre = () => {
      const c = map.getCenter();
      return [c.lng, c.lat] as LngLat;
    };
    setPosition(centre());
    setZoom(map.getZoom());

    const onMove = (event: { lngLat: { lng: number; lat: number } }) => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        setHovering(true);
        setPosition([event.lngLat.lng, event.lngLat.lat]);
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(frame.current);
      setHovering(false);
      setPosition(centre());
    };
    const onCamera = () => {
      setZoom(map.getZoom());
      if (!hoveringRef.current) setPosition(centre());
    };

    map.on('mousemove', onMove);
    map.on('mouseout', onLeave);
    map.on('move', onCamera);
    return () => {
      cancelAnimationFrame(frame.current);
      map.off('mousemove', onMove);
      map.off('mouseout', onLeave);
      map.off('move', onCamera);
    };
  }, [map]);

  const text =
    !hovering && idleText
      ? idleText
      : position
        ? formatLatLon(position, { format, ...(precision != null ? { precision } : {}) })
        : '—';

  return (
    <div
      className={cx('gcl-panel', 'gcl-coordinate-readout', placementClass(placement), className)}
      style={style}
      aria-live="off"
    >
      <span>{text}</span>
      {showZoom && zoom != null && (
        <span className="gcl-coordinate-readout__zoom">z{zoom.toFixed(1)}</span>
      )}
    </div>
  );
}
