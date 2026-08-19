Ten decisions the rest of the library is built on. Each one has a specific
failure mode when broken, and most of those failures are silent — no build error,
no exception, just a map that looks wrong.

## 1. Peer dependencies stay peers

React, MapLibre, deck.gl and WeatherLayers are `peerDependencies` in every
package that uses them. Never `dependencies`.

**Breaks:** hooks throw "invalid hook call" with two Reacts; `map instanceof Map`
fails across the boundary with two MapLibres, so layers never attach; deck
refuses to render layers built by a different `@deck.gl/core`.

**Silent?** Completely. The build succeeds.

## 2. `tsup`'s `external` lists every peer and every workspace dependency

```ts
external: ['react', 'maplibre-gl', '@hridayanp/geo-utils', '@hridayanp/map-container']
```

**Breaks:** a missing entry inlines that package into the bundle, which produces
invariant 1's failure in a consumer's app while working perfectly in this
repository.

## 3. Bounds are `[west, south, east, north]`

Everywhere. Matching MapLibre, deck.gl and GeoJSON `bbox`.

**Breaks:** rasters land in the wrong place, or off the map entirely. Usually
obvious, occasionally not — a near-square extent transposes without looking
absurd.

## 4. Raster rows run north-first

Index `0` is the **top-left** cell, matching image space and GeoTIFF row order.
`bounds` describe the image **edges**, not the outer pixel centres.

**Breaks:** north-first violated renders vertically mirrored. Edge/centre
confused offsets the raster by half a cell — which on a coarse grid is a visible
shift and on a fine one is a subtle misregistration nobody notices for months.

## 5. Effects that touch the map depend on `styleVersion`

```tsx
useEffect(() => { … }, [map, ready, styleVersion]);
```

MapLibre discards **every** source and layer when `setStyle` is called.
`styleVersion` increments on `styledata`, so listing it re-attaches everything
automatically.

**Breaks:** every layer disappears the first time a user changes the basemap, and
only then.

## 6. Layers are removed before their source

MapLibre refuses to remove a source that layers still reference.

```ts
for (const id of layerIds) if (map.getLayer(id)) map.removeLayer(id);
if (map.getSource(sourceId)) map.removeSource(sourceId);
```

**Breaks:** an exception during teardown leaves the source orphaned, and the next
mount fails with "source already exists".

## 7. The double-buffer flip waits two animation frames

```ts
requestAnimationFrame(() => requestAnimationFrame(() => flip()));
```

The first frame lets React commit the new image source; the second lets MapLibre
finish uploading the texture.

**Breaks:** flipping sooner shows an empty buffer — the exact blink the whole
mechanism exists to remove. Paired with `'raster-fade-duration': 0`, which
disables MapLibre's own cross-fade; leaving it on makes the two mechanisms fight.

## 8. UV texture alpha is a hard 255

WeatherLayers treats any alpha below 255 as missing data.

**Breaks:** particles vanish over regions with partial alpha. Anti-aliasing or a
premultiplied-alpha step in an external encoding pipeline is the usual cause, and
the result reads as "the data has holes" rather than "the encoding is wrong".

## 9. Interpolate values, then colourise — never the reverse

Bilinear interpolation runs on **raw numbers**, before the colour ramp, through a
256-entry LUT.

**Breaks:** colourising first and blurring after gives a soft mosaic instead of a
gradient, because the colour was locked in before the blur ran. Calling a colour
library per pixel instead of using the LUT is the single largest cost in the
render path.

## 10. Explicit `min`/`max` on animated rasters

Without them, each frame self-scales to its own range.

**Breaks:** a quiet frame uses the whole ramp, so the sequence appears to pulse
and the colours mean something different in every frame. Correct for a single
static view; misleading in an animation.

---

## Also load-bearing

**Overlay containers are `pointer-events: none`.** Only the controls inside them
opt back in. Otherwise a full-size overlay swallows every drag and the map
becomes unpannable.

**Floating UI portals to `document.body`.** A tooltip or popover rendered inside
the map is clipped by the first ancestor with `overflow: hidden` — and map
containers essentially always have one.

**The hit layer uses `circle-opacity: 0.00001`, not `0`.** MapLibre skips
hit-testing fully transparent geometry, so the target must be technically visible
and visually absent.

**Protocol registration is idempotent.** MapLibre throws when a protocol is
registered twice, and React Strict Mode runs effects twice in development.

**Handlers live in a ref.** Passing an inline arrow to `onMouseMove` must not
re-subscribe the MapLibre listener on every render; at pointer-move frequency
that is the difference between smooth and unusable.

**Vite source aliases are anchored `^…$`.** Unanchored, `@hridayanp/map-container`
also matches `@hridayanp/map-controls` and resolves the wrong package.

**No fetching, no auth, no application state.** The library renders what it is
given. This is the rule the entire architecture depends on — see
[Design Principles](/docs/principles).
