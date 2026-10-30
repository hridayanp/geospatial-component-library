## Purpose

`geo-charts` presents the output of geospatial analysis: a time series with a
least-squares projection, class composition and change, and a class transition
matrix. Three forms, chosen because they answer the questions the rest of this
library produces answers to.

```bash
npm install @hridayanp/geo-charts react
```

```ts
import '@hridayanp/ui/styles.css';
```

Charts render as inline SVG with no charting dependency. The scope is
deliberately narrow — this is not a plotting library, and a chart it does not
cover belongs in one.

## Responsibilities

| Concern | Owner |
| --- | --- |
| Scales, ticks, axis geometry and layout | `geo-charts` |
| Least-squares fit, projection and prediction band | `linearTrend`, `projectSeries` |
| Legend, table view and keyboard reachability | `ChartFrame` |
| Chrome colour — axes, gridlines, text, surfaces | Library `--gcl-*` tokens |
| Data colour — what each class or series is | Host application |
| Deriving the values plotted | [`classified-raster`](/docs/classified-raster), [`hotspot-analysis`](/docs/hotspot-analysis) |

## Colour comes from the caller

Where a chart describes something also drawn on a map, it must adopt the map's
symbology. A composition chart whose "Trees" bar is not the green the map paints
trees forces the reader to learn the encoding twice, and the mismatch reads as
two different datasets rather than two views of one.

Every component therefore takes its data colours as props. Pass the same class
table the layer was given:

```tsx
<ClassAreaChart
  data={areas.classes.map((klass) => ({
    label: klass.label,
    color: klass.color,
    value: klass.areaKm2,
  }))}
/>
```

Chrome is different: axes, gridlines, text and surfaces are drawn from the
library's `--gcl-*` tokens, so charts follow `data-gcl-theme` and
`prefers-color-scheme` with everything else. See
[Theming](/docs/theming).

The sequential ramp used by the matrix ships as `--gcl-viz-seq-0` …
`--gcl-viz-seq-5`, each paired with a `-ink` token that clears contrast against
it. On a dark surface the ramp is re-anchored rather than inverted, because a
flipped light ramp does not preserve perceptual ordering.

## `TrendChart`

```tsx
import { TrendChart } from '@hridayanp/geo-charts';

<TrendChart
  title="Area by land-cover class"
  xLabel="Year"
  yLabel="Area (km²)"
  unit="km²"
  projectTo={2035}
  clampProjection={[0, Infinity]}
  series={classes.map((klass) => ({
    id: klass.label,
    color: klass.color,
    points: years.map((year) => ({ x: year, y: areaByYear[year][klass.value] })),
  }))}
/>
```

| Prop | Type | Default | Behaviour |
| --- | --- | --- | --- |
| `series` | `TrendSeries[]` | — | `{ id, points, color?, label? }`; points sorted by `x` |
| `projectTo` | `number` | — | Extrapolate every series to this `x`; omit for observations only |
| `intervalZ` | `number` | `1.96` | Band half-width in standard errors; `0` omits the band |
| `clampProjection` | `[number, number]` | — | Bound projected values, e.g. `[0, Infinity]` for an area |
| `includeZero` | `boolean` | `false` | Anchor the value axis at zero |
| `height` | `number` | `220` | Plot height excluding the axis band |
| `xLabel` / `yLabel` / `unit` | `string` | — | Axis captions and the unit on values |
| `formatValue` / `formatX` | `(value: number) => string` | derived | Value and `x` formatters |
| `title` / `subtitle` / `footnote` | `ReactNode` | — | Figure caption elements |

### Observed and projected are drawn differently

Observed values are solid with markers; projected values are dashed, inside a
shaded band, with no markers. A marker asserts a measurement, and a projection
rendered identically to an observation invites the reader to treat an
extrapolation as data.

The last observed point is repeated as the first projected point, so the two
paths join without a visible gap while remaining visually distinct.

### What the projection is

```ts
import { linearTrend, projectSeries } from '@hridayanp/geo-charts';

const fit = linearTrend(points);
const { trend, points: projected } = projectSeries(points, { to: 2035 });
```

The projection is an arithmetic consequence of a least-squares fit, not a
forecast. It assumes the observed rate of change continues unchanged, and knows
nothing of policy, saturation, or any driver of the process.

The band is a **prediction** interval, not a confidence interval:

```text
se(x) = s · √[ 1 + 1/n + (x − x̄)² / Σ(x − x̄)² ]
```

The leading `1` accounts for the scatter of an individual observation about the
line, not only for uncertainty in the line's position. A projection is a claim
about a future observation, so this is the appropriate interval — and it is
wider than a confidence interval, correctly.

Uncertainty is narrowest at the mean of `x` and widens with distance from it, so
the band flares. A wide band is the chart telling the truth.

> **Warning:** read `r2` and `residualStandardError` before publishing a
> projection. A low `r²` does not mean the series is flat; it means a straight
> line is the wrong description of it, and projecting one anyway produces a
> confident-looking claim about a process the model does not describe.

`linearTrend` returns `slope`, `intercept`, `r2`, `residualStandardError`, `n`,
`meanX`, `sumSquaresX`, and the functions `predict(x)` and `standardErrorAt(x)`.
`movingAverage` and `compoundGrowthRate` are also exported for callers
characterising a series without fitting a line to it.

## `ClassAreaChart`

```tsx
import { ClassAreaChart } from '@hridayanp/geo-charts';

<ClassAreaChart title="Land-cover composition" unit="km²" data={composition} />
```

| Prop | Type | Default | Behaviour |
| --- | --- | --- | --- |
| `data` | `ClassAreaDatum[]` | — | `{ label, color, value, compareValue? }` |
| `mode` | `'composition' \| 'change'` | `'composition'` | Magnitude, or signed difference |
| `showShare` | `boolean` | `true` in composition | Also show each class's share of the total |
| `sorted` | `boolean` | `true` | Rank by magnitude rather than keeping table order |
| `beforeLabel` / `afterLabel` | `string` | — | Epoch captions in change mode |
| `unit` | `string` | — | Appended to values |

Bars are horizontal because class names are words. Rotating them under vertical
columns costs the reader a head-tilt for no gain, and a horizontal bar leaves
room for the full label and its value on one line.

In `change` mode the bars diverge from a central zero — gains right, losses left
— and `compareValue` supplies the second epoch. A signed quantity plotted as
unsigned magnitude, with two equal bars for a gain and a loss, is the standard
way a change chart becomes unreadable.

Value labels sit inside the bar when they fit and outside when they do not, so a
short bar never has its label clipped or overlapped. Hit targets span the full
row width rather than the bar, so a small class is as easy to hover as a large
one.

Pair it with `classAreas` and `netChange` from
[`classified-raster`](/docs/classified-raster):

```tsx
<ClassAreaChart
  mode="change"
  data={netChange(matrix).map((entry) => ({
    label: entry.class.label,
    color: entry.class.color,
    value: entry.fromAreaKm2,
    compareValue: entry.toAreaKm2,
  }))}
/>
```

> **Note:** net change conceals gross change. A class can be stable in net terms
> while a large area of it is converted and an equal area gained elsewhere. Where
> that distinction matters, show the transition matrix as well.

## `ChangeMatrix`

```tsx
import { ChangeMatrix } from '@hridayanp/geo-charts';

<ChangeMatrix
  title="Land-cover transitions"
  unit="km²"
  classes={matrix.classes}
  values={matrix.areaKm2}
/>
```

| Prop | Type | Default | Behaviour |
| --- | --- | --- | --- |
| `classes` | `MatrixClass[]` | — | `{ label, color }`, one order shared by both axes |
| `values` | `number[][]` | — | `values[from][to]` |
| `fromLabel` / `toLabel` | `string` | `'From'` / `'To'` | Axis captions |
| `excludeDiagonal` | `boolean` | `true` | Exclude persistence from the colour scale |
| `unit` | `string` | — | Cell unit |

Rows are the earlier class, columns the later one, so the diagonal is
persistence and everything off it is conversion. The shape is exactly what
`transitionMatrix` returns.

Cell colour encodes magnitude, so it is a **single-hue ramp with monotone
lightness**. A multi-hue ramp has no perceptual ordering: a reader cannot say
whether green means more than orange without consulting the legend for every
cell. Class identity lives on the axes instead, where each label carries its map
colour.

> **Note:** `excludeDiagonal` defaults to `true` because persistence usually
> holds most of the area. Including it compresses every conversion into the
> ramp's lightest step and the matrix reads as empty. The diagonal is still drawn
> and still labelled — it is simply not what the ramp is stretched across.

Cells are separated by a 2px surface gap so adjacent fills of similar magnitude
remain distinguishable, and each cell reports its exact value and share on hover.

## Accessibility

Every chart is a `<figure>` with a `<figcaption>` and ships a **table view** — a
keyboard-reachable toggle rendering the same values as text.

This is not an optional extra. A chart encodes values as position and colour,
both unavailable to a screen-reader user and unreliable for a reader with a
colour vision deficiency. No value in any chart here is reachable only by
hovering: tooltips enhance and never gate.

A legend is present whenever two or more series are drawn, and up to four are
also directly labelled at the end of their line, so identity is never carried by
colour alone. A single series draws no legend box, because the title already
names it.

The default categorical palette is eight hues in a fixed order, validated so that
adjacent pairs stay separable under simulated protanopia and deuteranopia, with a
re-stepped set for dark surfaces. Hues are assigned in order and never cycled —
a ninth series is a signal to fold into "Other" or facet, not to generate a
colour.

> **Warning:** colour follows the entity, not its rank. Filtering a chart to
> fewer series must not repaint the survivors, or the reader's memory of what
> each colour meant becomes wrong.

## Integration boundaries

The package computes no geospatial quantity. Latitude-weighted areas come from
[`classified-raster`](/docs/classified-raster), cluster statistics from
[`hotspot-analysis`](/docs/hotspot-analysis); `geo-charts` receives numbers that
are already correct and presents them.

It has no map dependency and imports nothing from the layer packages. A chart can
be rendered beside a map, in a panel, or in a report with no map at all.

The three forms cover the analyses this library produces. A chart outside that
scope — a scatter matrix, a distribution, a network — is an application concern,
and `linearTrend`, the scale helpers and the validated palettes are exported so
one can be built on the same footing.

## Performance considerations

- Charts are static SVG. There is no animation loop, no canvas, and no layout
  pass beyond what the browser performs on the emitted elements.
- Layout is computed once per render and memoised on the data, so hovering
  recomputes nothing — the crosshair and tooltip read from the existing geometry.
- A `TrendChart` is comfortable to a few hundred points per series. Beyond that,
  aggregate upstream: a line with more points than the plot has pixels is not
  showing them.
- `ChangeMatrix` renders *k*² cells for *k* classes, which is negligible for any
  real coding scheme, and its labels are measured rather than laid out
  iteratively.
- The table view mounts only when opened.

## Geospatial considerations

- The package holds no coordinates and performs no geodesy. Areas arriving from
  `classAreas` are already latitude-weighted; charting raw cell counts instead
  would reintroduce exactly the bias that weighting removes.
- Units are the caller's. `unit` is a presentation string, not a conversion — the
  chart never rescales a value.
- Where a series corresponds to a map class, its colour must be the map's colour.
  This is the one coupling between chart and map, and it is deliberate.
