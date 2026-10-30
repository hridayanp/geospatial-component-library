import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import maplibregl, { type PositionAnchor } from 'maplibre-gl';
import type { LngLat } from '@hridayanp/geo-utils';
import { useMap } from '@hridayanp/map-container';
import { cx } from '@hridayanp/ui';

export interface MapMarkerProps {
  /** Position as `[longitude, latitude]`. */
  lngLat: LngLat;
  /**
   * What to draw. Any React content — a status badge, an icon, a value chip —
   * rendered into the marker's DOM element through a portal, so it keeps
   * React context and state. Omit for the default pin.
   */
  children?: ReactNode;
  /** Colour of the default pin. Default `var(--gcl-accent)`. */
  color?: string;
  /** Which part of the content sits on the coordinate. Default `'bottom'` for the pin, `'center'` otherwise. */
  anchor?: PositionAnchor;
  /** Pixel offset from the anchor, `[x, y]`. */
  offset?: [number, number];
  /** Rotation in degrees clockwise. */
  rotation?: number;
  /** `'map'` keeps the rotation fixed to north as the map turns. Default `'viewport'`. */
  rotationAlignment?: 'map' | 'viewport' | 'auto';
  /** Allow dragging; the new position arrives through `onDragEnd`. */
  draggable?: boolean;
  onDragEnd?: (lngLat: LngLat) => void;
  onClick?: (lngLat: LngLat) => void;
  /** Accessible name. Markers with `onClick` become keyboard-focusable buttons. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/** The default teardrop pin. */
export function MarkerPin({ color }: { color?: string }) {
  return (
    <svg
      className="gcl-marker__pin"
      width="26"
      height="34"
      viewBox="0 0 26 34"
      aria-hidden="true"
      style={color ? { color } : undefined}
    >
      <path
        d="M13 33s11-10.3 11-19.2A11 11 0 0 0 2 13.8C2 22.7 13 33 13 33z"
        fill="currentColor"
        stroke="var(--gcl-bg)"
        strokeWidth="2"
      />
      <circle cx="13" cy="13.5" r="4" fill="var(--gcl-bg)" />
    </svg>
  );
}

/**
 * A DOM marker with React content.
 *
 * Use markers for a handful of things the reader interacts with individually —
 * a selected station, an alert, a route waypoint. For hundreds of points use
 * `VectorLayer`: every marker is a DOM node repositioned on every frame, while
 * a vector layer is drawn on the GPU.
 *
 * ```tsx
 * <MapMarker lngLat={[75.9, 9.8]} label="Kochi" onClick={select}>
 *   <span className="badge">32 kt</span>
 * </MapMarker>
 * ```
 */
export function MapMarker({
  lngLat,
  children,
  color,
  anchor,
  offset,
  rotation = 0,
  rotationAlignment = 'viewport',
  draggable = false,
  onDragEnd,
  onClick,
  label,
  className,
  style,
}: MapMarkerProps) {
  const { map } = useMap();
  const element = useMemo(() => document.createElement('div'), []);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const handlers = useRef({ onDragEnd, onClick });
  handlers.current = { onDragEnd, onClick };

  const resolvedAnchor = anchor ?? (children == null ? 'bottom' : 'center');
  const offsetKey = offset ? offset.join(',') : '';

  // Construction-time options; anything else is updated in place below.
  useEffect(() => {
    if (!map) return;
    const marker = new maplibregl.Marker({
      element,
      anchor: resolvedAnchor,
      ...(offset ? { offset } : {}),
      draggable,
      rotationAlignment,
    })
      .setLngLat(lngLat)
      .setRotation(rotation)
      .addTo(map);
    markerRef.current = marker;

    const onDragEndListener = () => {
      const { lng, lat } = marker.getLngLat();
      handlers.current.onDragEnd?.([lng, lat]);
    };
    marker.on('dragend', onDragEndListener);

    return () => {
      marker.off('dragend', onDragEndListener);
      marker.remove();
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, element, resolvedAnchor, offsetKey, rotationAlignment]);

  useEffect(() => {
    markerRef.current?.setLngLat(lngLat);
  }, [lngLat[0], lngLat[1]]);

  useEffect(() => {
    markerRef.current?.setRotation(rotation);
  }, [rotation]);

  useEffect(() => {
    markerRef.current?.setDraggable(draggable);
  }, [draggable]);

  // Click and keyboard activation on the element itself. Marker elements live
  // inside the map's canvas container, so a click would otherwise bubble up and
  // also fire the map's own click handler; stopping propagation prevents that.
  useEffect(() => {
    if (!onClick) return;
    const activate = (event: Event) => {
      event.stopPropagation();
      const marker = markerRef.current;
      if (!marker) return;
      const { lng, lat } = marker.getLngLat();
      handlers.current.onClick?.([lng, lat]);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activate(event);
      }
    };
    element.addEventListener('click', activate);
    element.addEventListener('keydown', onKey);
    element.setAttribute('role', 'button');
    element.tabIndex = 0;
    return () => {
      element.removeEventListener('click', activate);
      element.removeEventListener('keydown', onKey);
      element.removeAttribute('role');
      element.removeAttribute('tabindex');
    };
  }, [element, Boolean(onClick)]);

  useEffect(() => {
    element.className = cx(
      'gcl-marker',
      onClick && 'gcl-marker--interactive',
      draggable && 'gcl-marker--draggable',
      className,
    );
    if (label) element.setAttribute('aria-label', label);
    else element.removeAttribute('aria-label');
    Object.assign(element.style, style ?? {});
  }, [element, className, label, style, Boolean(onClick), draggable]);

  return createPortal(children ?? <MarkerPin {...(color ? { color } : {})} />, element);
}
