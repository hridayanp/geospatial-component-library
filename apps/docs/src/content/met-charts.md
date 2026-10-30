## Purpose

`met-charts` draws the charts meteorology reads data through, as dependency-free
SVG: a Skew-T log-P diagram, a hodograph, a wind rose, a meteogram, a profile
along a line, a vertical cross-section, a forecast verification scatter, a
sparkline and a wind compass.

```bash
npm install @hridayanp/met-charts react
```

```ts
import '@hridayanp/ui/styles.css';
```

Every chart is built on the `ChartFrame` from [`geo-charts`](/docs/geo-charts):
the same heading, legend, caption and **table view**. The table carries every
plotted value, is reachable by keyboard, and is the accessible equivalent of
the chart — nothing is available only by hovering or by telling colours apart.

## `SkewTChart`

```tsx
<SkewTChart title="VOCI 00Z" levels={sounding} />
```

Pressure falls logarithmically up the vertical axis; isotherms lean at 45°.
Behind the traces: dry adiabats (solid, faint), moist adiabats (dashed) and
saturation mixing-ratio lines (dotted). A wind-barb column runs down the right
edge, thinned so barbs never overlap.

With `showParcel` (default) the lowest level is lifted — dry-adiabatically to its
LCL, pseudo-adiabatically above — and LCL, LFC, EL, CAPE and CIN are reported in
the subtitle.

| Prop | Type | Default |
| --- | --- | --- |
| `levels` | `SoundingLevel[]` — `pressure`, `temperature`, `dewpoint?`, `windSpeed?` (kt), `windDirection?`, `height?` | — |
| `pressureTop` / `pressureBottom` | hPa | `100` / `1050` |
| `temperatureRange` | °C along the bottom | `[-40, 50]` |
| `showReferenceLines` / `showParcel` / `showWindBarbs` | `boolean` | `true` |
| `temperatureColor` / `dewpointColor` | | `'#e34948'` / `'#1baf7a'` |

## Thermodynamics

| Function | |
| --- | --- |
| `saturationVaporPressure(t)` | hPa, Bolton (1980) |
| `mixingRatio(e, p)` / `saturationMixingRatio(t, p)` | kg/kg |
| `potentialTemperature(t, p)` / `dryAdiabatTemperature(θ, p)` | |
| `moistAdiabat(t0, p0, pressures)` | pseudo-adiabat, RK2 in 5 hPa steps |
| `liftingCondensationLevel(t, td, p)` | Bolton (1980) eq. 15 |
| `temperatureAtMixingRatio(w, p)` | for mixing-ratio lines |
| `analyzeParcel(levels)` | path, LCL, LFC, EL, CAPE, CIN |

These match MetPy's defaults to within a few tenths of a degree through the
troposphere — finer than a Skew-T can be read. CAPE and CIN integrate
`Rd (Tparcel − Tenv) d ln p` using temperature rather than virtual temperature,
the textbook definition, a few per cent below a virtual-temperature value.

## `Hodograph`

The wind profile traced as the tip of each level's vector. Curvature shows
directional shear and length shows speed shear — the two ingredients of storm
organisation a barb column hides. Rings mark speed; the trace is coloured from
the surface upward by `level` (height or pressure) through `colorScale`.

## `WindRose`

```tsx
<WindRose samples={hourly.map((h) => ({ direction: h.wd, speed: h.ws }))} speedBins={[0, 5, 10, 20, 30]} />
```

Petals point to where the wind comes **from**; length is the share of time,
stacked by speed class. Calms have no direction, so they are kept out of the
petals and reported in the subtitle. `windRoseBins(samples, options)` does the
binning and accepts pre-binned `data` from a server.

## `Meteogram`

Several variables at one place, stacked on a shared **UTC** time axis with one
crosshair across every panel. Each panel takes `line`, `bar` or `area` series
and its own unit; an optional wind row draws barbs along the axis; `marker`
draws a vertical line at "now" or the selected frame. Times are formatted
`Wed 16 12Z` — forecasts are issued in UTC, and a local-time axis is a quiet
source of off-by-hours misreadings.

## `ProfileChart` and `profileAlongPath`

```tsx
const samples = profileAlongPath(raster, drawnLine, { samples: 240 });
<ProfileChart samples={samples} yLabel="Rain (mm)" onHoverSample={(i) => setCursor(i == null ? null : samples[i].lngLat)} />
```

`profileAlongPath` spaces samples along **great circles**, always including the
path's vertices, so chart distance is real distance. NoData breaks the line
rather than being bridged. `onHoverSample` links the chart to a map marker.

## `CrossSectionChart`

A variable through the depth of the atmosphere along a line: coloured cells on
distance against log-pressure (surface at the bottom) or height, with a colour
key. The host supplies `values[level][distance]` sampled from its model levels.

## `ScatterChart` and `verificationStats`

Forecast against observation on one shared range, so the 1:1 line runs corner
to corner: above it is over-forecast, below it under-forecast. The fitted line
shows conditional bias — a slope below one is a forecast too timid at the
extremes. The subtitle carries n, bias, MAE, RMSE and r, from
`verificationStats(pairs)`.

## `Sparkline` and `WindCompass`

Word-sized forms for table cells, stat tiles and popups. A sparkline has no axes,
so its `label` is required and carries the meaning for assistive technology. The
compass needle points to where the wind comes from (or downwind with
`pointTo="to"`), with the speed in the centre.
