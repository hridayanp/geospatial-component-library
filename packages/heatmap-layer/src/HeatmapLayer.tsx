import { useMemo } from 'react';
import type { SourceSpecification } from 'maplibre-gl';
import {
  toFeatureCollection,
  type GeoJson,
  type GeoJsonFeature,
} from '@hridayanp/geo-utils';
import { useMapSourceLayers, type ManagedLayer } from '@hridayanp/map-container';
import {
  sampleColorScale,
  toRgba,
  type ColorScaleInput,
} from '@hridayanp/raster-utils';

/** A number, or `[zoom, value]` stops interpolated linearly across zoom. */
export type ZoomValue = number | ReadonlyArray<readonly [zoom: number, value: number]>;

export interface HeatmapLayerProps {
  /** Unique layer id; sub-layer ids are derived from it. */
  id?: string;
  /** Point or MultiPoint features. Other geometries are ignored. */
  data?: GeoJson | GeoJsonFeature[] | null;
  /** Hide without unmounting. Default `true`. */
  visible?: boolean;
  /** Draw below this existing layer id. */
  beforeId?: string;
  minZoom?: number;
  maxZoom?: number;

  /**
   * Property whose value weights each point. Omit to count points equally —
   * then the surface is plain point density.
   */
  weightProperty?: string;
  /**
   * Range of `weightProperty` mapped onto weights `0..1`. Default `[0, 1]`,
   * which suits probabilities; set it to the variable's real range otherwise.
   */
  weightDomain?: [number, number];

  /** Kernel radius in pixels. Default `[[3, 12], [9, 40]]`. */
  radius?: ZoomValue;
  /**
   * Multiplier on the summed density. Raise it at low zoom, where points are
   * close together on screen, to keep the colour range in use. Default `1`.
   */
  intensity?: ZoomValue;
  /**
   * Colour ramp from low to high density. The lowest stop is always rendered
   * transparent — otherwise the ramp's first colour would cover the whole map.
   */
  colorScale?: ColorScaleInput;
  /** Layer opacity, `0..1`. Default `0.8`. */
  opacity?: number;

  /**
   * Cross-fade from the heatmap to individual points from this zoom upward.
   * Density surfaces mislead at street level, where the individual points are
   * what the reader wants. Omit to never show points.
   */
  pointsFromZoom?: number;
  /** Point colour once `pointsFromZoom` is reached. Default the ramp's top colour. */
  pointColor?: string;
  /** Point radius in pixels. Default `4`. */
  pointRadius?: number;
}

const DEFAULT_RAMP = ['#0d0887', '#5c01a6', '#9c179e', '#cc4778', '#ed7953', '#fb9f3a', '#f0f921'];

const zoomExpression = (value: ZoomValue): unknown =>
  typeof value === 'number'
    ? value
    : ['interpolate', ['linear'], ['zoom'], ...value.flatMap(([z, v]) => [z, v])];

/**
 * A point-density heatmap computed on the GPU by MapLibre.
 *
 * Use it for the shape of a distribution — where reports cluster, where
 * lightning struck — when individual points are too many to read. For a
 * statistically defined surface with a chosen bandwidth, compute one with
 * `kernelDensity` from `@hridayanp/hotspot-analysis` and draw it with
 * `RasterLayer` instead: this layer's kernel is in screen pixels, so the
 * surface changes as the reader zooms.
 *
 * ```tsx
 * <HeatmapLayer data={strikes} weightProperty="peakCurrent" weightDomain={[0, 120]} pointsFromZoom={10} />
 * ```
 */
export function HeatmapLayer({
  id = 'gcl-heatmap',
  data,
  visible = true,
  beforeId,
  minZoom,
  maxZoom,
  weightProperty,
  weightDomain = [0, 1],
  radius = [
    [3, 12],
    [9, 40],
  ],
  intensity = 1,
  colorScale = DEFAULT_RAMP,
  opacity = 0.8,
  pointsFromZoom,
  pointColor,
  pointRadius = 4,
}: HeatmapLayerProps) {
  const collection = useMemo(() => toFeatureCollection(data ?? null), [data]);

  const source = useMemo<SourceSpecification | null>(
    () => (visible ? { type: 'geojson', data: collection as never } : null),
    [visible, collection],
  );

  const rampKey = JSON.stringify(colorScale);
  const radiusKey = JSON.stringify(radius);
  const intensityKey = JSON.stringify(intensity);

  const layers = useMemo<ManagedLayer[]>(() => {
    const colors = sampleColorScale(colorScale, 7);
    const [r, g, b] = toRgba(colors[0] ?? '#000000');
    const densityStops: unknown[] = [0, `rgba(${r}, ${g}, ${b}, 0)`];
    colors.forEach((color, index) => {
      // Spread the visible colours across (0, 1]; density 0 stays clear.
      densityStops.push(0.05 + (index / (colors.length - 1)) * 0.95, color);
    });

    const weight = weightProperty
      ? [
          'interpolate',
          ['linear'],
          ['to-number', ['get', weightProperty], 0],
          weightDomain[0],
          0,
          weightDomain[1],
          1,
        ]
      : 1;

    const zoomRange = {
      ...(minZoom != null ? { minzoom: minZoom } : {}),
      ...(maxZoom != null ? { maxzoom: maxZoom } : {}),
    };

    const fadeOut =
      pointsFromZoom != null
        ? [
            'interpolate',
            ['linear'],
            ['zoom'],
            pointsFromZoom - 1,
            opacity,
            pointsFromZoom,
            0,
          ]
        : opacity;

    const built: ManagedLayer[] = [
      {
        id: `${id}-heat`,
        type: 'heatmap',
        ...zoomRange,
        paint: {
          'heatmap-weight': weight,
          'heatmap-radius': zoomExpression(radius),
          'heatmap-intensity': zoomExpression(intensity),
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], ...densityStops],
          'heatmap-opacity': fadeOut,
        },
      } as ManagedLayer,
    ];

    if (pointsFromZoom != null) {
      built.push({
        id: `${id}-points`,
        type: 'circle',
        minzoom: pointsFromZoom - 1,
        ...(maxZoom != null ? { maxzoom: maxZoom } : {}),
        paint: {
          'circle-radius': pointRadius,
          'circle-color': pointColor ?? colors[colors.length - 1] ?? '#f0f921',
          'circle-stroke-color': 'rgba(11, 18, 32, 0.8)',
          'circle-stroke-width': 1,
          'circle-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            pointsFromZoom - 1,
            0,
            pointsFromZoom,
            1,
          ],
          'circle-stroke-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            pointsFromZoom - 1,
            0,
            pointsFromZoom,
            1,
          ],
        },
      } as ManagedLayer);
    }
    return built;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, rampKey, radiusKey, intensityKey, weightProperty, weightDomain[0], weightDomain[1], opacity, minZoom, maxZoom, pointsFromZoom, pointColor, pointRadius]);

  useMapSourceLayers({
    sourceId: `${id}-src`,
    source,
    layers,
    ...(beforeId ? { beforeId } : {}),
  });

  return null;
}
