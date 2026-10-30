# @hridayanp/geo-charts

Charts for the output of geospatial analysis: a time series with a least-squares
projection, class composition and change, and a class transition matrix.

Rendered as inline SVG with no charting dependency.

## Installation

```bash
npm install @hridayanp/geo-charts react
```

```ts
import '@hridayanp/ui/styles.css';
```

## Scope

Three forms, chosen because they answer questions the rest of this library
produces answers to. This is not a general plotting library, and a chart outside
these three is better served by one.

## Colour comes from the caller

When a chart describes something also drawn on a map, it must adopt the map's
symbology. A composition chart whose "Trees" bar is not the green the map paints
trees forces the reader to learn the encoding twice, and the mismatch reads as
two different datasets.

Every component therefore takes its data colours as props — pass the same class
table the layer was given. The exported palettes are fallbacks for series with no
cartographic colour of their own.

## Trend and projection

```tsx
import { TrendChart } from '@hridayanp/geo-charts';

<TrendChart
  title="Land-cover area by class"
  yLabel="Area (km²)"
  unit="km²"
  projectTo={2030}
  clampProjection={[0, Infinity]}
  series={classes.map((c) => ({ id: c.label, color: c.color, points: c.series }))}
/>;
```

Observed values are drawn solid; projected values dashed, inside a prediction
band. The distinction is the point of the chart: a projection rendered
identically to an observation invites the reader to treat an extrapolation as
data.

**The projection is arithmetic, not a forecast.** It assumes the observed rate of
change continues, and knows nothing of saturation, policy or any driver of the
process. The band widens with distance from the observed period because the
observations constrain a distant value only loosely — a wide band is the chart
telling the truth, not a defect.

```ts
import { linearTrend, projectSeries, movingAverage, compoundGrowthRate }
  from '@hridayanp/geo-charts';

const trend = linearTrend(points);
// { slope, intercept, r2, residualStandardError, predict, standardErrorAt }
```

`r2` and the residual standard error are returned alongside the coefficients
rather than left implicit. A low `r2` does not mean the series is flat; it means
a straight line is the wrong description of it.

The band is a **prediction** interval, not a confidence interval — it accounts
for the scatter of an individual observation about the line, not only for
uncertainty in the line's position, because a projection is a statement about a
future observation.

## Composition and change

```tsx
import { ClassAreaChart } from '@hridayanp/geo-charts';
import { classAreas } from '@hridayanp/classified-raster';

const areas = classAreas(landCover, LAND_COVER);

<ClassAreaChart
  title="Land-cover composition"
  unit="km²"
  data={areas.classes.map((c) => ({ label: c.label, color: c.color, value: c.areaKm2 }))}
/>;
```

Supply `compareValue` and set `mode="change"` for a diverging view: gains extend
right of zero, losses left. A signed quantity plotted as unsigned magnitude — two
equal bars for a gain and a loss — is the standard way a change chart becomes
unreadable.

Bars are horizontal because class names are words: rotating them under columns
costs a head-tilt for no gain.

## Transition matrix

```tsx
import { ChangeMatrix } from '@hridayanp/geo-charts';
import { transitionMatrix } from '@hridayanp/classified-raster';

const matrix = transitionMatrix(epoch2017, epoch2024, LAND_COVER);

<ChangeMatrix
  title="Land-cover transitions, 2017 → 2024"
  unit="km²"
  classes={matrix.classes}
  values={matrix.areaKm2}
/>;
```

Rows are the earlier class, columns the later one: the diagonal is persistence,
everything off it is conversion. Reading across a row shows where a class went;
reading down a column shows where it came from.

Cell colour encodes magnitude, so it is a **single-hue ramp with monotone
lightness**. A multi-hue ramp has no perceptual ordering — a reader cannot say
whether green means more than orange without consulting the legend for every
cell, which is exactly the work encoding magnitude as colour is meant to save.
Class identity lives on the axes instead, where each label carries its map
colour.

The diagonal is excluded from the colour scale by default. Persistence usually
holds most of the area, so including it compresses every conversion into the
lightest step and the matrix reads as empty.

## Accessibility

Every chart ships a **table view** — a keyboard-reachable toggle rendering the
same values as text. A chart encodes values as position and colour, both
unavailable to a screen-reader user and unreliable for a reader with a colour
vision deficiency, so the table is the accessible equivalent and also the fastest
way to read an exact number.

No value is reachable only by hovering. Tooltips and hover readouts enhance;
they never gate.

The default palettes are validated for colour-vision deficiency: eight
categorical hues in a fixed order whose adjacent pairs stay separable under
simulated protanopia and deuteranopia, with a re-stepped set for dark surfaces.
Assign in sequence and never cycle — a ninth generated hue is indistinguishable
from an existing slot for a substantial share of readers, so a ninth series folds
into "other" or becomes a facet.

## Theming

Chrome — axes, gridlines, text, surfaces — is drawn from the library's `--gcl-*`
tokens, so charts follow `data-gcl-theme` and `prefers-color-scheme` with the
rest of the library.

The sequential ramp ships as `--gcl-viz-seq-0` … `--gcl-viz-seq-5`, each paired
with a `-ink` token that clears contrast against it. On a dark surface the ramp
is re-anchored rather than inverted, so near-zero recedes into the surface in
both modes.

## Utilities

```ts
import { linearScale, niceTicks, niceDomain, formatCompact, formatPercent }
  from '@hridayanp/geo-charts';
```

`niceDomain` includes zero by default. Bar length encodes magnitude from the
baseline, so a truncated baseline multiplies apparent differences — the most
common way a correct number becomes a misleading chart.

## Documentation

Interactive examples live in the workspace Storybook:

```bash
npm run storybook
```

## License

MIT
