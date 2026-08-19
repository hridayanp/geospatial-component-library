Pointer inspection for maps: pick vector features, probe raster values, and
render a readout card that never gets clipped.

```bash
npm install @hridayanp/geo-hover @hridayanp/map-container maplibre-gl react react-dom
```

Remember the stylesheet: `import '@hridayanp/ui/styles.css'`.

## Two capabilities, independently useful

| Capability | Enabled by | What it does |
| --- | --- | --- |
| Feature picking | `layerIds` | `queryRenderedFeatures` scoped to those layer ids |
| Raster probing | `raster` | Samples the numeric array at the cursor |

Use one, the other, or both. With both, a single hover yields the features under
the pointer *and* the underlying grid value — which is usually what a real
readout needs.

```tsx
<GeoHover
  layerIds={['sites-hit']}
  raster={raster}
  sampling="bilinear"
  sections={(state) => [
    {
      title: 'Reading',
      accentColor: '#38bdf8',
      rows: [{ label: 'Value', value: state.value, unit: 'mm' }],
    },
  ]}
/>
```

## Probing reads memory, not the network

The raster your application already handed to
[`raster-layer`](/docs/raster-layer) is the same array `GeoHover` samples. There
is no second request, no re-decode and no server round trip — a hover costs an
index calculation and an array read.

That is only possible because the host owns the data. A package that fetched its
own rasters would have to fetch again here.

## `sections` is where domain knowledge lives

Everything else in this library is domain-agnostic by construction. A readout
card cannot be: someone has to decide that `wind_speed_kt` is called "Wind" and
measured in knots.

`sections` is that one seam. It receives the raw hover state and returns card
content, and it lives in **your** application:

```tsx
sections={(state) => {
  const site = state.features[0]?.properties;
  if (!site) return [];
  return [
    {
      title: String(site.name),
      accentColor: site.status === 'alert' ? '#ef4444' : '#38bdf8',
      rows: [
        { label: 'Elevation', value: site.elevation, unit: 'm' },
        { label: 'Rainfall', value: state.value, unit: 'mm' },
      ],
    },
  ];
}}
```

Returning `[]` renders nothing — the natural way to suppress the card for
features you do not care about.

## Hover state

```ts
interface MapHoverState {
  x: number;                    // page coordinates, ready for a fixed element
  y: number;
  lngLat: [number, number];
  features: GeoJsonFeature[];   // topmost first; empty when only probing
  value: number | null;         // null off the raster, or on NoData
}
```

`null` for the whole state means nothing is under the pointer. That is exactly
the shape a conditional tooltip wants:

```tsx
const hover = useMapHover({ layerIds: ['sites-point'], raster });
return hover ? <GeoHoverCard x={hover.x} y={hover.y} … /> : null;
```

## Props

| Prop | Default | Notes |
| --- | --- | --- |
| `layerIds` | — | **Always scope this.** See performance below |
| `raster` | — | Any `RasterData`; enables probing |
| `sampling` | `'nearest'` | Or `'bilinear'` |
| `sections` | — | `(state) => HoverSection[]` |
| `enabled` | `true` | Flip to `false` to suspend without unmounting |
| `offset` | `[14, 14]` | Card offset from the cursor, in pixels |
| `placement` | `'auto'` | Auto flips near viewport edges |
| `emptyMessage` | — | Shown when `sections` returns nothing but a value exists |
| `onHoverChange` | — | `(state \| null) => void`, for driving other UI |

## Why the card is portalled

`GeoHoverCard` renders straight into `document.body` with `position: fixed`.

A tooltip rendered inside the map container is clipped by the first ancestor
with `overflow: hidden` — and map containers almost always have one. It is the
single most common failure mode in map UIs, and portalling is the only reliable
fix.

The card also flips and clamps against the viewport edges, so inspecting a
feature at the right-hand edge of the screen does not push the card off-screen.

`GeoHoverCard` is exported on its own and works with coordinates you supply, if
you would rather compute hover state yourself.

## Sampling modes

```tsx
sampling="nearest"    // default
sampling="bilinear"
```

`'nearest'` returns a value that genuinely **exists in the source**. That is the
right choice for classed data (a land-cover code between two classes is
meaningless) and for readouts where a user expects to see a real measurement.

`'bilinear'` interpolates between the four surrounding cells, which matches what
the smoothed rendering actually shows. Pick it when "the number should agree with
the colour under my cursor" matters more than "the number should be a real
observation".

## Performance

`queryRenderedFeatures` runs on **every pointer move**. Unscoped, it walks every
rendered layer on the map, which on a basemap with labels and roads is
noticeably expensive — this is the difference between a smooth hover and a
janky one.

```tsx
<GeoHover layerIds={['sites-hit']} />          {/* good */}
<GeoHover />                                    {/* probing only — also fine */}
```

Raster probing is a plain array read and costs effectively nothing.

Pair with `hitRadius` on [`vector-layer`](/docs/vector-layer) so small symbols
are pickable without being drawn larger:

```tsx
<VectorLayer id="sites" data={points} hitRadius={14} />
<GeoHover layerIds={['sites-hit']} />
```

## Limitations

- Hover only. Click handling belongs on the layer that owns the feature —
  `VectorLayer` has `onClick`.
- One raster at a time. Probing several grids means several `useMapHover` calls,
  or sampling with [`raster-utils`](/docs/raster-utils) directly.
- Touch devices have no hover. Drive the card from a tap on mobile.
