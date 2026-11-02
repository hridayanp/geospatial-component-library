# @hridayanp/map-markers

React-rendered map markers and popups, and a click-to-pick point selector.

## Installation

```bash
npm install @hridayanp/map-markers @hridayanp/map-container maplibre-gl react react-dom
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
  <MapMarker lngLat={[75.9, 9.8]} label="Kochi" onClick={select}>
    <ValueChip value={32} />
  </MapMarker>
  {selected && (
    <MapPopup lngLat={selected.lngLat} onClose={() => setSelected(null)}>
      <StationSummary station={selected} />
    </MapPopup>
  )}
  <PointPicker value={point} onChange={setPoint} snap={0.25} gridOrigin={0.125} />
</MapContainer>
```

## Notes

- Content renders through a portal, so it keeps React context and state.
- Markers suit a handful of interactive things; use `VectorLayer` for hundreds of points.
- Markers with `onClick` are keyboard-focusable buttons named by `label`.
- `MapPopup` is controlled: render to open, unmount to close.
- `PointPicker` rounds to `precision` and can snap to a model grid.
