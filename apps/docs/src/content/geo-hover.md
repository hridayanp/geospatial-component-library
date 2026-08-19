## Purpose

`GeoHover` provides pointer-driven inspection of map content: vector feature
picking, raster value probing, and a portalled readout card positioned against
the pointer.

It answers the question a user asks of every thematic map — *what is the value
here?* — for both feature attributes and continuous raster bands, through one
component.

```bash
npm install @hridayanp/geo-hover @hridayanp/map-container maplibre-gl react react-dom
```

```ts
import '@hridayanp/ui/styles.css';
```

## Responsibilities

| Concern | Owner |
| --- | --- |
| Pointer tracking and hit testing | `GeoHover` |
| Raster sampling at the pointer position | `GeoHover`, via `raster-utils` |
| Card positioning, portalling and viewport clamping | `GeoHoverCard` |
| Deciding which attributes matter and what they mean | Host application, through `sections` |
| Selection state and click semantics | Host application |

## Two capabilities

| Capability | Enabled by | Mechanism |
| --- | --- | --- |
| Feature picking | `layerIds` | `queryRenderedFeatures` scoped to those style layers |
| Raster probing | `raster` | Samples the in-memory band at the pointer |

Either may be used alone. With both, a single hover yields the features under
the pointer **and** the underlying grid value, which is usually what an
operational readout requires.

```tsx
<GeoHover
  layerIds={['sites-hit']}
  raster={raster}
  sampling="bilinear"
  sections={(state) => [
    {
      title: 'Reading',
      accentColor: '#38bdf8',
      rows: [{ label: 'Accumulation', value: state.value, unit: 'mm' }],
    },
  ]}
/>
```

## Data model

Raster probing reads the same `RasterData` the application already supplied to
[`raster-layer`](/docs/raster-layer). No request is issued and no second decode
occurs; a hover costs an index calculation and an array read.

This is only possible because the host owns the data. A package that retrieved
its own rasters would have to retrieve again here.

Feature picking operates on geometry already rendered by MapLibre. It returns
features from the tile-clipped, rendered representation, which is why
`layerIds` must reference style layers that are currently drawn.

### Hover state

```ts
interface HoverState {
  x: number;                    // page coordinates, for a fixed-position element
  y: number;
  lngLat: LngLat;               // geographic position under the pointer
  features: GeoJsonFeature[];   // topmost first; empty for a raster-only probe
  value?: number | null;        // band value, when a raster was supplied
}
```

A `null` state means nothing is under the pointer — precisely the shape a
conditional readout requires:

```tsx
const hover = useMapHover({ layerIds: ['sites-point'], raster });
return hover ? <GeoHoverCard x={hover.x} y={hover.y} sections={build(hover)} /> : null;
```

## Where domain knowledge lives

Every other component in this library is domain-agnostic by construction. A
readout card cannot be: something must decide that `wind_speed_kt` is labelled
"Wind speed" and measured in knots.

`sections` is that boundary. It receives the raw hover state and returns card
content, and it is supplied by the **application**:

```tsx
sections={(state) => {
  const site = state.features[0]?.properties;
  if (!site) return [];
  return [
    {
      title: String(site.name),
      subtitle: String(site.district),
      accentColor: site.status === 'alert' ? '#ef4444' : '#38bdf8',
      rows: [
        { label: 'Elevation', value: site.elevation, unit: 'm' },
        { label: 'Accumulation', value: state.value, unit: 'mm' },
      ],
    },
  ];
}}
```

Returning an empty array suppresses the card for that hover — the natural way to
exclude features the application does not describe.

When `sections` is omitted, a default builder renders a single row from the
probed raster value, labelled with `title` (default `'Value'`) and suffixed with
`unit`.

## Configuration

| Prop | Type | Default | Behaviour |
| --- | --- | --- | --- |
| `layerIds` | `string[]` | — | Style layers to pick from. **Always scope this** |
| `raster` | `RasterData \| null` | — | Enables value probing |
| `sampling` | `'nearest' \| 'bilinear'` | `'nearest'` | See below |
| `enabled` | `boolean` | `true` | Suspends hovering without unmounting |
| `sections` | `(state: HoverState) => HoverSection[]` | default builder | Card content |
| `render` | `(sections, state) => ReactNode` | — | Replaces the card body |
| `onHoverChange` | `(state: HoverState \| null) => void` | — | For driving other interface state |
| `title` | `string` | `'Value'` | Used by the default `sections` builder |
| `unit` | `string` | — | Appended to the probed value by the default builder |
| `className` | `string` | — | Applied to the card |

### `useMapHover`

```tsx
import { useMapHover, useRasterProbe } from '@hridayanp/geo-hover';

const hover = useMapHover({
  layerIds: ['sites-point'],
  raster,
  sampling: 'bilinear',
  enabled: true,
  cursor: 'pointer',   // null leaves the cursor unchanged
});
```

`useRasterProbe` exposes value sampling alone, for readouts that do not need
feature picking.

### `GeoHoverCard`

The card is exported independently and accepts explicit coordinates:

| Prop | Type | Default |
| --- | --- | --- |
| `x` / `y` | `number` | — |
| `sections` | `HoverSection[]` | — |
| `offset` | `number` | `12` |
| `render` | `(sections) => ReactNode` | — |
| `container` | `HTMLElement \| null` | `document.body` |
| `className` | `string` | — |

## Card positioning

`GeoHoverCard` renders into `document.body` with `position: fixed`.

A readout rendered inside the map container is clipped by the first ancestor
declaring `overflow: hidden` — and map containers almost invariably have one. It
is the most common defect in map interfaces, and portalling is the only reliable
remedy. The card additionally flips and clamps against the viewport edges, so
inspecting a feature near the edge of the screen remains legible.

## Sampling modes

```tsx
sampling="nearest"    // default
sampling="bilinear"
```

`'nearest'` returns a value that **exists in the source grid**. This is correct
for classified data — a land-cover code interpolated between two classes is
meaningless — and for readouts where the user expects an actual measurement.

`'bilinear'` interpolates the four surrounding cells, matching what the smoothed
rendering displays. Select it when agreement between the reported number and the
colour under the pointer matters more than fidelity to a discrete observation.

Positions outside the raster extent, and cells holding NoData, return
`value: null` rather than raising — hovering off the data is normal user
behaviour.

## Performance considerations

`queryRenderedFeatures` executes on **every pointer-move event**. Unscoped, it
traverses every rendered style layer on the map, including the entire basemap.
This is the difference between a responsive readout and a visibly janky one.

```tsx
<GeoHover layerIds={['sites-hit']} />   // scoped
<GeoHover raster={raster} />            // probing only — no picking cost
```

Raster probing is an array read and is negligible by comparison.

Pair with `hitRadius` on [`vector-layer`](/docs/vector-layer) so that small
symbols are acquirable without being drawn larger:

```tsx
<VectorLayer id="sites" data={points} hitRadius={14} />
<GeoHover layerIds={['sites-hit']} />
```

## Integration boundaries

- Hover only. Click handling belongs to the layer that owns the feature —
  `VectorLayer` exposes `onClick`.
- One raster per instance. Probing several bands requires several `useMapHover`
  calls, or direct use of `sampleRaster` from
  [`raster-utils`](/docs/raster-utils).
- Pointer devices only. Touch input has no hover state; drive the card from a
  tap on mobile using `VectorLayer`'s `onClick` and `GeoHoverCard` directly.
