# @hridayanp/met-charts

Meteorological charts as dependency-free SVG: Skew-T, hodograph, wind rose, meteogram, profile, cross-section, verification scatter, sparkline and wind compass.

## Installation

```bash
npm install @hridayanp/met-charts react
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
<SkewTChart title="VOCI 00Z" levels={sounding} />
<Meteogram times={validTimes} panels={panels} wind={{ speed, direction }} />
<WindRose samples={observations} />
```

## Charts

| Component | Notes |
| --- | --- |
| `SkewTChart` | Adiabats and mixing-ratio lines; surface parcel with LCL, LFC, EL, CAPE, CIN; barb column |
| `Hodograph` | Wind profile as vector tips, coloured by level |
| `WindRose` | Direction × speed frequencies; calms reported separately |
| `Meteogram` | Stacked panels on a shared UTC axis, optional wind barbs |
| `ProfileChart` | A value against great-circle distance along a line |
| `CrossSectionChart` | Distance against log-pressure or height |
| `ScatterChart` | Forecast vs observed, 1:1 line, fit, bias / MAE / RMSE / r |
| `Sparkline`, `WindCompass` | Word-sized forms |

Every chart uses `ChartFrame` from `@hridayanp/geo-charts`, so each has the same
heading, legend and accessible table view.

## Functions

`analyzeParcel`, `moistAdiabat`, `liftingCondensationLevel`,
`saturationVaporPressure` and friends (Bolton 1980, RK2 pseudo-adiabat);
`windRoseBins`; `verificationStats`; `profileAlongPath`; `formatUtcShort`.
