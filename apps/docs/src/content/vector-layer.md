One generic GeoJSON layer covering every geometry type, styled entirely through
props and MapLibre expressions.

```bash
npm install @hridayanp/vector-layer @hridayanp/map-container maplibre-gl react
```

## Basic usage

```tsx
<VectorLayer
  data={featureCollection}
  fill="#38bdf8"
  fillOpacity={0.3}
  stroke="#38bdf8"
  strokeWidth={1.5}
/>
```

`data` accepts a FeatureCollection, a single Feature, a bare geometry, or an
array of features — whichever shape your data already arrives in. Point,
MultiPoint, LineString, MultiLineString, Polygon and MultiPolygon all render;
a GeometryCollection is traversed for bounds.

## The generated sub-layers

One source, up to five MapLibre layers:

| Layer id | Type | Filter |
| --- | --- | --- |
| `{id}-fill` | `fill` | Polygon, MultiPolygon |
| `{id}-outline` | `line` | Polygon, MultiPolygon |
| `{id}-line` | `line` | LineString, MultiLineString |
| `{id}-point` | `circle` | Point, MultiPoint |
| `{id}-hit` | `circle` | Point, MultiPoint — only when `hitRadius > 0` |

Separate sub-layers are the **only** way MapLibre lets you style geometry types
independently. But the caller sees one component with one set of props.

Those ids are what you pass to [`geo-hover`](/docs/geo-hover):

```tsx
<VectorLayer id="sites" data={points} hitRadius={14} />
<GeoHover layerIds={['sites-hit']} … />
```

## Styling with expressions

Every style prop takes a literal **or** a MapLibre expression. That is the whole
per-feature styling mechanism — there is no `getFillColor` callback, because
`['get', 'color']` does the same work on the GPU:

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
/>
```

A global `opacity` folds into these automatically: literals are multiplied
directly, expressions are wrapped in `['*', expr, factor]`.

## Props

| Prop | Default | Notes |
| --- | --- | --- |
| `data` | — | Any GeoJSON shape, or `null` |
| `id` | `'gcl-vector'` | Sub-layer ids derive from this |
| `visible` | `true` | |
| `opacity` | `1` | Multiplies every sub-layer |
| `fill` | `'#38bdf8'` | `false` skips the fill sub-layer entirely |
| `fillOpacity` | `0.4` | |
| `stroke` | `'#38bdf8'` | `false` skips both stroke sub-layers |
| `strokeWidth` | `1.5` | |
| `strokeOpacity` | `1` | |
| `strokeDasharray` | — | e.g. `[3, 2]`, in line widths |
| `pointRadius` | `5` | |
| `pointColor` | falls back to `stroke` | |
| `pointStrokeColor` | `'#ffffff'` | |
| `pointStrokeWidth` | `1` | |
| `filter` | — | Combined with the internal geometry-type filters |
| `hitRadius` | `0` | Invisible, wider hit target around points |
| `cluster` | `false` | Point data only |
| `clusterRadius` | `50` | Pixels |
| `clusterMaxZoom` | — | Zoom past which points stop clustering |
| `tolerance` | MapLibre default | Simplification; higher is faster, less faithful |
| `minZoom` / `maxZoom` | — | Restricts the whole layer |
| `beforeId` | — | Draw below an existing layer |
| `onHover` / `onLeave` / `onClick` | — | See below |

## Filtering vs re-slicing

Changing `filter` is far cheaper than handing the source a new
FeatureCollection: the data stays uploaded to the GPU and only the draw decision
changes.

```tsx
const [threshold, setThreshold] = useState(50);

<VectorLayer
  data={allSites}                                // never changes
  filter={['>=', ['get', 'value'], threshold]}   // changes freely
/>
```

## Interaction

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
  feature: GeoJsonFeature;      // topmost under the pointer
  features: GeoJsonFeature[];   // all of them, topmost first
  lngLat: [number, number];
  point: { x: number; y: number };   // page coordinates, ready for a tooltip
  layerId: string;
  originalEvent: MapLayerMouseEvent;
}
```

### `hitRadius`

Small symbols are hard to hover precisely. `hitRadius` adds an invisible wider
circle around each point without changing what is drawn.

> **Note:** The hit layer uses `circle-opacity: 0.00001`, not `0`. MapLibre
> skips hit-testing fully transparent geometry, so the target has to be
> technically visible but visually absent.

## Clustering

```tsx
<VectorLayer data={manyPoints} cluster clusterRadius={50} />
```

Applies to point data only, per the GeoJSON source spec. Cluster features carry
`point_count`, so you can style them with an expression:

```tsx
pointRadius={['step', ['get', 'point_count'], 6, 10, 10, 50, 16]}
```

## Limitations

- **No labels.** Add a MapLibre `symbol` layer separately if you need them; text
  layout has enough options that wrapping it would be its own package.
- Clustering is point-only.
- No built-in simplification beyond the source's `tolerance`.
