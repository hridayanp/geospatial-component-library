## Purpose

`heatmap-layer` draws a point-density heatmap, computed on the GPU by MapLibre.

```bash
npm install @hridayanp/heatmap-layer @hridayanp/map-container maplibre-gl react
```

```tsx
<HeatmapLayer
  data={strikes}
  weightProperty="peakCurrent"
  weightDomain={[0, 120]}
  pointsFromZoom={10}
/>
```

## When to use it — and when not

Use it for the **shape** of a distribution — where reports cluster, where
lightning struck — when the points are too many to read individually.

The kernel is in screen pixels, so the surface changes as the reader zooms: two
clusters merge when zoomed out and separate when zoomed in. That is right for
exploration and wrong for a quantity. For a density surface with a stated
bandwidth in kilometres, compute
[`kernelDensity`](/docs/hotspot-analysis) and draw it with
[`RasterLayer`](/docs/raster-layer).

## Weighting

Without `weightProperty` every point counts once. With it, `weightDomain`
(default `[0, 1]`, which suits probabilities) maps the property's range onto
weights 0–1; set it to the variable's real range.

## Radius and intensity

Both accept a number or `[zoom, value]` stops interpolated across zoom:

```tsx
<HeatmapLayer radius={[[3, 12], [9, 40]]} intensity={[[3, 1.5], [9, 1]]} />
```

Raising `intensity` at low zoom keeps the colour range in use when points crowd
together on screen.

## Colour

`colorScale` takes any ramp. The lowest stop is always rendered **transparent**
— otherwise the ramp's first colour would tint the entire map wherever density
is zero. The default ramp is Plasma.

## Hand-over to points

`pointsFromZoom` cross-fades the surface out and individual points in across one
zoom level. At street level the density surface stops meaning anything and the
reader wants the points themselves.

## Props

| Prop | Type | Default |
| --- | --- | --- |
| `data` | GeoJSON points | — |
| `weightProperty` | `string` | — |
| `weightDomain` | `[number, number]` | `[0, 1]` |
| `radius` | `ZoomValue` | `[[3, 12], [9, 40]]` |
| `intensity` | `ZoomValue` | `1` |
| `colorScale` | `ColorScaleInput` | Plasma |
| `opacity` | `number` | `0.8` |
| `pointsFromZoom` | `number` | — |
| `pointColor` / `pointRadius` | | top ramp colour / `4` |
| `id`, `visible`, `beforeId`, `minZoom`, `maxZoom` | | |
