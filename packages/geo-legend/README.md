# @hridayanp/geo-legend

Map legends for arbitrary geospatial data — continuous ramps, classed swatches,
any unit, any title.

## Installation

```bash
npm install @hridayanp/geo-legend react
```



This package renders UI, so import the stylesheet once anywhere in your app:

```ts
import '@hridayanp/ui/styles.css';
```

Every colour, radius and font is a CSS custom property — override the variables
to retheme, and set `data-gcl-theme="light"` or `"dark"` on any ancestor to
switch modes.


## Usage

```tsx
<GeoLegend
  title="Accumulated rainfall"
  colorScale={['#f7fbff', '#6baed6', '#08306b']}
  min={0}
  max={120}
  unit="mm"
  ticks={5}
  placement="bottom-right"
/>
```

## Nothing domain-specific

A legend is a ramp, a range, a unit and a title. All four are props, so the same
component labels rainfall, probability and land cover without knowing what any
of them are.

## Classed legends

```tsx
<GeoLegend
  title="Land cover"
  classes={[
    { color: '#166534', label: 'Forest' },
    { color: '#a16207', label: 'Cropland' },
    { color: '#0284c7', label: 'Water' },
  ]}
/>
```

With numeric `from`/`to` and no label, bounds are formatted for you at a
precision chosen from the range — a 0–1 probability scale needs two decimals
where a 0–1000 pressure scale needs none.

`mode="discrete"` on a ramp draws flat bands instead of a gradient. The
distinction is not cosmetic: flat bands read as classes, a gradient reads as a
continuum, and that changes how someone interprets the map.

## Props

| Prop | Default | Notes |
| --- | --- | --- |
| `title` / `subtitle` / `footer` / `actions` | — | Any node |
| `colorScale` | | Colours or `[value, colour]` stops |
| `min` / `max` / `unit` | `0` / `1` | |
| `mode` | `'continuous'` | |
| `classes` | — | Replaces the ramp entirely |
| `orientation` | `'horizontal'` | |
| `ticks` | `2` | A count, or exact values |
| `formatValue` | precision from range | |
| `collapsible` | `false` | |
| `placement` | — | Docks to a map corner; omit to lay out yourself |

## Stacking

```tsx
<GeoLegendStack placement="bottom-right">
  <GeoLegend title="Rainfall" ... />
  <GeoLegend title="Wind" ... />
</GeoLegendStack>
```

A composed map needs a key per layer. Docking each legend independently makes
them collide; stacking keeps one tidy column.

## Works without a map

`GeoLegend` renders anywhere — a sidebar, a print layout, a report. Only
`placement` assumes a positioned ancestor.

## Documentation

Interactive examples for every prop live in the workspace Storybook:

```bash
npm run storybook
```

## License

MIT
