A legend for arbitrary geospatial data — continuous ramps, classed swatches, any
unit, any title.

```bash
npm install @hridayanp/geo-legend react
```

Remember the stylesheet: `import '@hridayanp/ui/styles.css'`.

## Nothing domain-specific

A legend is a colour ramp, a value range, a unit and a title. All four are
props, so the same component labels rainfall, probability and land cover without
knowing what any of them are.

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

## Colour scales

Bare colours are spread evenly across the range:

```tsx
colorScale={['#f7fbff', '#6baed6', '#08306b']}
```

Explicit stops when the breakpoints carry meaning — a rainfall scale with class
boundaries at 1, 5, 20 and 60 mm:

```tsx
colorScale={[
  [0, '#dbeafe'],
  [1, '#93c5fd'],
  [5, '#3b82f6'],
  [20, '#1d4ed8'],
  [60, '#1e3a8a'],
]}
```

## Continuous vs discrete

```tsx
<GeoLegend mode="continuous" … />   {/* a gradient */}
<GeoLegend mode="discrete" … />     {/* flat bands */}
```

This is not cosmetic. Flat bands read as **classes**; a gradient reads as a
**continuum**. The distinction changes how a reader interprets the map, so it
should match how the data was actually produced.

## Classed legends

```tsx
<GeoLegend
  title="Land cover"
  classes={[
    { color: '#166534', label: 'Forest' },
    { color: '#65a30d', label: 'Grassland' },
    { color: '#a16207', label: 'Cropland' },
    { color: '#0284c7', label: 'Water' },
  ]}
/>
```

`classes` replaces the ramp entirely. Labels are React nodes, so they can carry
counts, icons or links.

With numeric `from`/`to` and no label, bounds are formatted for you:

```tsx
classes={[
  { color: '#dbeafe', from: 0,  to: 1,   label: '' },
  { color: '#93c5fd', from: 1,  to: 5,   label: '' },
  { color: '#3b82f6', from: 5,  to: 20,  label: '' },
]}
```

## Props

| Prop | Default | Notes |
| --- | --- | --- |
| `title` | — | Any node |
| `subtitle` | — | Secondary line under the title |
| `colorScale` | `['#0b2545','#f4d35e']` | Colours or `[value, colour]` stops |
| `min` / `max` | `0` / `1` | |
| `unit` | — | `'mm'`, `'kt'`, `'°C'` — anything |
| `mode` | `'continuous'` | Or `'discrete'` |
| `classes` | — | Replaces the ramp |
| `orientation` | `'horizontal'` | Or `'vertical'` for a narrow gutter |
| `ticks` | `2` | A count, or the exact values to label |
| `formatValue` | precision from range | `(value: number) => string` |
| `footer` | — | Timestamps, source notes, an inline control |
| `actions` | — | Content in the header, right of the title |
| `collapsible` | `false` | Adds a chevron toggle |
| `defaultCollapsed` | `false` | |
| `placement` | — | Docks to a map corner; omit to lay out yourself |
| `children` | — | Replaces the ramp, keeping the panel chrome |

## Automatic tick precision

`formatValue` defaults to precision chosen from the **range**, not the value: a
0–1 probability scale gets two decimals where a 0–1000 pressure scale gets none.
A legend that mixes the two reads as broken, so this is worth leaving alone
unless you have a specific format in mind.

## Stacking

A composed map needs a key per layer. Docking each legend independently makes
them collide:

```tsx
import { GeoLegend, GeoLegendStack } from '@hridayanp/geo-legend';

<GeoLegendStack placement="bottom-right">
  <GeoLegend title="Rainfall" colorScale={blues} min={0} max={120} unit="mm" />
  <GeoLegend title="Wind" colorScale={speeds} min={0} max={40} unit="kt" />
  <GeoLegend
    title="Alerts"
    classes={[
      { color: '#f59e0b', label: 'Watch' },
      { color: '#ef4444', label: 'Warning' },
    ]}
  />
</GeoLegendStack>
```

The stack is transparent to pointer events, so the map stays draggable through
the gaps between legends.

## Works without a map

`GeoLegend` renders anywhere — a sidebar, a print layout, a PDF report. Only
`placement` assumes a positioned ancestor.

That is also why this package **does not** depend on `raster-utils`: a legend
needs a CSS gradient and a list of swatches, not a colour-science library and a
GeoTIFF decoder. It carries its own ninety-line ramp resolver instead.

## Exported helpers

```ts
import {
  scaleToGradient,   // → 'linear-gradient(to right, …)'
  normalizeStops,    // → [[0, '#…'], [1, '#…']]
  buildTicks,        // evenly spaced values across a domain
  defaultFormat,     // the range-aware number formatter
} from '@hridayanp/geo-legend';
```
