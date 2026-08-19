## Purpose

`geo-utils` holds the geospatial primitives shared across the library: extent
algebra, geodesy, compass-bearing parsing and GeoJSON traversal.

It has no runtime dependencies and no peer dependencies. Nothing in it
references React, MapLibre or a geometry library.

```bash
npm install @hridayanp/geo-utils
```

## Position in the graph

Every other `@hridayanp/*` package depends on this one, and it depends on
nothing. That constraint is deliberate: a dependency added here is a dependency
added to all twelve packages simultaneously.

The absence of peers also makes it usable outside a browser — in a Node service,
a web worker, or a host that is not React — so coordinate conventions and extent
algebra can be shared between a client renderer and a server-side pipeline
without duplication.

## Coordinate conventions

These conventions are fixed here so that no other package re-decides them.

| Convention | Value |
| --- | --- |
| Coordinate reference system | Geographic WGS84 (EPSG:4326) |
| Coordinate order | `[longitude, latitude]`, per GeoJSON |
| Angular unit | Degrees at the API surface; radians internally |
| Extent order | `[west, south, east, north]` |
| Extent semantics | Image or geometry **edges**, not outer cell centres |
| Raster row order | Northern row first |
| Direction convention | `'from'` (meteorological) by default |
| Distance unit | Kilometres |
| Mercator latitude limit | `MERCATOR_MAX_LATITUDE` = 85.051129° |

Rendering is performed by MapLibre in Web Mercator (EPSG:3857). No package in
this library performs reprojection; data in a projected CRS must be transformed
upstream.

## Extents

`Bounds` is `[west, south, east, north]` — the ordering used by MapLibre,
deck.gl and the GeoJSON `bbox` member — so an extent can be passed to any of
them without conversion, and there is never ambiguity about which order a
function expects.

```ts
import {
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
  MERCATOR_MAX_LATITUDE,
} from '@hridayanp/geo-utils';

const extent = boundsFromPoints(coordinates);   // Bounds | null on empty input
const centre = boundsCenter(extent);            // [lng, lat]
const zoom   = boundsToZoom(extent, 1200, 700); // zoom that fits a viewport
const padded = padBounds(extent, 0.1);          // 10% margin on each axis
const merged = unionBounds(a, b);
const shared = intersectBounds(a, b);           // Bounds | null when disjoint
```

`boundsFromPoints` returns `null` for empty input rather than a degenerate
extent, so "no data" remains distinguishable from "a point at 0°, 0°".

### Image corners

`boundsToImageCorners` converts an extent into the four-corner form a MapLibre
`image` source requires:

```ts
boundsToImageCorners([88, 22, 96, 29]);
// [[88, 29], [96, 29], [96, 22], [88, 22]]   — TL, TR, BR, BL
```

Winding order is significant: an incorrect order flips or mirrors the placed
raster. It exists as a named function rather than being written out at each call
site for exactly that reason. `imageCornersToBounds` performs the inverse.

### Mercator limits

`clampLatitude` constrains a latitude to the Web Mercator valid range, and
`wrapLongitude` normalises longitude into `[-180, 180]`. Both are relevant when
deriving an extent from arbitrary input: Web Mercator is undefined at the poles,
and geometry beyond `MERCATOR_MAX_LATITUDE` cannot be projected.

## Geodesy

```ts
import {
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
  COMPASS_16,
  COMPASS_TO_DEGREES,
  EARTH_RADIUS_KM,
} from '@hridayanp/geo-utils';

haversineDistanceKm([90, 24], [95, 28]);   // great-circle distance, km
bearingBetween([90, 24], [95, 28]);        // initial bearing, degrees
destinationPoint([90, 24], 45, 250);       // [lng, lat] 250 km on bearing 45°
circlePositions([92, 25.5], 200, 96);      // closed 200 km great-circle ring
degreesToCompass(247.5);                   // 'WSW'
```

Distances use the haversine formula on a sphere of radius `EARTH_RADIUS_KM`
(6371.0088 km, the IUGG mean radius). This is accurate to roughly 0.5% against
an ellipsoidal geodesic — appropriate for range rings, proximity filtering and
labelling, and not appropriate for survey-grade measurement.

`circlePositions` walks great-circle bearings rather than constructing a planar
circle, so a range ring remains geodesically correct at high latitude instead of
distorting.

### Bearing parsing

`parseDirection` accepts the spellings operational feeds actually emit, and
returns degrees or `null`:

```ts
parseDirection('SSW');                // 202.5
parseDirection('South-Southwest');    // 202.5
parseDirection('SOUTHSOUTHWEST');     // 202.5
parseDirection('247.5°');             // 247.5
parseDirection(247.5);                // 247.5
parseDirection('calm');               // null
```

Concentrating this in one function keeps string normalisation out of every
render path that handles a bearing.

### Direction convention

```ts
speedDirectionToUV(12, 225, 'from');      // meteorological default
speedDirectionToUV(12, 225, 'towards');   // the value is the heading of travel
uvToSpeedDirection(u, v, 'from');         // round-trips
reverseBearing(225);                      // 45
```

Meteorological data reports the bearing a flow originates **from**;
oceanographic and drift data conventionally report the bearing of travel.
Inverting this is the most frequent cause of a flow field animating in the wrong
direction — see
[`wind-particle-layer`](/docs/wind-particle-layer#direction-convention).

## GeoJSON

```ts
import {
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
  POINT_TYPES,
  LINE_TYPES,
  POLYGON_TYPES,
} from '@hridayanp/geo-utils';
```

`toFeatureCollection` normalises a FeatureCollection, a bare Feature, a raw
geometry, or an array of features into a single shape. That one function is why
every component in this library accepts "any GeoJSON shape" — normalisation
happens once, at the boundary.

`iterateCoordinates` is a **generator**. Traversing a large collection to compute
an extent allocates nothing beyond the current position, rather than flattening
hundreds of thousands of coordinates into an intermediate array:

```ts
for (const [lng, lat] of iterateCoordinates(featureCollection)) { … }
```

`pickProperty` resolves the first matching key from an alias list — the
mechanism underlying the property-name tolerance in `wind-particle-layer`:

```ts
pickProperty(feature, ['wind_speed_kt', 'speed', 'ws']);
```

`geometryAnchor` returns a representative position for any geometry — a
polygon's centroid, a line's midpoint, a point itself — which is what a label or
a popup anchor requires. `toFiniteNumber` coerces an unknown property value to a
finite number or `null`, which is the common case when reading attributes from
an external feed.

`POINT_TYPES`, `LINE_TYPES` and `POLYGON_TYPES` are the geometry-type groupings
`vector-layer` uses to construct its `['match', ['geometry-type'], …]` filters.

## Types

```ts
import type {
  Bounds,                    // [west, south, east, north]
  LngLat,                    // [lng, lat]
  GeoJsonPosition,
  ImageCorners,
  ViewState,
  GeometryType,
  GeoJson,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  GeoJsonGeometry,
} from '@hridayanp/geo-utils';
```

The GeoJSON types are **structural** and defined in this package rather than
imported from `@types/geojson`. A consumer therefore never needs an additional
types package to satisfy this library's signatures, and no project can end up
with two incompatible GeoJSON type definitions.

They are structurally compatible with `@types/geojson`, so values typed by
either definition are assignable in both directions.
