# @hridayanp/wind-particle-layer

GPU-accelerated animated flow particles for any vector field — wind, currents,
drift — built on deck.gl and WeatherLayers GL.

## Installation

```bash
npm install @hridayanp/wind-particle-layer @hridayanp/map-container maplibre-gl weatherlayers-gl \
  @deck.gl/core @deck.gl/mapbox @deck.gl/extensions @deck.gl/layers react
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

```tsx
// 1. A velocity grid — the canonical form
data={{ kind: 'field', u, v, width, height, bounds, noData }}

// 2. Scattered observations carrying speed and direction
data={{ kind: 'points', data: geojson, directionConvention: 'from', frameKey: timestamp }}

// 3. A UV-encoded PNG your pipeline already produced
data={{ kind: 'image', url, bounds, imageUnscale: [-60, 60] }}
```

For scattered input the layer rasterises onto a grid inferred from the points'
**own spacing**, then fills gaps with a **distance-weighted average of
neighbours**. A hard copy of the nearest cell leaves a visible seam where two
filled patches meet, which reads on screen as the flow "jumping" — the weighted
fill is what makes it read as one continuous field.

## How it works

Velocities are packed into an RGBA texture (red = eastward, green = northward,
alpha = data present) and uploaded once. From then on the GPU advects every
particle and reconstructs its speed as `sqrt(u² + v²)` to sample the colour
ramp. The CPU does nothing per frame — which is why 5,000 particles animate as
cheaply as 500.

## Direction convention

Meteorological data reports where wind comes **from**; that is the default
(`'from'`). Pass `directionConvention: 'towards'` for data that reports the
direction of travel. If your particles flow backwards, this is the first prop
to check.

## Props

| Prop | Default | Notes |
| --- | --- | --- |
| `data` | — | `null` renders nothing |
| `particleCount` | `2500` | The dominant cost |
| `maxAge` | `45` | Trail length in frames |
| `speedFactor` | `6` | Speed multiplier |
| `width` | `1.4` | Stroke width in pixels |
| `opacity` | `0.9` | |
| `maxSpeed` | `60` | Full-scale speed; faster values are clamped **without rotating the vector** |
| `color` | — | A single `[r, g, b, a]` tuple; overrides `colors` |
| `colors` | — | Ramp applied by reconstructed speed |
| `palette` | — | Explicit `[value, colour]` stops |
| `imageInterpolation` | `CUBIC` | `NEAREST` gives point-exact but stepped motion |
| `imageSmoothing` | `0.6` | Extra pre-blur, in cells |
| `transitionMs` | `900` | Cross-fade when the field changes |
| `maxZoom` | `null` | Stop drawing above this zoom |
| `visible` | `true` | |

## Transitions

When the field changes, the old and new textures are blended on the GPU over
`transitionMs`. Particles keep their positions and trails through a timeline
step instead of restarting — which is what makes playback look continuous rather
than stuttery.

Blending only applies when consecutive grids have identical dimensions;
otherwise the new field replaces the old outright, because the two would
otherwise be sampled at mismatched cells.

## Performance

- `particleCount` dominates. 2,000–3,000 reads well at continental scale; past
  ~10,000 the field becomes visual noise before it becomes slow.
- `maxAge` multiplies trail geometry — long trails on many particles are the
  second cost.
- Generated textures are capped at 512px on their longest edge.

## Limitations

- Requires WebGL2. There is no canvas fallback.
- 8-bit UV encoding gives a quantisation step of `2 × maxSpeed / 255`.

## Documentation

Interactive examples for every prop live in the workspace Storybook:

```bash
npm run storybook
```

## License

MIT
