# @hridayanp/vector-layer

A generic GeoJSON layer covering every geometry type.

## Installation

```bash
npm install @hridayanp/vector-layer @hridayanp/map-container maplibre-gl react
```


## Usage

```tsx
<VectorLayer
  data={featureCollection}
  fill="#38bdf8"
  fillOpacity={0.3}
  stroke="#38bdf8"
  strokeWidth={1.5}
/>
```

`data` accepts a FeatureCollection, a single Feature, a bare geometry or an
array of features. Point, MultiPoint, LineString, MultiLineString, Polygon and
MultiPolygon all render.

## Styling with expressions

Every style prop takes a literal **or** a MapLibre expression. That is the whole
mechanism behind per-feature styling — there is no `getFillColor` callback,
because `['get', 'color']` does the same job on the GPU:

```tsx
<VectorLayer
  data={cells}
  fill={['coalesce', ['get', 'color'], '#64748b']}
  fillOpacity={['interpolate', ['linear'], ['get', 'intensity'], 0, 0.1, 1, 0.8]}
/>
```

Internally the layer creates separate MapLibre sub-layers per geometry type —
the only way to style them independently — but they share one source and one set
of props. Sub-layer ids are `${id}-fill`, `-outline`, `-line`, `-point` and
`-hit`, which is what you pass to `@hridayanp/geo-hover`.

## Props

| Prop | Default | Notes |
| --- | --- | --- |
| `fill` | `'#38bdf8'` | `false` skips the fill sub-layer entirely |
| `fillOpacity` | `0.4` | |
| `stroke` | `'#38bdf8'` | `false` skips both stroke sub-layers |
| `strokeWidth` / `strokeOpacity` / `strokeDasharray` | | |
| `pointRadius` / `pointColor` / `pointStrokeColor` / `pointStrokeWidth` | | |
| `filter` | — | Combined with the internal geometry-type filters |
| `hitRadius` | `0` | Invisible, wider hit target around points |
| `cluster` / `clusterRadius` / `clusterMaxZoom` | `false` | Point data only |
| `tolerance` | MapLibre default | Simplification; higher is faster, less faithful |
| `onHover` / `onLeave` / `onClick` | — | Receive feature, all features, coordinate and page position |

## Filtering vs re-slicing

Changing `filter` is much cheaper than handing the source a new
FeatureCollection: the data stays uploaded and only the draw decision changes.

## Interaction

`hitRadius` adds a near-invisible circle layer around points. Small symbols are
hard to hover precisely; this widens the target without changing what is drawn.
(The hit layer uses `opacity: 0.00001` rather than `0` — MapLibre skips
hit-testing fully transparent geometry.)

## Limitations

- No labels. Add a MapLibre `symbol` layer separately if you need them.
- Clustering applies to point data only, per the GeoJSON source spec.

## Documentation

Interactive examples for every prop live in the workspace Storybook:

```bash
npm run storybook
```

## License

MIT
