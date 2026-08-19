## Purpose

`GeoLegend` renders the symbology key for a map layer: a continuous colour ramp
with a labelled value domain, or a classified swatch list for categorical data.

Cartographic convention treats the legend as part of the map's meaning, not its
decoration — a colour ramp without a domain and a unit is uninterpretable. The
component therefore takes ramp, domain, unit and title as first-class props.

```bash
npm install @hridayanp/geo-legend react
```

```ts
import '@hridayanp/ui/styles.css';
```

## Responsibilities

| Concern | Owner |
| --- | --- |
| Ramp resolution and gradient construction | `GeoLegend` |
| Tick placement and value formatting | `GeoLegend` |
| Placement, collapsing, stacking | `GeoLegend`, `GeoLegendStack` |
| Keeping the ramp consistent with the layer's `colorScale` | Host application |
| Domain selection and unit semantics | Host application |

The component is domain-agnostic by construction: ramp, domain, unit and title
are all props, so the same component keys precipitation accumulation,
probability of exceedance and land cover without knowing what any of them are.

```tsx
<GeoLegend
  title="Accumulated precipitation"
  colorScale={['#f7fbff', '#6baed6', '#08306b']}
  min={0}
  max={120}
  unit="mm"
  ticks={5}
  placement="bottom-right"
/>
```

## Data model

### Colour scales

`LegendColorScale` is an array of `LegendColorStop`, where a stop is either a
bare colour or an explicit `[position, colour]` pair.

Bare colours are distributed evenly across the domain:

```tsx
colorScale={['#f7fbff', '#6baed6', '#08306b']}
```

Explicit stops when the breakpoints carry meaning — a precipitation scale with
class boundaries at 1, 5, 20 and 60 mm:

```tsx
colorScale={[
  [0, '#dbeafe'],
  [1, '#93c5fd'],
  [5, '#3b82f6'],
  [20, '#1d4ed8'],
  [60, '#1e3a8a'],
]}
```

This is the same stop syntax `raster-layer` and `raster-utils` accept, so one
palette constant can drive both the rendering and its key.

### Classes

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
counts, icons or links. With numeric `from` and `to` and no explicit label, the
bounds are formatted automatically:

```tsx
classes={[
  { color: '#dbeafe', from: 0, to: 1,  label: '' },
  { color: '#93c5fd', from: 1, to: 5,  label: '' },
  { color: '#3b82f6', from: 5, to: 20, label: '' },
]}
```

## Rendering model

`mode` selects between two cartographic representations:

```tsx
<GeoLegend mode="continuous" … />   // a gradient bar
<GeoLegend mode="discrete" … />     // flat bands
```

The distinction is semantic, not decorative. Flat bands communicate
**classification**; a gradient communicates a **continuum**. The choice should
match how the underlying data was produced — a classified raster keyed with a
gradient misrepresents the data.

The same distinction exists on the rendering side as `ColorScale.mode` in
[`raster-utils`](/docs/raster-utils#colour-ramps); the two should agree.

## Configuration

| Prop | Type | Default | Behaviour |
| --- | --- | --- | --- |
| `title` | `ReactNode` | — | Panel heading |
| `subtitle` | `ReactNode` | — | Secondary line beneath the title |
| `colorScale` | `LegendColorScale` | — | Colours, or `[value, colour]` stops |
| `min` / `max` | `number` | — | Value domain |
| `unit` | `string` | — | Displayed beside the scale |
| `mode` | `'continuous' \| 'discrete'` | `'continuous'` | See above |
| `classes` | `LegendClass[]` | — | Replaces the ramp |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Vertical renders a narrow gutter |
| `ticks` | `number \| number[]` | `2` | A count, or the exact values to label |
| `formatValue` | `(value: number) => string` | precision derived from the domain | Value formatting |
| `footer` | `ReactNode` | — | Content below the ramp — a timestamp, a source note, a control |
| `actions` | `ReactNode` | — | Content in the header, right of the title |
| `collapsible` | `boolean` | `false` | Adds a collapse toggle |
| `defaultCollapsed` | `boolean` | `false` | Initial state when collapsible |
| `placement` | `PanelPlacement` | — | Docks to a map corner; omit to position externally |
| `className` / `style` | | — | Applied to the panel |
| `children` | `ReactNode` | — | Replaces the ramp while retaining the panel chrome |

### Tick precision

The default `formatValue` derives precision from the **domain**, not from the
individual value: a 0–1 probability scale receives two decimal places where a
0–1000 pressure scale receives none. A legend mixing the two conventions reads
as inconsistent, so overriding this is worthwhile only when a specific format is
required.

## Composing multiple legends

A composed map requires one key per layer. Docking each legend independently
places them at the same coordinates:

```tsx
import { GeoLegend, GeoLegendStack } from '@hridayanp/geo-legend';

<GeoLegendStack placement="bottom-right" direction="vertical">
  <GeoLegend title="Precipitation" colorScale={blues}  min={0} max={120} unit="mm" />
  <GeoLegend title="Wind speed"    colorScale={speeds} min={0} max={40}  unit="kt" />
  <GeoLegend
    title="Advisories"
    classes={[
      { color: '#f59e0b', label: 'Watch' },
      { color: '#ef4444', label: 'Warning' },
    ]}
  />
</GeoLegendStack>
```

`GeoLegendStack` accepts `placement` (default `'bottom-right'`) and `direction`
(default `'vertical'`). The stack container is transparent to pointer events, so
map panning remains available in the space between legends.

## Integration boundaries

`GeoLegend` renders anywhere — a sidebar, a print layout, a PDF report. Only
`placement` presumes a positioned ancestor, and it is optional.

The package deliberately does **not** depend on `raster-utils`. A legend
requires a CSS gradient and an ordered swatch list, not a colour-science library
and a GeoTIFF decoder; it carries a ninety-line ramp resolver instead. See
[Dependency Graph](/docs/dependency-graph#localised-colour-ramp-logic-in-geo-legend).

## Exported helpers

```ts
import {
  scaleToGradient,       // (scale, direction, discrete) → CSS linear-gradient
  normalizeStops,        // LegendColorScale → Array<[position, colour]>
  buildTicks,            // (min, max, count) → number[]
  defaultFormat,         // (value, range) → string
  colorScaleStopCount,   // resolved stop count for a scale
} from '@hridayanp/geo-legend';
```

Useful when constructing a custom key — a gradient in a PDF export, or a
horizontal ramp in a report header — while retaining the same ramp semantics as
the map.
