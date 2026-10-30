import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import maplibregl, { type PositionAnchor } from 'maplibre-gl';
import type { LngLat } from '@hridayanp/geo-utils';
import { useMap } from '@hridayanp/map-container';
import { cx } from '@hridayanp/ui';

export interface MapPopupProps {
  /** Position the popup points at. */
  lngLat: LngLat;
  /** Popup content, rendered through a portal so it keeps React context. */
  children: ReactNode;
  /** Fired when the user closes the popup. Unmount it in response. */
  onClose?: () => void;
  /** Show the × button. Default `true`. */
  closeButton?: boolean;
  /** Close when the map is clicked elsewhere. Default `true`. */
  closeOnClick?: boolean;
  /** Close when the map moves. Default `false`. */
  closeOnMove?: boolean;
  /** Fixed side to open on. Default: whichever side fits. */
  anchor?: PositionAnchor;
  /** Pixel distance from the coordinate — clear a marker's height with it. Default `12`. */
  offset?: number;
  /** CSS max-width. Default `'280px'`. */
  maxWidth?: string;
  className?: string;
}

/**
 * A popup anchored to a coordinate, with React content.
 *
 * Controlled: render it to open, unmount it to close, and unmount it from
 * `onClose` when the user dismisses it. Styled with the library tokens via
 * the `gcl-popup` class, so it matches the rest of the overlays in both themes.
 *
 * ```tsx
 * {selected && (
 *   <MapPopup lngLat={selected.lngLat} onClose={() => setSelected(null)}>
 *     <StationSummary station={selected} />
 *   </MapPopup>
 * )}
 * ```
 */
export function MapPopup({
  lngLat,
  children,
  onClose,
  closeButton = true,
  closeOnClick = true,
  closeOnMove = false,
  anchor,
  offset = 12,
  maxWidth = '280px',
  className,
}: MapPopupProps) {
  const { map } = useMap();
  const element = useMemo(() => document.createElement('div'), []);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!map) return;
    const popup = new maplibregl.Popup({
      closeButton,
      closeOnClick,
      closeOnMove,
      offset,
      maxWidth,
      className: cx('gcl-popup', className),
      ...(anchor ? { anchor } : {}),
      focusAfterOpen: false,
    })
      .setDOMContent(element)
      .setLngLat(lngLat)
      .addTo(map);
    popupRef.current = popup;

    // `close` also fires when we remove the popup ourselves on unmount; only a
    // close the user initiated should reach the host.
    let disposing = false;
    const handleClose = () => {
      if (!disposing) onCloseRef.current?.();
    };
    popup.on('close', handleClose);

    return () => {
      disposing = true;
      popup.off('close', handleClose);
      popup.remove();
      popupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, element, closeButton, closeOnClick, closeOnMove, anchor, offset, maxWidth, className]);

  useEffect(() => {
    popupRef.current?.setLngLat(lngLat);
  }, [lngLat[0], lngLat[1]]);

  return createPortal(children, element);
}
