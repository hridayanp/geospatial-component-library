import { useEffect, useState, type ReactNode } from 'react';
import { useMap } from '@hridayanp/map-container';
import { cx } from '@hridayanp/ui';

export interface MapLoadingOverlayProps {
  /**
   * Show the overlay. Omit to follow the map itself: shown while MapLibre is
   * loading tiles or sources, hidden once it is idle.
   */
  loading?: boolean;
  /** Text beside the spinner. Default `'Loading…'`. */
  label?: ReactNode;
  /** Wait this long before showing, so fast loads never flash. Default `200` ms. */
  delayMs?: number;
  /** Dim the map underneath. Default `false` — a small badge, map stays readable. */
  dim?: boolean;
  className?: string;
}

/**
 * A loading indicator over the map.
 *
 * Controlled with `loading`, or automatic: without the prop it listens to the
 * map's own `dataloading` and `idle` events, which covers basemap tiles,
 * raster frames and GeoJSON sources alike. Announced politely to screen
 * readers.
 */
export function MapLoadingOverlay({
  loading,
  label = 'Loading…',
  delayMs = 200,
  dim = false,
  className,
}: MapLoadingOverlayProps) {
  const { map } = useMap();
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (loading != null || !map) return;
    const onLoading = () => setBusy(true);
    const onIdle = () => setBusy(false);
    map.on('dataloading', onLoading);
    map.on('idle', onIdle);
    return () => {
      map.off('dataloading', onLoading);
      map.off('idle', onIdle);
    };
  }, [map, loading]);

  const active = loading ?? busy;

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs]);

  return (
    <div
      className={cx('gcl-loading', dim && 'gcl-loading--dim', visible && 'is-visible', className)}
      role="status"
      aria-live="polite"
    >
      {visible && (
        <div className="gcl-panel gcl-loading__badge">
          <span className="gcl-loading__spinner" aria-hidden="true" />
          <span>{label}</span>
        </div>
      )}
    </div>
  );
}
