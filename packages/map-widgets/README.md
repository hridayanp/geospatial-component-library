# @hridayanp/map-widgets

Map furniture: scale bar, cursor coordinates, north arrow, overview inset, place search, colour-ramp picker and loading overlay.

## Installation

```bash
npm install @hridayanp/map-widgets @hridayanp/map-container maplibre-gl react
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
  <LocationSearch onSearch={geocode} />
  <MapControlBar><ZoomControl /><NorthArrow /></MapControlBar>
  <ScaleBar unit="nautical" />
  <CoordinateReadout format="ddm" />
  <MiniMap mapStyle={overviewStyle} />
  <MapLoadingOverlay />
</MapContainer>
```

## Components

| Component | Notes |
| --- | --- |
| `ScaleBar` | Geodesic, measured at the view centre on every move; metric, imperial or nautical |
| `CoordinateReadout` | Latitude first, any notation; falls back to the map centre |
| `NorthArrow` | Turns with the map; click to face north |
| `MiniMap` | Overview inset that follows the main map and outlines its view |
| `LocationSearch` | Debounced, cancellable, ARIA combobox; the geocoder is the host's `onSearch` |
| `ColorRampPicker` | Scientific ramps; emits colours ready for `colorScale` |
| `MapLoadingOverlay` | Follows the map's loading state or a `loading` prop |

Layer pickers stay out, as they do in `map-controls`: they describe an
application, not a map.
