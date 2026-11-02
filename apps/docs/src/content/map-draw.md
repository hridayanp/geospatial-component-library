## Purpose

`map-draw` adds drawing, editing and measuring to a map — point, line, polygon,
rectangle, circle and freehand — on top of
[terra-draw](https://github.com/JamesLMilner/terra-draw).

```bash
npm install @hridayanp/map-draw @hridayanp/map-container maplibre-gl react
```

```ts
import '@hridayanp/ui/styles.css';
```

```tsx
<MapContainer center={[80, 20]} zoom={5}>
  <DrawControl
    modes={['polygon', 'rectangle', 'circle', 'select']}
    singleFeature
    onChange={(features) => setArea(features[0] ?? null)}
  />
</MapContainer>
```

terra-draw and its MapLibre adapter are ordinary dependencies of this package,
installed with it. They are the reason it is its own package: no other package
pays for a drawing engine.

## Output

Finished shapes leave through `onChange` as plain GeoJSON features, in drawing
order, whenever the set changes — a new shape, an edit, a deletion. Changes are
coalesced to one call per animation frame while a vertex is dragged.
`onFinish(feature, measurement)` fires once per completed shape.

The engine's guide features — closing points, selection handles, midpoints, the
shape currently being drawn — are filtered out. Each feature keeps terra-draw's
`mode` property (`'polygon'`, `'circle'`…), and circles keep `radiusKilometers`.

## Seeding and editing

`defaultFeatures` is read once when drawing starts — a saved area of interest to
edit. Plain GeoJSON is accepted: the tool is inferred from the geometry when the
feature has no `mode`. Afterwards the drawing owns its shapes.

`singleFeature` keeps only the most recently finished shape, so a second area
replaces the first — the behaviour a warning-area or extract-region form wants.

## Basemap switches

MapLibre discards every layer with the old style, including the engine's. The
hook snapshots finished shapes before the swap and restores them onto the new
style, so changing basemap never loses work.

## Measurement

| Function | Returns |
| --- | --- |
| `measureFeature(feature)` | `{ areaKm2?, perimeterKm?, lengthKm?, radiusKm?, center? }` |
| `measureGeometry(geometry)` | the same, without the circle radius |
| `ringAreaKm2(ring)` | area of one ring |
| `pathLengthKm(path)` | great-circle length |
| `formatArea(km2)` / `formatDistance(km)` | `"1,234 km²"`, `"42.0 ha"`, `"850 m"` |

Areas use the spherical-excess line integral (the method of `@turf/area`), so a
1° × 1° square at the equator measures 12,364 km²; lengths follow great circles.
A shape drawn over a subcontinent is reported in real km², not squared degrees.

## `DrawControl`

| Prop | Type | Default |
| --- | --- | --- |
| `modes` | `DrawMode[]` | all seven |
| `defaultFeatures` | `GeoJsonFeature[]` | — |
| `singleFeature` | `boolean` | `false` |
| `color` | `#rrggbb` | `'#38bdf8'` |
| `onChange` / `onFinish` | | — |
| `placement` | `PanelPlacement` | `'top-left'` |
| `orientation` | `'vertical' \| 'horizontal'` | `'vertical'` |
| `showMeasurements` | `boolean` | `true` |
| `showDeleteControls` | `boolean` | `true` |
| `id` | `string` | `'gcl-draw'` — prefixes the engine's layers |

Clicking the active tool again returns the map to panning. terra-draw's keys
apply: `Esc` cancels a shape in progress, `Enter` finishes a line or polygon,
`Delete` removes the selected vertex.

## `useMapDraw`

The hook behind the toolbar, for building your own:

```tsx
const draw = useMapDraw({ modes: ['linestring', 'polygon'] });
// draw.mode, draw.setMode(mode | null), draw.features, draw.selectedId,
// draw.remove(id), draw.removeSelected(), draw.clear(), draw.ready
```
