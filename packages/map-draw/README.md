# @hridayanp/map-draw

Drawing, editing and geodesic measurement on a MapLibre map, built on terra-draw.

## Installation

```bash
npm install @hridayanp/map-draw @hridayanp/map-container maplibre-gl react
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
<MapContainer>
  <DrawControl
    modes={['polygon', 'rectangle', 'circle', 'select']}
    singleFeature
    onChange={(features) => setArea(features[0] ?? null)}
  />
</MapContainer>
```

## Notes

- Shapes leave through `onChange` as plain GeoJSON; guide and handle features are filtered out.
- `defaultFeatures` seeds a saved shape for editing; `singleFeature` keeps only the latest.
- Shapes survive a basemap switch: they are snapshotted and restored onto the new style.
- `measureFeature` is geodesic — spherical-excess areas, great-circle lengths, circle radius.
- `useMapDraw` is the hook behind the toolbar, for building your own.

terra-draw and its MapLibre adapter are regular dependencies and install with
this package.

## Exports

| Export | Notes |
| --- | --- |
| `DrawControl` | Docked toolbar with delete, clear and a measurement readout |
| `useMapDraw` | Mode, shapes and actions as a hook |
| `measureFeature`, `measureGeometry`, `ringAreaKm2`, `pathLengthKm` | Geodesic measurement |
| `formatArea`, `formatDistance` | Readable units |
