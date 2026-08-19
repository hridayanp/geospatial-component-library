GPU-accelerated flow particles for any vector field — wind, ocean currents,
drift, migration. Built on deck.gl and WeatherLayers GL.

```bash
npm install @hridayanp/wind-particle-layer @hridayanp/map-container \
  maplibre-gl weatherlayers-gl \
  @deck.gl/core @deck.gl/mapbox @deck.gl/extensions @deck.gl/layers
```

## Usage

```tsx
<MapContainer center={[92, 25.5]} zoom={6}>
  <WindParticleLayer
    data={{ kind: 'field', u, v, width, height, bounds }}
    particleCount={2500}
    speedFactor={6}
    maxAge={45}
    colors={['#93c5fd', '#facc15', '#ef4444']}
  />
</MapContainer>
```

**The package renders; it never retrieves.** There is no fetching, no polling
and no data source of any kind inside it.

## Data formats

Three shapes converge on one thing: a UV-encoded RGBA texture.

### A velocity grid — the canonical form

```tsx
data={{
  kind: 'field',
  u,        // eastward components, row-major, north row first
  v,        // northward components
  width, height,
  bounds,   // [west, south, east, north]
  noData,   // optional sentinel
}}
```

No resampling needed; this encodes directly.

### Scattered observations

```tsx
data={{
  kind: 'points',
  data: geojson,                  // features with speed + direction
  directionConvention: 'from',    // or 'towards'
  frameKey: timestamp,            // avoids rebuilding an unchanged field
}}
```

Properties are read with a wide alias list — `wind_speed_kt`, `speed`, `ws`,
`wind_dir_deg`, `direction`, `wind_dir_deg_compass` and more — and compass names
are parsed in every spelling real feeds use (`SSW`, `South-Southwest`,
`SOUTHSOUTHWEST`). Explicit `u`/`v` properties win when present, since they
carry no convention ambiguity.

### A pre-encoded UV image

```tsx
data={{ kind: 'image', url, bounds, imageUnscale: [-60, 60] }}
```

## How it works

Velocities are packed into an RGBA texture and uploaded once:

```text
R = (u + maxSpeed) / (2 * maxSpeed) * 255    eastward
G = (v + maxSpeed) / (2 * maxSpeed) * 255    northward
B = 0
A = 255 where data exists, 0 elsewhere
```

From then on the GPU advects every particle and reconstructs its speed as
`sqrt(u² + v²)` to sample the colour ramp. **The CPU does nothing per frame** —
which is why 5,000 particles animate as cheaply as 500.

`imageUnscale: [-maxSpeed, maxSpeed]` tells the shader how to decode the bytes
back to real velocities.

> **Warning:** Alpha must be a hard `255`, never partial. WeatherLayers treats
> anything less as missing data and draws no particles there. This is the most
> common mistake when producing UV textures in an external pipeline.

## Direction convention

Meteorological data reports where wind comes **from**. That is the default.

```tsx
directionConvention: 'from'      // default — particles travel the opposite way
directionConvention: 'towards'   // the value IS the direction of travel
```

If your particles flow backwards, this is the first prop to check. The
[Storybook story](/docs/composition) shows both side by side with identical
data.

## Rasterising scattered points

Two details separate "reads as weather" from "reads as a scatter plot":

**Grid size comes from the data's own spacing.** The median gap between sorted
unique coordinates infers the step, so the texture matches the observations'
real resolution rather than an arbitrary constant.

**Gaps take a distance-weighted average of neighbours** — four passes,
orthogonal neighbours weighted `1`, diagonals `1/√2`. Copying the nearest cell
instead leaves a visible seam where two filled patches meet, which on screen
reads as the flow "jumping" between vectors.

Generated textures are capped at 512 px on the longest edge.

## Props

| Prop | Default | Notes |
| --- | --- | --- |
| `data` | — | `null` renders nothing |
| `visible` | `true` | |
| `particleCount` | `2500` | The dominant cost |
| `maxAge` | `45` | Trail length in frames |
| `speedFactor` | `6` | Speed multiplier |
| `width` | `1.4` | Stroke width in pixels |
| `opacity` | `0.9` | |
| `maxSpeed` | `60` | Full scale; faster values are clamped **without rotating the vector** |
| `color` | — | A single `[r, g, b, a]` tuple; overrides `colors` |
| `colors` | — | Ramp applied by reconstructed speed |
| `palette` | — | Explicit `[value, colour]` stops |
| `imageInterpolation` | `CUBIC` | `NEAREST` gives point-exact but visibly stepped motion |
| `imageSmoothing` | `0.6` | Extra pre-blur, in cells |
| `transitionMs` | `900` | Cross-fade when the field changes |
| `maxZoom` | `null` | Stop drawing above this zoom |
| `beforeId` | — | Insert deck's draw call below a MapLibre layer |
| `interleaved` | `true` | Draw inside the MapLibre pass |

## Transitions

When the field changes, the old and new textures are blended on the GPU over
`transitionMs`. Particles keep their positions and trails **through** a timeline
step instead of restarting — which is what makes playback look continuous rather
than stuttery.

```tsx
<WindParticleLayer data={fields[index]} transitionMs={1200} />
```

Blending only applies when consecutive grids have **identical dimensions**;
otherwise the two would be sampled at mismatched cells, so the new field
replaces the old outright.

The fade is driven by a `requestAnimationFrame` loop with smoothstep easing that
**stops running once the blend completes** — the steady state costs nothing per
frame. Particle motion itself is GPU-side regardless.

## Sharing one deck instance

```tsx
import { DeckOverlay } from '@hridayanp/deck-overlay';

<DeckOverlay>
  <WindParticleLayer id="surface" data={surface} />
  <WindParticleLayer id="upper" data={upper} />
</DeckOverlay>
```

Without the wrapper each layer creates its own `MapboxOverlay` — a separate
deck.gl instance, animation loop and picking pass. See
[`deck-overlay`](/docs/deck-overlay).

## The hook

```tsx
import { useWindParticleLayers } from '@hridayanp/wind-particle-layer';

const layers = useWindParticleLayers({ data, particleCount, colors });
// deck.gl Layer[] — drop into your own deck instance
```

## Utilities

```ts
import {
  extractWindVectors,   // GeoJSON → { lon, lat, speed, direction, u, v }[]
  pointsToTexture,      // scattered vectors → UV texture
  fieldToTexture,       // u/v grid → UV texture
  encodeUVTexture,      // raw arrays → UV texture
} from '@hridayanp/wind-particle-layer';
```

## Performance

- `particleCount` dominates. 2,000–3,000 reads well at continental scale; past
  ~10,000 the field becomes visual noise before it becomes slow.
- `maxAge` multiplies trail geometry — long trails on many particles are the
  second cost.
- Generated textures are capped at 512 px per edge.

## Limitations

- **Requires WebGL2.** There is no canvas fallback.
- 8-bit UV encoding gives a quantisation step of `2 × maxSpeed / 255` — about
  0.47 kt at the default scale.
- Particles are clipped to `±85.05°` latitude, otherwise they wrap past the
  poles and smear across the top and bottom of the map.
