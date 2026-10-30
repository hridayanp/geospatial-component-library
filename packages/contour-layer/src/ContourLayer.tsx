import { useMemo } from 'react';
import type { SourceSpecification } from 'maplibre-gl';
import {
  useMap,
  useMapSourceLayers,
  type ManagedLayer,
} from '@hridayanp/map-container';
import {
  colorAt,
  type ColorScaleInput,
  type RasterData,
} from '@hridayanp/raster-utils';
import { computeContours, type ComputeContoursOptions } from './contours';

export interface ContourLayerProps extends ComputeContoursOptions {
  /** Unique layer id; sub-layer ids are derived from it. */
  id?: string;
  /** The grid to contour. `null` renders nothing. */
  data?: RasterData | null;
  /** Hide without unmounting. Default `true`. */
  visible?: boolean;
  /** Draw below this existing layer id. */
  beforeId?: string;
  /** Restrict the layer to a zoom range. */
  minZoom?: number;
  maxZoom?: number;

  /** Line colour when no `colorScale` is given. Default `'#e2e8f0'`. */
  color?: string;
  /**
   * Colour each contour by its value across the level range — isotherms from
   * blue to red, say. Overrides `color`.
   */
  colorScale?: ColorScaleInput;
  /** Width of ordinary contours in pixels. Default `1`. */
  width?: number;
  /** Width of index (major) contours in pixels. Default `2`. */
  majorWidth?: number;
  /** Line opacity, `0..1`. Default `0.9`. */
  opacity?: number;
  /** Dash pattern in line widths, e.g. `[3, 2]` for a dashed field. */
  dasharray?: number[];

  /**
   * Label index contours along the line. Default `true`.
   *
   * Labels need a `glyphs` URL in the map style; on a style without one they
   * are skipped silently rather than failing the whole layer.
   */
  labels?: boolean;
  /** Label every contour, not only the index ones. Default `false`. */
  labelAll?: boolean;
  /** Turns a contour value into its label. Default: the value, trimmed. */
  formatLabel?: (value: number) => string;
  /** Label font size in pixels. Default `11`. */
  labelSize?: number;
  /** Label colour. Defaults to the line colour. */
  labelColor?: string;
  /** Halo drawn behind labels for legibility. Default `'rgba(11,18,32,0.85)'`. */
  labelHaloColor?: string;
  /** Font stack for labels; must exist on the style's glyph server. */
  labelFont?: string[];
}

const defaultFormat = (value: number): string =>
  String(Number.parseFloat(value.toPrecision(6)));

/**
 * Contour lines — isobars, isotherms, isohyets — traced from a raster and drawn
 * by MapLibre.
 *
 * The raster is contoured in JavaScript with {@link computeContours} and the
 * result is an ordinary GeoJSON source, so pan and zoom cost nothing and a new
 * frame replaces the data in place without a flash.
 *
 * ```tsx
 * <ContourLayer data={mslp} interval={4} base={1000} majorEvery={5} />
 * ```
 *
 * Index contours (every `majorEvery`-th level, counted from `base`) are drawn
 * thicker and carry the labels — the cartographic convention that lets a
 * reader count lines without labelling all of them.
 */
export function ContourLayer({
  id = 'gcl-contour',
  data,
  visible = true,
  beforeId,
  minZoom,
  maxZoom,
  levels,
  interval,
  base,
  count,
  min,
  max,
  smoothing,
  minVertices,
  majorEvery,
  color = '#e2e8f0',
  colorScale,
  width = 1,
  majorWidth = 2,
  opacity = 0.9,
  dasharray,
  labels = true,
  labelAll = false,
  formatLabel = defaultFormat,
  labelSize = 11,
  labelColor,
  labelHaloColor = 'rgba(11, 18, 32, 0.85)',
  labelFont = ['Open Sans Regular', 'Arial Unicode MS Regular'],
}: ContourLayerProps) {
  const { map, ready, styleVersion } = useMap();

  // Spread into a key rather than depending on the array identity, so an
  // inline `levels={[0, 10]}` does not recompute on every render.
  const levelsKey = levels ? levels.join(',') : '';

  const collection = useMemo(() => {
    if (!data) return null;
    const contours = computeContours(data, {
      ...(levels ? { levels } : {}),
      ...(interval != null ? { interval } : {}),
      ...(base != null ? { base } : {}),
      ...(count != null ? { count } : {}),
      ...(min != null ? { min } : {}),
      ...(max != null ? { max } : {}),
      ...(smoothing != null ? { smoothing } : {}),
      ...(minVertices != null ? { minVertices } : {}),
      ...(majorEvery != null ? { majorEvery } : {}),
    });

    // Colour and label text are resolved here, once per frame, so the style
    // needs nothing more than `['get', ...]`.
    const values = contours.features.map(
      (feature) => (feature.properties as { value: number }).value,
    );
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    for (const feature of contours.features) {
      const properties = feature.properties as Record<string, unknown>;
      const value = properties['value'] as number;
      properties['label'] = formatLabel(value);
      properties['color'] = colorScale
        ? colorAt(colorScale, hi > lo ? (value - lo) / (hi - lo) : 0.5)
        : color;
    }
    return contours;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, levelsKey, interval, base, count, min, max, smoothing, minVertices, majorEvery, color, colorScale, formatLabel]);

  // Text needs a glyph server. Re-checked after every style swap, since a new
  // basemap may add or remove one.
  const hasGlyphs = useMemo(() => {
    if (!map || !ready) return false;
    try {
      return Boolean(map.getStyle()?.glyphs);
    } catch {
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready, styleVersion]);

  const source = useMemo<SourceSpecification | null>(
    () =>
      visible && collection ? { type: 'geojson', data: collection as never } : null,
    [visible, collection],
  );

  const layers = useMemo<ManagedLayer[]>(() => {
    const zoomRange = {
      ...(minZoom != null ? { minzoom: minZoom } : {}),
      ...(maxZoom != null ? { maxzoom: maxZoom } : {}),
    };
    const built: ManagedLayer[] = [
      {
        id: `${id}-line`,
        type: 'line',
        ...zoomRange,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['get', 'major'], majorWidth, width],
          'line-opacity': opacity,
          ...(dasharray ? { 'line-dasharray': dasharray } : {}),
        },
      } as ManagedLayer,
    ];

    if (labels && hasGlyphs) {
      built.push({
        id: `${id}-label`,
        type: 'symbol',
        ...zoomRange,
        ...(labelAll ? {} : { filter: ['==', ['get', 'major'], true] }),
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'label'],
          'text-size': labelSize,
          'text-font': labelFont,
          'symbol-spacing': 280,
          'text-keep-upright': true,
          'text-max-angle': 30,
        },
        paint: {
          'text-color': labelColor ?? ['get', 'color'],
          'text-halo-color': labelHaloColor,
          'text-halo-width': 1.5,
        },
      } as ManagedLayer);
    }
    return built;
  }, [
    id,
    minZoom,
    maxZoom,
    majorWidth,
    width,
    opacity,
    dasharray,
    labels,
    hasGlyphs,
    labelAll,
    labelSize,
    labelFont,
    labelColor,
    labelHaloColor,
  ]);

  useMapSourceLayers({
    sourceId: `${id}-src`,
    source,
    layers,
    ...(beforeId ? { beforeId } : {}),
  });

  return null;
}
