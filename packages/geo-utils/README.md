# @hridayanp/geo-utils

Dependency-free geospatial maths: bounds, geodesy, compass parsing and GeoJSON
traversal.

Nothing here imports React, MapLibre or a geometry library, so it is equally
usable in a web worker, on a server, or in a host that is not React at all. It
is also the one package every other `@hridayanp/*` package depends on, which is
exactly why it stays this light.

## Installation

```bash
npm install @hridayanp/geo-utils
```


## Bounds

Bounds are `[west, south, east, north]` throughout — the same ordering used by
MapLibre, deck.gl and GeoJSON's `bbox` — so a box can be handed to any of them
without conversion.

```ts
import {
  boundsCenter,
  boundsFromPoints,
  boundsToImageCorners,
  boundsToZoom,
  padBounds,
  unionBounds,
} from '@hridayanp/geo-utils';

const bounds = boundsFromPoints(coordinates);          // [w, s, e, n] | null
const centre = boundsCenter(bounds);                    // [lng, lat]
const zoom = boundsToZoom(bounds, 1200, 700);           // fits a viewport
const corners = boundsToImageCorners(bounds);           // MapLibre image source
```

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

haversineDistanceKm([90, 24], [95, 28]);   // 655.9 km
bearingBetween([90, 24], [95, 28]);        // 46.7°
destinationPoint([90, 24], 45, 250);       // [lng, lat] 250 km away
circlePositions([92, 25.5], 200, 96);      // a closed great-circle ring
```

`parseDirection` accepts every spelling real feeds use — `'SSW'`,
`'South-Southwest'`, `'SOUTHSOUTHWEST'`, `247.5`, `'247.5°'` — and returns
degrees or `null`. Handling that in one place keeps it out of every render path
that touches a direction.

`speedDirectionToUV` takes a `convention`: `'from'` (the meteorological
default, where the bearing is where the flow originates) or `'towards'`.
Getting this backwards is the most common reason a particle field flows the
wrong way.

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

`toFeatureCollection` coerces a FeatureCollection, a bare Feature, a geometry
or an array of features into one shape, so components can accept whatever the
host already has. `iterateCoordinates` is a generator — walking a large
collection allocates nothing beyond the current position.

## Types

`Bounds`, `LngLat`, `ImageCorners`, `ViewState`, and structural GeoJSON types
(`GeoJsonFeature`, `GeoJsonFeatureCollection`, `GeoJsonGeometry`) with no
dependency on `@types/geojson`.

## Documentation

Interactive examples for every prop live in the workspace Storybook:

```bash
npm run storybook
```

## License

MIT
