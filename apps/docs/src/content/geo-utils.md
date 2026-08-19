Dependency-free geospatial maths: bounds, geodesy, compass parsing and GeoJSON
traversal. Zero runtime dependencies, no React, no MapLibre.

```bash
npm install @hridayanp/geo-utils
```

## The base of the graph

Every other `@hridayanp/*` package depends on this one, and it depends on
nothing. That is exactly why it stays this light — a dependency added here is a
dependency added to all twelve packages at once.

It has no peer dependencies either, so it runs in a web worker, on a server,
inside a non-React host, or in a plain script tag.

## Bounds

Bounds are `[west, south, east, north]` **everywhere** in this library — the same
ordering MapLibre, deck.gl and GeoJSON's `bbox` use. A box can be handed to any
of them without conversion, and there is never a question of which order a given
function expects.

```ts
import {
  boundsCenter,
  boundsFromPoints,
  boundsToImageCorners,
  boundsToZoom,
  padBounds,
  unionBounds,
  boundsIntersect,
  containsPoint,
} from '@hridayanp/geo-utils';

const bounds = boundsFromPoints(coordinates);   // [w, s, e, n] | null on empty
const centre = boundsCenter(bounds);            // [lng, lat]
const zoom   = boundsToZoom(bounds, 1200, 700); // fits a 1200×700 viewport
const padded = padBounds(bounds, 0.1);          // 10% margin
const all    = unionBounds([a, b, c]);
```

`boundsToImageCorners` converts a box into the four-corner form a MapLibre
`image` source requires:

```ts
boundsToImageCorners([88, 22, 96, 29]);
// [[88,29], [96,29], [96,22], [88,22]]   — TL, TR, BR, BL
```

Getting that winding order wrong flips or mirrors the raster, which is why it
exists as a function rather than being written out at each call site.

`boundsFromPoints` returns `null` for an empty input rather than a degenerate
box, so "no data" stays distinguishable from "a point at 0,0".

## Geodesy

```ts
import {
  bearingBetween,
  circlePositions,
  degreesToCompass,
  destinationPoint,
  haversineDistanceKm,
  parseDirection,
  speedDirectionToUV,
  uvToSpeedDirection,
} from '@hridayanp/geo-utils';

haversineDistanceKm([90, 24], [95, 28]);   // 655.9
bearingBetween([90, 24], [95, 28]);        // 46.7
destinationPoint([90, 24], 45, 250);       // [lng, lat] 250 km on bearing 45°
circlePositions([92, 25.5], 200, 96);      // a closed 200 km great-circle ring
degreesToCompass(247.5);                   // 'WSW'
```

`circlePositions` walks great-circle bearings rather than drawing a planar
circle, so a radius ring stays correct at high latitude instead of squashing.

### `parseDirection`

Accepts every spelling real feeds actually use, and returns degrees or `null`:

```ts
parseDirection('SSW');                // 202.5
parseDirection('South-Southwest');    // 202.5
parseDirection('SOUTHSOUTHWEST');     // 202.5
parseDirection('247.5°');             // 247.5
parseDirection(247.5);                // 247.5
parseDirection('calm');               // null
```

Handling this in one place is what keeps a pile of string normalisation out of
every render path that touches a direction.

### Direction convention

```ts
speedDirectionToUV(12, 225, 'from');      // meteorological default
speedDirectionToUV(12, 225, 'towards');   // the value IS the heading
uvToSpeedDirection(u, v, 'from');         // round-trips
```

Meteorological data reports where wind comes **from**. Oceanographic and drift
data usually report where it is going. Getting this backwards is the single most
common reason a particle field flows the wrong way — see
[`wind-particle-layer`](/docs/wind-particle-layer#direction-convention).

## GeoJSON

```ts
import {
  geoJsonBounds,
  geometryAnchor,
  getFeatures,
  iterateCoordinates,
  pickProperty,
  toFeatureCollection,
  withFeatureProperty,
} from '@hridayanp/geo-utils';
```

`toFeatureCollection` coerces a FeatureCollection, a bare Feature, a raw
geometry, or an array of features into one shape:

```ts
toFeatureCollection(anything);   // → GeoJsonFeatureCollection
```

That single function is why every component in this library accepts "any GeoJSON
shape" — the normalisation happens once, at the boundary.

`iterateCoordinates` is a **generator**. Walking a large collection to compute
bounds allocates nothing beyond the current position, rather than flattening
hundreds of thousands of coordinates into an intermediate array:

```ts
for (const [lng, lat] of iterateCoordinates(featureCollection)) { … }
```

`pickProperty` reads the first matching key from an alias list — the mechanism
behind the wide property-name tolerance in `wind-particle-layer`:

```ts
pickProperty(feature, ['wind_speed_kt', 'speed', 'ws']);
```

`geometryAnchor` returns a representative point for any geometry — a polygon's
centroid, a line's midpoint, a point itself — which is what a label or a popup
needs.

## Types

```ts
import type {
  Bounds,                    // [west, south, east, north]
  LngLat,                    // [lng, lat]
  ImageCorners,
  ViewState,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  GeoJsonGeometry,
} from '@hridayanp/geo-utils';
```

The GeoJSON types are **structural**, defined here rather than imported from
`@types/geojson`. A consumer therefore never has to install a types package to
satisfy this library's signatures, and there is no risk of two incompatible
GeoJSON type definitions in one project.

They are structurally compatible with `@types/geojson`, so passing types from
either direction works.

## Conventions this package fixes

Small decisions, made once here so no other package has to re-decide them:

| Convention | Value |
| --- | --- |
| Bounds order | `[west, south, east, north]` |
| Coordinate order | `[lng, lat]` — GeoJSON order, not lat/lng |
| Raster row order | North row first |
| `bounds` semantics | Image edges, not outer pixel centres |
| Direction default | `'from'` (meteorological) |
| Distance unit | Kilometres |
| Angles | Degrees at the API surface, radians internally |
