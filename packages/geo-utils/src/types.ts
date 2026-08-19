/**
 * Core geospatial value types shared across every `@hridayanp/*` package.
 *
 * These are deliberately structural (plain tuples and objects) so a host
 * application never has to construct a library-specific class to talk to a
 * component.
 */

/** `[longitude, latitude]`, in degrees (WGS84). */
export type LngLat = [longitude: number, latitude: number];

/**
 * Geographic bounding box as `[west, south, east, north]` in degrees.
 *
 * This is the same ordering used by MapLibre's `LngLatBounds.toArray().flat()`,
 * deck.gl's `BitmapLayer.bounds` and GeoJSON's `bbox` member, so it can be
 * handed straight to any of them.
 */
export type Bounds = [west: number, south: number, east: number, north: number];

/**
 * The four corner coordinates of an image, in the order MapLibre's
 * `image` source expects: top-left, top-right, bottom-right, bottom-left.
 */
export type ImageCorners = [LngLat, LngLat, LngLat, LngLat];

/** A map viewport described independently of any mapping library. */
export interface ViewState {
  center: LngLat;
  zoom: number;
  bearing?: number;
  pitch?: number;
}

/** Minimal structural GeoJSON typings — no dependency on `@types/geojson`. */
export type GeoJsonPosition = number[];

export type GeometryType =
  | 'Point'
  | 'MultiPoint'
  | 'LineString'
  | 'MultiLineString'
  | 'Polygon'
  | 'MultiPolygon'
  | 'GeometryCollection';

export interface GeoJsonGeometry {
  type: GeometryType;
  coordinates?: unknown;
  geometries?: GeoJsonGeometry[];
}

export interface GeoJsonFeature<
  P extends Record<string, unknown> = Record<string, unknown>,
> {
  type: 'Feature';
  id?: string | number;
  geometry: GeoJsonGeometry | null;
  properties: P | null;
  bbox?: number[];
}

export interface GeoJsonFeatureCollection<
  P extends Record<string, unknown> = Record<string, unknown>,
> {
  type: 'FeatureCollection';
  features: Array<GeoJsonFeature<P>>;
  bbox?: number[];
}

export type GeoJson<P extends Record<string, unknown> = Record<string, unknown>> =
  | GeoJsonFeature<P>
  | GeoJsonFeatureCollection<P>
  | GeoJsonGeometry;
