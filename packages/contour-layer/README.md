# @hridayanp/contour-layer

Isolines traced from a raster — isobars, isotherms, isohyets — drawn and labelled by MapLibre.

## Installation

```bash
npm install @hridayanp/contour-layer @hridayanp/map-container maplibre-gl react
```

## Usage

```tsx
<MapContainer>
  <ContourLayer data={mslp} interval={4} base={1000} majorEvery={5} />
</MapContainer>
```

## How it works

`computeContours(raster, options)` runs marching squares through cell centres
and returns a GeoJSON FeatureCollection of `LineString`s carrying `value`,
`level`, `major` and `closed`. The component hands that to an ordinary GeoJSON
source. NoData leaves a gap, saddles resolve by the cell-centre average, and
Chaikin smoothing removes grid stair-steps.

## Levels

`levels` (explicit) wins; otherwise `interval` and `base` generate round values
through the base, or `count` picks a 1–2–5 step. Every `majorEvery`-th level,
counted from `base`, is drawn thicker and labelled.

Labels need a `glyphs` URL in the map style; without one they are skipped and
the lines still render.

## Exports

| Export | Notes |
| --- | --- |
| `ContourLayer` | The layer component |
| `computeContours` | Pure function: `RasterData` → GeoJSON, worker-safe |
| `contourLevels` | The level generation on its own |
