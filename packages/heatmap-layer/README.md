# @hridayanp/heatmap-layer

A GPU point-density heatmap for MapLibre.

## Installation

```bash
npm install @hridayanp/heatmap-layer @hridayanp/map-container maplibre-gl react
```

## Usage

```tsx
<MapContainer>
  <HeatmapLayer data={strikes} weightProperty="peakCurrent" weightDomain={[0, 120]} pointsFromZoom={10} />
</MapContainer>
```

## Notes

- Without `weightProperty`, every point counts once.
- `radius` and `intensity` take a number or `[zoom, value]` stops.
- The lowest ramp stop is always transparent, so zero density never tints the map.
- `pointsFromZoom` cross-fades to individual points where density stops being useful.

The kernel is in screen pixels, so the surface changes with zoom. For a density
surface with a bandwidth in kilometres, use `kernelDensity` from
`@hridayanp/hotspot-analysis` with `RasterLayer`.
