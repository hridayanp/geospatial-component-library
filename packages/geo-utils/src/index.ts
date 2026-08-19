/**
 * `@hridayanp/geo-utils`
 *
 * Dependency-free geospatial maths shared by the rest of the library. Nothing
 * here touches React, MapLibre or the DOM, so it is equally usable in a worker,
 * on a server, or in a non-React host.
 */

export type {
  Bounds,
  GeoJson,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  GeoJsonGeometry,
  GeoJsonPosition,
  GeometryType,
  ImageCorners,
  LngLat,
  ViewState,
} from './types';

export {
  MERCATOR_MAX_LATITUDE,
  boundsCenter,
  boundsContain,
  boundsFromCenter,
  boundsFromPoints,
  boundsHeight,
  boundsToImageCorners,
  boundsToZoom,
  boundsWidth,
  clampLatitude,
  imageCornersToBounds,
  intersectBounds,
  isBounds,
  padBounds,
  unionBounds,
  wrapLongitude,
} from './bounds';

export {
  COMPASS_16,
  COMPASS_TO_DEGREES,
  EARTH_RADIUS_KM,
  bearingBetween,
  circlePositions,
  degreesToCompass,
  destinationPoint,
  formatDegrees,
  haversineDistanceKm,
  normalizeDegrees,
  parseDirection,
  reverseBearing,
  speedDirectionToUV,
  uvToSpeedDirection,
} from './geodesy';
export type { CompassPoint } from './geodesy';

export {
  LINE_TYPES,
  POINT_TYPES,
  POLYGON_TYPES,
  geoJsonBounds,
  geometryAnchor,
  getFeatures,
  isFeature,
  isFeatureCollection,
  iterateCoordinates,
  pickProperty,
  toFeatureCollection,
  toFiniteNumber,
  withFeatureProperty,
} from './geojson';
