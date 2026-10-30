# @hridayanp/data-tile-layer

Value-encoded data tiles decoded and coloured in the browser, with an A − B difference mode and exact value sampling.

## Installation

```bash
npm install @hridayanp/data-tile-layer @hridayanp/map-container maplibre-gl react
```

## Usage

```tsx
<DataTileLayer
  tiles="https://tiles.example.internal/t2m/{z}/{x}/{y}.png"
  encoding={{ format: 'uint16', scale: 0.01, offset: -100 }}
  colorScale={palette}
  min={-10}
  max={45}
  frameKey="t2m-2026103000-f012"
/>
```

## The tile contract

Tiles carry numbers, not colours. The default packs a 16-bit integer into red
and green (`raw = R × 256 + G`), then `value = raw × scale + offset`; alpha 0 is
NoData. Terrarium and Terrain-RGB are built in. `decodeTilePixels` and
`encodeTileValues` document the contract in code.

Each tile is decoded once and cached, so a new ramp or range recolours from
memory with no requests, and `onHoverValue` reports exact values.

## Sources

`tiles` is a URL template the host has already authorised; `loadTile` replaces
fetching entirely and may return decoded values. `subtract` renders `A − B`.

`min` and `max` are required — a tiled field has no global range the browser can
see, and per-tile scaling would seam at every tile edge.

## Exports

| Export | Notes |
| --- | --- |
| `DataTileLayer` | The layer; a ref exposes `sample(lngLat)` and `reload()` |
| `decodeTilePixels`, `encodeTileValues` | The encoding contract |
| `loadTileValues`, `toTileValues` | Loading and normalisation |
| `lngLatToTile`, `tileBounds`, `TileValueCache` | Tile maths and the LRU cache |
