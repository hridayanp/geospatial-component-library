# @hridayanp/wind-barb-layer

Wind barbs and direction arrows, rendered natively by MapLibre — no deck.gl.

## Installation

```bash
npm install @hridayanp/wind-barb-layer @hridayanp/map-container maplibre-gl react
```

## Usage

```tsx
<MapContainer>
  <WindBarbLayer data={{ kind: 'field', u, v, width, height, bounds }} unit="m/s" />
</MapContainer>
```

## Data

Takes the same `{ kind: 'field' }` and `{ kind: 'points' }` shapes as
`@hridayanp/wind-particle-layer`, structurally, so one object drives particles
and barbs. `unit` converts speeds to knots. Grids are decimated to `maxBarbs`.

## Convention

WMO practice: round to 5 kt; pennant 50, full feather 10, half feather 5; lone
half feather set in from the tip; calm is a circle; the shaft points to where
the wind comes from. Feathers mirror in the southern hemisphere
(`hemisphere="auto"` picks per barb).

## Rendering

Icons are signed-distance-field images generated on demand, so one image per
speed serves any `color`, `colorStops` and halo.

## Exports

| Export | Notes |
| --- | --- |
| `WindBarbLayer` | The layer component; `mode="barb" \| "arrow"` |
| `extractWindBarbs` | Resolve input into `{ lng, lat, speedKt, direction }` |
| `barbComponents` | Pennant / feather / half-feather counts for a speed |
| `createBarbImage`, `createArrowImage` | The SDF icon images |
| `toKnots` | Unit conversion |
