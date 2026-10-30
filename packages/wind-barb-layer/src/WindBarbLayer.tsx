import { useEffect, useMemo } from 'react';
import type { MapStyleImageMissingEvent, SourceSpecification } from 'maplibre-gl';
import type { GeoJsonFeatureCollection } from '@hridayanp/geo-utils';
import {
  useMap,
  useMapSourceLayers,
  type ManagedLayer,
} from '@hridayanp/map-container';
import {
  ICON_SIZE,
  arrowIconName,
  barbIconName,
  createArrowImage,
  createBarbImage,
} from './icons';
import {
  barbComponents,
  extractWindBarbs,
  type WindBarbSampleOptions,
} from './samples';
import type { WindBarbData } from './types';

export interface WindBarbLayerProps extends WindBarbSampleOptions {
  /** Unique layer id; also prefixes the generated icon names. */
  id?: string;
  /** Observations or a gridded field. `null` renders nothing. */
  data?: WindBarbData | null;
  /**
   * `'barb'` draws WMO wind barbs (speed read from the feathers); `'arrow'`
   * draws arrows pointing the way the air moves, scaled by speed. Default
   * `'barb'`.
   */
  mode?: 'barb' | 'arrow';
  /** Hide without unmounting. Default `true`. */
  visible?: boolean;
  /** Draw below this existing layer id. */
  beforeId?: string;
  minZoom?: number;
  maxZoom?: number;

  /** Symbol colour when no `colorScale` is given. Default `'#e2e8f0'`. */
  color?: string;
  /**
   * Colour each symbol by speed, as `[knots, colour]` stops — e.g.
   * `[[0, '#38bdf8'], [25, '#facc15'], [50, '#ef4444']]`. Overrides `color`.
   */
  colorStops?: ReadonlyArray<readonly [number, string]>;
  /** Symbol scale; `1` draws a 26 px shaft. Default `1`. */
  size?: number;
  /** Arrow mode only: `[minScale, maxScale]` across `arrowSpeedRange`. Default `[0.5, 1.2]`. */
  arrowScale?: [number, number];
  /** Arrow mode only: speeds (kt) mapped onto `arrowScale`. Default `[0, 50]`. */
  arrowSpeedRange?: [number, number];
  /** Outline drawn around each symbol for legibility. Default `'rgba(11,18,32,0.85)'`. */
  haloColor?: string;
  /** Halo width in pixels. `0` disables it. Default `1`. */
  haloWidth?: number;
  /** Symbol opacity, `0..1`. Default `1`. */
  opacity?: number;
  /**
   * Which side of the shaft the feathers sit on. `'auto'` (the default)
   * follows the convention for each barb's latitude.
   */
  hemisphere?: 'auto' | 'north' | 'south';
  /**
   * Draw every symbol even where they collide. Default `false`: MapLibre
   * hides overlapping barbs, which keeps a zoomed-out view readable.
   */
  allowOverlap?: boolean;
}

/**
 * Wind barbs or direction arrows, drawn by MapLibre as a symbol layer.
 *
 * Accepts the same `{ kind: 'field' }` and `{ kind: 'points' }` data as
 * `WindParticleLayer`, so particles and barbs can be driven by one object — but
 * unlike particles this needs no deck.gl: the icons are generated in the
 * browser on first use and the layer is plain MapLibre.
 *
 * ```tsx
 * <WindBarbLayer data={{ kind: 'field', u, v, width, height, bounds }} unit="m/s" />
 * ```
 *
 * Barbs follow WMO practice: speeds round to the nearest 5 kt, a pennant is
 * 50 kt, a full feather 10 kt and a half feather 5 kt; the shaft points to
 * where the wind comes **from**. Gridded input is decimated to `maxBarbs`
 * symbols, because barbs are read one at a time and a dense mat is illegible.
 */
export function WindBarbLayer({
  id = 'gcl-wind-barb',
  data,
  mode = 'barb',
  unit,
  stride,
  maxBarbs,
  visible = true,
  beforeId,
  minZoom,
  maxZoom,
  color = '#e2e8f0',
  colorStops,
  size = 1,
  arrowScale = [0.5, 1.2],
  arrowSpeedRange = [0, 50],
  haloColor = 'rgba(11, 18, 32, 0.85)',
  haloWidth = 1,
  opacity = 1,
  hemisphere = 'auto',
  allowOverlap = false,
}: WindBarbLayerProps) {
  const { map, ready, styleVersion } = useMap();

  const collection = useMemo<GeoJsonFeatureCollection | null>(() => {
    if (!data) return null;
    const samples = extractWindBarbs(data, {
      ...(unit ? { unit } : {}),
      ...(stride != null ? { stride } : {}),
      ...(maxBarbs != null ? { maxBarbs } : {}),
    });
    return {
      type: 'FeatureCollection',
      features: samples.map((sample) => {
        const side =
          hemisphere === 'auto'
            ? sample.lat < 0
              ? 'south'
              : 'north'
            : hemisphere;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [sample.lng, sample.lat] },
          properties: {
            speed: sample.speedKt,
            direction: sample.direction,
            icon:
              mode === 'arrow'
                ? arrowIconName(id)
                : barbIconName(id, barbComponents(sample.speedKt).rounded, side),
            // Barbs point into the wind; arrows point downwind.
            rotation:
              mode === 'arrow' ? (sample.direction + 180) % 360 : sample.direction,
          },
        };
      }),
    };
  }, [data, unit, stride, maxBarbs, mode, hemisphere, id]);

  // Icons are created on demand: MapLibre asks for each image name the first
  // time a feature needs it, so only the speeds actually present are drawn.
  // Declared before `useMapSourceLayers` so the listener exists before the
  // layer that triggers it is added.
  useEffect(() => {
    if (!map || !ready) return;
    const prefix = `${id}-`;
    const onMissing = (event: MapStyleImageMissingEvent) => {
      const name = event.id;
      if (!name.startsWith(prefix) || map.hasImage(name)) return;
      let image = null;
      if (name === arrowIconName(id)) {
        image = createArrowImage();
      } else {
        const match = /-barb-([ns])-(\d+)$/.exec(name);
        if (match) {
          image = createBarbImage(Number(match[2]), match[1] === 's' ? 'south' : 'north');
        }
      }
      if (!image) return;
      try {
        map.addImage(
          name,
          { width: image.width, height: image.height, data: image.data },
          { sdf: true, pixelRatio: image.pixelRatio },
        );
      } catch {
        /* a concurrent request may have added it first */
      }
    };
    map.on('styleimagemissing', onMissing);
    return () => {
      map.off('styleimagemissing', onMissing);
    };
  }, [map, ready, styleVersion, id]);

  const source = useMemo<SourceSpecification | null>(
    () =>
      visible && collection ? { type: 'geojson', data: collection as never } : null,
    [visible, collection],
  );

  const stopsKey = colorStops ? JSON.stringify(colorStops) : '';

  const layers = useMemo<ManagedLayer[]>(() => {
    const iconColor = colorStops?.length
      ? [
          'interpolate',
          ['linear'],
          ['get', 'speed'],
          ...colorStops.flatMap(([speed, stop]) => [speed, stop]),
        ]
      : color;
    const iconSize =
      mode === 'arrow'
        ? [
            'interpolate',
            ['linear'],
            ['get', 'speed'],
            arrowSpeedRange[0],
            arrowScale[0] * size,
            arrowSpeedRange[1],
            arrowScale[1] * size,
          ]
        : size;

    return [
      {
        id: `${id}-symbol`,
        type: 'symbol',
        ...(minZoom != null ? { minzoom: minZoom } : {}),
        ...(maxZoom != null ? { maxzoom: maxZoom } : {}),
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-rotate': ['get', 'rotation'],
          // Rotation is a compass bearing, so it must turn with the map.
          'icon-rotation-alignment': 'map',
          'icon-pitch-alignment': 'map',
          'icon-size': iconSize,
          'icon-allow-overlap': allowOverlap,
          'icon-ignore-placement': allowOverlap,
          // Collision boxes are the icon square; trim the padding so barbs can
          // sit closer than a full icon width apart.
          'icon-padding': -ICON_SIZE / 6,
        },
        paint: {
          'icon-color': iconColor,
          'icon-opacity': opacity,
          'icon-halo-color': haloColor,
          'icon-halo-width': haloWidth,
          'icon-halo-blur': 0.5,
        },
      } as ManagedLayer,
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mode, minZoom, maxZoom, color, stopsKey, size, arrowScale[0], arrowScale[1], arrowSpeedRange[0], arrowSpeedRange[1], opacity, haloColor, haloWidth, allowOverlap]);

  useMapSourceLayers({
    sourceId: `${id}-src`,
    source,
    layers,
    ...(beforeId ? { beforeId } : {}),
  });

  return null;
}
