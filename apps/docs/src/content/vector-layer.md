## Purpose

`VectorLayer` renders GeoJSON of any geometry type on a MapLibre map, with
symbology configured entirely through props and MapLibre expressions.

One component covers Point, MultiPoint, LineString, MultiLineString, Polygon and
MultiPolygon. The geometry-specific style layers MapLibre requires are derived
internally, so the caller configures one component rather than assembling four.

```bash
npm install @hridayanp/vector-layer @hridayanp/map-container maplibre-gl react
```

```tsx
<VectorLayer
  data={featureCollection}
  fill="#38bdf8"
  fillOpacity={0.3}
  stroke="#38bdf8"
  strokeWidth={1.5}
/>
```

## Responsibilities

| Concern | Owner |
| --- | --- |
| GeoJSON normalisation to a FeatureCollection | `VectorLayer` |
| Source and sub-layer lifecycle | `VectorLayer` |
| Geometry-type filtering and symbology application | `VectorLayer` |
| Clustering configuration and simplification tolerance | `VectorLayer` |
| Feature acquisition, joins, attribute derivation | Host application |
| Interpretation of feature properties | Host application |

## Data model

```tsx
data={featureCollection}   // GeoJsonFeatureCollection
data={feature}             // a single GeoJsonFeature
data={geometry}            // a bare GeoJsonGeometry
data={[featureA, featureB]}// an array of features
data={null}                // renders nothing
```

Input is normalised through `toFeatureCollection` from
[`geo-utils`](/docs/geo-utils), so whichever shape the host already holds is
accepted without conversion. A GeometryCollection is traversed for extent
computation.

Coordinates are geographic WGS84 (EPSG:4326) in `[longitude, latitude]` order,
per the GeoJSON specification.

## Rendering model

One MapLibre `geojson` source backs up to five style layers, each filtered to
the geometry types it can render:

| Layer id | MapLibre type | Geometry filter |
| --- | --- | --- |
| `{id}-fill` | `fill` | Polygon, MultiPolygon |
| `{id}-outline` | `line` | Polygon, MultiPolygon |
| `{id}-line` | `line` | LineString, MultiLineString |
| `{id}-point` | `circle` | Point, MultiPoint |
| `{id}-hit` | `circle` | Point, MultiPoint — present only when `hitRadius > 0` |

Separate sub-layers are the only mechanism by which MapLibre permits geometry
types to be styled independently. The decomposition is an implementation detail
of the rendering model; the configuration surface remains a single component.

Sub-layer identifiers are part of the public contract, because
[`geo-hover`](/docs/geo-hover) is scoped by layer id:

```tsx
<VectorLayer id="sites" data={points} hitRadius={14} />
<GeoHover layerIds={['sites-hit']} sections={describe} />
```

Setting `fill={false}` omits the fill sub-layer entirely; `stroke={false}` omits
both stroke sub-layers.

## Data-driven symbology

Every style prop accepts a literal **or** a MapLibre expression, typed as
`StyleValue<T> = T | unknown[]`. Expressions are evaluated by MapLibre on the
GPU per feature, which is why the component exposes no per-feature style
callback:

```tsx
<VectorLayer
  data={cells}
  fill={['coalesce', ['get', 'color'], '#64748b']}
  fillOpacity={[
    'interpolate', ['linear'], ['get', 'intensity'],
    0, 0.1,
    1, 0.8,
  ]}
  stroke={['coalesce', ['get', 'color'], '#94a3b8']}
  pointRadius={['interpolate', ['linear'], ['zoom'], 4, 3, 12, 9]}
/>
```

The layer-level `opacity` prop composes with these automatically: literal
opacities are multiplied directly, and expression values are wrapped in
`['*', expr, factor]`.

## Configuration

| Prop | Type | Default | Behaviour |
| --- | --- | --- | --- |
| `data` | `GeoJson \| GeoJsonFeature[] \| null` | — | Any GeoJSON shape |
| `id` | `string` | `'gcl-vector'` | Sub-layer identifiers derive from this |
| `visible` | `boolean` | `true` | Hides without unmounting |
| `opacity` | `number` | `1` | Multiplies every sub-layer's opacity |
| `beforeId` | `string` | — | Registers below an existing style layer |
| `minZoom` / `maxZoom` | `number` | — | Zoom range for the whole layer |
| `fill` | `StyleValue<string> \| false` | `'#38bdf8'` | `false` omits the fill sub-layer |
| `fillOpacity` | `StyleValue<number>` | `0.4` | |
| `stroke` | `StyleValue<string> \| false` | `'#38bdf8'` | `false` omits both stroke sub-layers |
| `strokeWidth` | `StyleValue<number>` | `1.5` | Pixels |
| `strokeOpacity` | `StyleValue<number>` | `1` | |
| `strokeDasharray` | `number[]` | — | Dash pattern in line widths, e.g. `[3, 2]` |
| `pointRadius` | `StyleValue<number>` | `5` | Pixels |
| `pointColor` | `StyleValue<string>` | falls back to `stroke` | |
| `pointStrokeColor` | `StyleValue<string>` | — | |
| `pointStrokeWidth` | `StyleValue<number>` | `1` | |
| `filter` | `FilterSpecification` | — | Combined with the internal geometry-type filters |
| `interactive` | `boolean` | `true` when a handler is supplied | Enables hover and click handling |
| `hitRadius` | `number` | `0` | Invisible widened hit target around points |
| `cluster` | `boolean` | `false` | Point data only |
| `clusterRadius` | `number` | `50` | Pixels |
| `clusterMaxZoom` | `number` | — | Zoom past which clustering stops |
| `tolerance` | `number` | `0.375` | Douglas–Peucker simplification tolerance |

## Filtering versus re-slicing

Supplying a `filter` expression is substantially cheaper than handing the source
a new FeatureCollection: the geometry remains uploaded to the GPU and only the
draw decision changes.

```tsx
const [threshold, setThreshold] = useState(50);

<VectorLayer
  data={allSites}                                // stable reference
  filter={['>=', ['get', 'value'], threshold]}   // changes freely
/>
```

## Interaction model

```tsx
<VectorLayer
  data={points}
  hitRadius={14}
  onHover={(info) => setHovered(info)}
  onLeave={() => setHovered(null)}
  onClick={(info) => select(info.feature.id)}
/>
```

Handlers receive:

```ts
interface VectorInteractionInfo {
  feature: GeoJsonFeature;      // topmost feature under the pointer
  features: GeoJsonFeature[];   // all of them, topmost first
  lngLat: LngLat;               // geographic position
  point: { x: number; y: number };   // page coordinates, ready for a tooltip
  layerId: string;              // which sub-layer was hit
  originalEvent: MapLayerMouseEvent;
}
```

Interaction state is entirely external: the component holds no selection or
hover state and exposes none. The host decides what a hover or a click means.

### Hit targets

Small symbols are difficult to acquire with a pointer. `hitRadius` registers an
additional invisible circle sub-layer around each point, widening the target
without altering what is drawn.

> **Note:** The hit sub-layer uses `circle-opacity: 0.00001` rather than `0`.
> MapLibre excludes fully transparent geometry from hit testing, so the target
> must be nominally visible while remaining imperceptible.

## Clustering

```tsx
<VectorLayer data={manyPoints} cluster clusterRadius={50} clusterMaxZoom={12} />
```

Clustering is a property of the MapLibre GeoJSON source and applies to point
geometry only. Cluster features carry a `point_count` property, which can drive
symbology through an expression:

```tsx
pointRadius={['step', ['get', 'point_count'], 6, 10, 10, 50, 16]}
```

## Performance considerations

- `tolerance` controls source-level simplification. Raising it reduces vertex
  count and rendering cost at the expense of geometric fidelity.
- Prefer `filter` to re-slicing the source; the latter re-uploads geometry.
- Memoise the `data` prop. A new object identity on each render triggers a
  `setData` call even when the content is unchanged.
- Clustering moves aggregation into the source and is substantially cheaper than
  rendering tens of thousands of individual circles.
- `hitRadius` adds a sub-layer and therefore a draw call; enable it only where
  pointer acquisition is genuinely difficult.

## Geospatial considerations

- Coordinates must be EPSG:4326 `[longitude, latitude]`. No reprojection is
  performed.
- Geometry is rendered in the map's projection; at low zoom in Web Mercator,
  long segments follow the projected straight line rather than a great circle.
  Densify upstream when geodesic fidelity matters.
- Clustering applies only to point geometry, per the GeoJSON source
  specification.
- The component renders no labels. Text placement has sufficient configuration
  surface to warrant a dedicated MapLibre `symbol` layer, added separately.
