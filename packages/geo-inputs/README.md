# @hridayanp/geo-inputs

Form inputs for geographic values: a latitude/longitude field that reads every common notation, and a bounding-box editor.

## Installation

```bash
npm install @hridayanp/geo-inputs react
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
<LatLonInput label="Location" value={point} onChange={setPoint} format="ddm" />
<BboxEditor value={region} onChange={setRegion} onUseCurrentView={readMapBounds} />
```

## Notes

- `parseLatLon` reads decimal, DMS and degrees-decimal-minutes, hemisphere
  letters before or after, either axis order when letters say which is which.
  Out-of-range values are rejected, never clamped.
- `formatLatLon` writes latitude first: `9.80°N 75.90°E`.
- `LatLonInput` commits on Enter or blur and redisplays the parsed value.
- `BboxEditor` emits only valid boxes and names the rule that failed otherwise.
- No map dependency — `onUseCurrentView` is a callback.
