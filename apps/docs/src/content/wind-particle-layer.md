## Purpose

`WindParticleLayer` visualises a two-dimensional vector field as GPU-advected
flow particles — atmospheric wind, ocean currents, drift trajectories, migration
vectors.

Rendering is performed by WeatherLayers GL through deck.gl, composited into the
MapLibre render pass. The package accepts a field through props and produces
animation; it performs no retrieval.

```bash
npm install @hridayanp/wind-particle-layer @hridayanp/map-container \
  maplibre-gl weatherlayers-gl \
  @deck.gl/core @deck.gl/mapbox @deck.gl/extensions @deck.gl/layers
```

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

## Responsibilities

| Concern | Owner |
| --- | --- |
| Vector-field normalisation and UV texture encoding | `WindParticleLayer` |
| Rasterisation of scattered observations onto a grid | `WindParticleLayer` |
| deck.gl layer construction and registration | `WindParticleLayer` |
| GPU advection and trail rendering | WeatherLayers GL |
| Field retrieval, temporal alignment, unit conversion | Host application |
| Direction convention of the source data | Host application, declared through props |

## Data model

Three input forms converge on one representation: a UV-encoded RGBA texture.

### Velocity grid

```tsx
data={{
  kind: 'field',
  u,        // eastward components, row-major, northern row first
  v,        // northward components
  width, height,
  bounds,   // [west, south, east, north], EPSG:4326
  noData,   // optional sentinel; cells equal to it draw no particles
}}
```

The canonical form. Components are in the same unit as `maxSpeed` and encode
directly with no resampling.

### Scattered observations

```tsx
data={{
  kind: 'points',
  data: geojson,                  // point features carrying speed and direction
  speedProperty: 'wind_speed_kt', // optional; a default alias list is used
  directionProperty: 'wind_dir_deg',
  directionConvention: 'from',    // or 'towards'
  frameKey: timestamp,            // avoids rebuilding an unchanged field
}}
```

Property names are resolved through a wide alias list — `speed`, `wind_speed`,
`wind_speed_kt`, `ws`, `value` for magnitude; `direction`, `wind_dir_deg`, `dir`
for bearing — and compass bearings are parsed in every spelling operational
feeds use (`SSW`, `South-Southwest`, `SOUTHSOUTHWEST`, `247.5°`). Explicit `u`
and `v` properties take precedence when present, since they carry no convention
ambiguity.

### Pre-encoded UV image

```tsx
data={{ kind: 'image', url, bounds, imageUnscale: [-60, 60] }}
```

For fields encoded by an upstream processing pipeline. The encoding must match
the WeatherLayers `imageUnscale` contract described below.

## Rendering model

Velocities are packed into an RGBA texture and uploaded once:

```text
R = (u + maxSpeed) / (2 * maxSpeed) * 255    eastward component
G = (v + maxSpeed) / (2 * maxSpeed) * 255    northward component
B = 0
A = 255 where data exists, 0 elsewhere
```

From that point the GPU advects every particle and reconstructs speed as
`sqrt(u² + v²)` to sample the colour ramp. **No per-frame CPU work occurs**,
which is why 5,000 particles cost approximately what 500 cost.

`imageUnscale: [-maxSpeed, maxSpeed]` informs the shader how to decode the bytes
back to physical velocities.

> **Warning:** Alpha must be exactly `255`, never partial. WeatherLayers treats
> any lower value as absent data and renders no particles there. Anti-aliasing
> or a premultiplied-alpha step in an external encoding pipeline is the usual
> cause of an unexplained gap in the field.

### Rasterising scattered observations

Two properties separate a continuous flow field from a scatter of isolated
vectors:

**Grid resolution is inferred from the observations.** The median gap between
sorted unique coordinates determines the step, so the texture matches the real
resolution of the data rather than an arbitrary constant.

**Gaps are filled with a distance-weighted neighbour average** — four passes,
orthogonal neighbours weighted `1`, diagonals `1/√2`. Nearest-neighbour copying
instead leaves a visible seam where two filled regions meet, which reads on
screen as the flow discontinuously jumping between vectors.

Generated textures are capped at 512 px on the longest edge
(`MAX_TEXTURE_SIZE`).

## Direction convention

Meteorological data reports the bearing the flow originates **from**. Ocean
current and drift data conventionally report the bearing of travel.

```tsx
directionConvention: 'from'      // default; particles travel the reciprocal bearing
directionConvention: 'towards'   // the value is the direction of travel
```

An inverted flow field is almost always this prop. The
[composition examples](/docs/composition) render both conventions against
identical data.

## Configuration

| Prop | Type | Default | Behaviour |
| --- | --- | --- | --- |
| `data` | `WindParticleData \| null` | — | `null` renders nothing |
| `id` | `string` | `'gcl-wind-particles'` | deck.gl layer identifier; must be unique |
| `visible` | `boolean` | `true` | Stops rendering without unmounting |
| `particleCount` | `number` | `2500` | Total particles; the dominant cost |
| `maxAge` | `number` | `45` | Trail length in frames |
| `speedFactor` | `number` | `6` | Advection speed multiplier |
| `width` | `number` | `1.4` | Particle stroke width in pixels |
| `opacity` | `number` | `0.9` | Layer opacity |
| `maxSpeed` | `number` | `60` | Full-scale speed; higher magnitudes are clamped without rotating the vector |
| `color` | `[r, g, b, a]` | — | A single colour for every particle; overrides `colors` |
| `colors` | `string[]` | — | Ramp applied by reconstructed speed |
| `palette` | `string \| Array<[number, string]>` | — | Explicit value/colour stops |
| `imageInterpolation` | WeatherLayers enum | `CUBIC` | `NEAREST` is point-exact but visibly stepped |
| `imageSmoothing` | `number` | `0.6` | Additional pre-blur, in cells |
| `transitionMs` | `number` | `900` | Cross-fade duration when the field changes; `0` disables |
| `maxZoom` | `number \| null` | `null` | Stops drawing above this zoom |
| `beforeId` | `string` | — | Inserts deck's draw call below a MapLibre style layer |
| `interleaved` | `boolean` | `true` | Draws inside the MapLibre render pass |
| `onError` | `(error: Error) => void` | — | Field construction failure |

## Temporal transitions

When the field changes, the previous and current textures are blended on the GPU
over `transitionMs`. Particles retain their positions and trails **through** a
timeline step rather than restarting, which is what makes sequential playback
read as continuous motion.

```tsx
<WindParticleLayer data={fields[index]} transitionMs={1200} />
```

Blending is applied only when consecutive grids have **identical dimensions**;
otherwise the two would be sampled at mismatched cells, and the new field
replaces the previous one outright.

The fade is driven by a `requestAnimationFrame` loop with smoothstep easing that
**terminates once the blend completes**, so the steady state costs nothing per
frame. Particle advection itself is GPU-resident regardless.

## Sharing a deck.gl instance

```tsx
import { DeckOverlay } from '@hridayanp/deck-overlay';

<DeckOverlay>
  <WindParticleLayer id="surface" data={surface} />
  <WindParticleLayer id="upper"   data={upper} />
</DeckOverlay>
```

Without the wrapper each layer provisions its own `MapboxOverlay` — a separate
deck.gl instance, animation loop and picking pass. See
[`deck-overlay`](/docs/deck-overlay).

## The layer hook

```tsx
import { useWindParticleLayers } from '@hridayanp/wind-particle-layer';

const layers = useWindParticleLayers({ data, particleCount, colors });
// deck.gl Layer[], for an application that manages its own deck instance
```

## Field construction utilities

```ts
import {
  extractWindVectors,   // GeoJSON → WindVector[] { lon, lat, speed, direction, u, v }
  pointsToTexture,      // scattered vectors → WindTextureSource
  fieldToTexture,       // u/v grid → WindTextureSource
  encodeUVTexture,      // raw component arrays → WindTextureSource
  featureToWindVector,  // a single feature → WindVector | null
  MAX_TEXTURE_SIZE,
  DEFAULT_MAX_SPEED,
  DEFAULT_PARTICLE_CONFIG,
} from '@hridayanp/wind-particle-layer';
```

`WindTextureSource` is `{ url, bounds, imageUnscale, key }` — the exact shape the
`kind: 'image'` input accepts, so a field encoded in a worker can be handed
straight back to the layer.

## Performance considerations

- `particleCount` dominates. 2,000–3,000 reads well at continental scale; beyond
  roughly 10,000 the field becomes visually saturated before it becomes slow.
- `maxAge` multiplies trail geometry and is the second cost after particle
  count.
- Generated textures are capped at 512 px per edge, bounding both upload cost
  and GPU memory.
- `interleaved={false}` avoids a class of WebGL state interaction at the cost of
  draw-order control.

## Geospatial considerations

- **WebGL2 is required.** There is no software fallback.
- `bounds` is EPSG:4326 `[west, south, east, north]` and describes the grid's
  outer edges. No reprojection is performed.
- 8-bit UV encoding gives a quantisation step of `2 × maxSpeed / 255` —
  approximately 0.47 units at the default scale. Reduce `maxSpeed` to the actual
  data range to recover precision.
- Particles are clipped to ±85.05° latitude, the Web Mercator limit; without the
  clip they wrap past the poles and smear across the top and bottom of the
  viewport.
- `u` and `v` are grid-relative eastward and northward components. Fields
  supplied in a rotated or projected frame must be rotated to geographic
  components upstream.
