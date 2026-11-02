import {
  getFeatures,
  toFeatureCollection,
  toFiniteNumber,
  type GeoJson,
  type GeoJsonFeature,
  type GeoJsonFeatureCollection,
  type LngLat,
} from '@hridayanp/geo-utils';
import type { HotspotClass, GiStarResult } from './getisOrd';

/**
 * Confidence-band symbology for a Gi\* result.
 *
 * Hot and cold are **opposite states either side of "no clustering"**, so the
 * scale is diverging: two hues that read as opposite — warm for high-value
 * clusters, cool for low-value ones — with a neutral midpoint for observations
 * that are not significant. A single-hue ramp would imply an ordering from cold
 * to hot through the middle, which is not what the statistic says.
 *
 * Confidence is encoded as lightness within each arm, so the three bands read
 * as an ordered sequence rather than three unrelated colours.
 */
export const HOTSPOT_COLORS: Record<HotspotClass, string> = {
  'hot-99': '#b02418',
  'hot-95': '#eb6834',
  'hot-90': '#f2a883',
  'not-significant': '#d8d7d2',
  'cold-90': '#9ec5f4',
  'cold-95': '#3987e5',
  'cold-99': '#184f95',
};

/** Human-readable band labels, matching the convention used on published maps. */
export const HOTSPOT_LABELS: Record<HotspotClass, string> = {
  'hot-99': 'Hot spot — 99% confidence',
  'hot-95': 'Hot spot — 95% confidence',
  'hot-90': 'Hot spot — 90% confidence',
  'not-significant': 'Not significant',
  'cold-90': 'Cold spot — 90% confidence',
  'cold-95': 'Cold spot — 95% confidence',
  'cold-99': 'Cold spot — 99% confidence',
};

/** Legend entries for `GeoLegend`'s `classes` prop, in diverging order. */
export function hotspotLegendClasses(): Array<{
  color: string;
  label: string;
}> {
  const order: HotspotClass[] = [
    'hot-99',
    'hot-95',
    'hot-90',
    'not-significant',
    'cold-90',
    'cold-95',
    'cold-99',
  ];
  return order.map((cluster) => ({
    color: HOTSPOT_COLORS[cluster],
    label: HOTSPOT_LABELS[cluster],
  }));
}

/**
 * Positions and values read out of a GeoJSON collection.
 *
 * Only Point geometry is extracted. Gi\* is defined over discrete observations
 * at locations, so a polygon must first be reduced to a representative point —
 * `geometryAnchor` from `@hridayanp/geo-utils` does that, and doing it
 * explicitly keeps the choice of representative point visible rather than
 * hidden inside the statistic.
 */
export interface ExtractedObservations {
  positions: LngLat[];
  values: number[];
  /** Features that yielded a position and a finite value, in the same order. */
  features: GeoJsonFeature[];
  /** Features skipped for absent geometry or a non-finite value. */
  skipped: number;
}

/**
 * Extract analysable observations from a GeoJSON collection.
 *
 * @param valueProperty Property carrying the quantity to analyse. Pass an array
 * to accept the first present alias, as feeds rarely agree on a name.
 */
export function extractObservations(
  data: GeoJson | GeoJsonFeature[],
  valueProperty: string | readonly string[],
): ExtractedObservations {
  const aliases =
    typeof valueProperty === 'string' ? [valueProperty] : valueProperty;

  const positions: LngLat[] = [];
  const values: number[] = [];
  const features: GeoJsonFeature[] = [];
  let skipped = 0;

  for (const feature of getFeatures(toFeatureCollection(data))) {
    const geometry = feature.geometry;
    if (geometry?.type !== 'Point') {
      skipped += 1;
      continue;
    }

    let value: number | null = null;
    for (const alias of aliases) {
      value = toFiniteNumber(feature.properties?.[alias]);
      if (value !== null) break;
    }
    if (value === null) {
      skipped += 1;
      continue;
    }

    const [lng, lat] = geometry.coordinates as [number, number];
    positions.push([lng, lat]);
    values.push(value);
    features.push(feature);
  }

  return { positions, values, features, skipped };
}

/** Properties written onto each feature by {@link toHotspotFeatures}. */
export interface HotspotProperties {
  gi_z_score: number;
  gi_p_value: number;
  gi_cluster: HotspotClass;
  gi_neighbours: number;
  gi_color: string;
}

/**
 * Attach Gi\* results to their source features as GeoJSON properties.
 *
 * The result is an ordinary FeatureCollection, so it renders through the
 * existing `VectorLayer` with a data-driven expression rather than requiring a
 * layer of its own:
 *
 * ```tsx
 * <VectorLayer
 *   data={hotspots}
 *   pointColor={['get', 'gi_color']}
 *   pointRadius={['interpolate', ['linear'], ['abs', ['get', 'gi_z_score']], 0, 3, 4, 9]}
 * />
 * ```
 *
 * Writing the resolved colour as a property, rather than only the class name,
 * keeps the expression a plain `['get', …]` and guarantees the map agrees with
 * the legend `hotspotLegendClasses()` produces.
 */
export function toHotspotFeatures(
  features: readonly GeoJsonFeature[],
  results: readonly GiStarResult[],
): GeoJsonFeatureCollection {
  if (features.length !== results.length) {
    throw new Error(
      `[gcl] toHotspotFeatures: ${features.length} features but ${results.length} results. Pass the features returned by extractObservations.`,
    );
  }

  return {
    type: 'FeatureCollection',
    features: features.map((feature, i) => {
      const result = results[i]!;
      const properties: HotspotProperties = {
        gi_z_score: result.zScore,
        gi_p_value: result.pValue,
        gi_cluster: result.cluster,
        gi_neighbours: result.neighbourCount,
        gi_color: HOTSPOT_COLORS[result.cluster],
      };
      return {
        ...feature,
        properties: { ...feature.properties, ...properties },
      };
    }),
  };
}
