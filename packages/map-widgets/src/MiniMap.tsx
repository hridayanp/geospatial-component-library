import { useEffect, useRef, type CSSProperties } from 'react';
import maplibregl, { type GeoJSONSource, type StyleSpecification } from 'maplibre-gl';
import { createBlankStyle, useMap } from '@hridayanp/map-container';
import { cx, placementClass, type PanelPlacement } from '@hridayanp/ui';

export interface MiniMapProps {
  /**
   * Style for the overview. Default: a blank background, so the inset makes no
   * request the host did not ask for. A light, label-free basemap reads best.
   */
  mapStyle?: StyleSpecification | string;
  /** How many zoom levels further out than the main map. Default `5`. */
  zoomOffset?: number;
  /** Never zoom the overview in further than this. Default `8`. */
  maxZoom?: number;
  /** Inset width in pixels. Default `180`. */
  width?: number;
  /** Inset height in pixels. Default `120`. */
  height?: number;
  /** Colour of the viewport rectangle. Default `'#38bdf8'`. */
  boxColor?: string;
  /** Click the overview to recentre the main map there. Default `true`. */
  clickToPan?: boolean;
  /** Corner of the map to dock to. Default `'bottom-right'`. */
  placement?: PanelPlacement;
  className?: string;
  style?: CSSProperties;
}

const BOX_SOURCE = 'gcl-minimap-box';

/**
 * An overview inset showing where the main view sits in a wider area.
 *
 * The inset is a second, non-interactive MapLibre map that follows the main
 * one at a fixed zoom offset and outlines its viewport. Useful whenever the
 * main map is zoomed in far enough for the reader to lose their bearings.
 */
export function MiniMap({
  mapStyle,
  zoomOffset = 5,
  maxZoom = 8,
  width = 180,
  height = 120,
  boxColor = '#38bdf8',
  clickToPan = true,
  placement = 'bottom-right',
  className,
  style,
}: MiniMapProps) {
  const { map } = useMap();
  const containerRef = useRef<HTMLDivElement>(null);
  const insetRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!map || !container) return;

    const inset = new maplibregl.Map({
      container,
      style: mapStyle ?? createBlankStyle('#0b1220'),
      interactive: false,
      attributionControl: false,
      center: map.getCenter(),
      zoom: Math.max(0, Math.min(maxZoom, map.getZoom() - zoomOffset)),
    });
    insetRef.current = inset;

    const boxData = () => {
      const bounds = map.getBounds();
      const w = bounds.getWest();
      const s = bounds.getSouth();
      const e = bounds.getEast();
      const n = bounds.getNorth();
      return {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'Polygon' as const,
          coordinates: [
            [
              [w, s],
              [e, s],
              [e, n],
              [w, n],
              [w, s],
            ],
          ],
        },
      };
    };

    const addBox = () => {
      if (inset.getSource(BOX_SOURCE)) return;
      inset.addSource(BOX_SOURCE, { type: 'geojson', data: boxData() });
      inset.addLayer({
        id: `${BOX_SOURCE}-fill`,
        type: 'fill',
        source: BOX_SOURCE,
        paint: { 'fill-color': boxColor, 'fill-opacity': 0.15 },
      });
      inset.addLayer({
        id: `${BOX_SOURCE}-line`,
        type: 'line',
        source: BOX_SOURCE,
        paint: { 'line-color': boxColor, 'line-width': 1.5 },
      });
    };
    inset.on('load', addBox);
    inset.on('style.load', addBox);

    const follow = () => {
      inset.jumpTo({
        center: map.getCenter(),
        zoom: Math.max(0, Math.min(maxZoom, map.getZoom() - zoomOffset)),
      });
      (inset.getSource(BOX_SOURCE) as GeoJSONSource | undefined)?.setData(boxData());
    };
    map.on('move', follow);

    const onClick = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const target = inset.unproject([event.clientX - rect.left, event.clientY - rect.top]);
      map.easeTo({ center: target, duration: 400 });
    };
    if (clickToPan) container.addEventListener('click', onClick);

    return () => {
      map.off('move', follow);
      container.removeEventListener('click', onClick);
      inset.remove();
      insetRef.current = null;
    };
  }, [map, mapStyle, zoomOffset, maxZoom, boxColor, clickToPan]);

  return (
    <div
      className={cx('gcl-panel', 'gcl-minimap', placementClass(placement), className)}
      style={{ width, height, ...style }}
    >
      <div
        ref={containerRef}
        className={cx('gcl-minimap__canvas', clickToPan && 'gcl-minimap__canvas--interactive')}
        role="img"
        aria-label="Overview map showing the current view"
      />
    </div>
  );
}
