Ten properties the library's correctness depends on. Each has a specific failure
mode, and most fail **silently** — no build diagnostic, no exception, only
incorrect output.

## 1. Shared runtimes remain peer dependencies

React, MapLibre GL, deck.gl and WeatherLayers GL are declared in
`peerDependencies` in every package that uses them, never in `dependencies`.

**Failure mode.** Two React instances invalidate hooks. Two MapLibre instances
cause `map instanceof Map` to fail across the boundary, so layers never attach.
Two `@deck.gl/core` instances produce layers deck refuses to render.

**Silent.** The build succeeds in every case.

## 2. `tsup`'s `external` enumerates every peer and workspace dependency

```ts
external: ['react', 'maplibre-gl', '@hridayanp/geo-utils', '@hridayanp/map-container']
```

**Failure mode.** An omitted entry inlines that module into the bundle,
producing invariant 1's failure in a consumer's application while operating
correctly within this repository.

## 3. Extents are `[west, south, east, north]`

Universally, matching MapLibre, deck.gl and the GeoJSON `bbox` member.

**Failure mode.** Rasters and geometry are placed incorrectly, or outside the
viewport entirely. Usually obvious; occasionally not — a near-square extent
transposes without appearing absurd.

## 4. Raster rows run north-first, and `bounds` describes image edges

Index `0` is the **top-left** cell, matching image space and GeoTIFF row
ordering. `bounds` describes the image edges, not the centres of the outer
cells.

**Failure mode.** A south-first grid renders vertically mirrored. Confusing
edges with centres offsets the raster by half a cell — visible on a coarse grid,
and a subtle misregistration on a fine one that can persist unnoticed.

## 5. Effects that touch the map depend on `styleVersion`

```tsx
useEffect(() => { … }, [map, ready, styleVersion]);
```

MapLibre discards **every** source and style layer when `setStyle` is called.
`styleVersion` increments on `styledata`, so listing it re-registers everything
automatically.

**Failure mode.** Every layer disappears the first time a user changes the
basemap, and only then.

## 6. Style layers are removed before their source

MapLibre refuses to remove a source that style layers still reference.

```ts
for (const id of layerIds) if (map.getLayer(id)) map.removeLayer(id);
if (map.getSource(sourceId)) map.removeSource(sourceId);
```

**Failure mode.** An exception during teardown leaves the source orphaned, and
the next mount fails with "source already exists".

## 7. The double-buffer flip waits two animation frames

```ts
requestAnimationFrame(() => requestAnimationFrame(() => flip()));
```

The first frame allows React to commit the new image source; the second allows
MapLibre to complete the texture upload.

**Failure mode.** Inverting earlier exposes an unpopulated buffer — precisely
the discontinuity the mechanism exists to remove. Paired with
`'raster-fade-duration': 0`, which disables MapLibre's own cross-fade; leaving
it enabled causes the two mechanisms to compete.

## 8. UV texture alpha is exactly 255

WeatherLayers treats any alpha below 255 as absent data.

**Failure mode.** Particles vanish over regions with partial alpha.
Anti-aliasing or a premultiplied-alpha step in an external encoding pipeline is
the usual cause, and the result reads as "the field has gaps" rather than "the
encoding is incorrect".

## 9. Interpolate values, then apply colour

Bilinear interpolation operates on **raw band values**, before the colour ramp,
which is applied through a 256-entry lookup table.

**Failure mode.** Colourising first and blurring afterwards produces a soft
mosaic rather than a gradient, because colour was assigned before the blur.
Invoking a colour library per pixel rather than using the lookup table is the
largest single cost in the render path.

## 10. Temporal sequences declare explicit `min` and `max`

Without them, each frame is normalised against its own value range.

**Failure mode.** A low-magnitude frame consumes the full ramp, so the sequence
appears to pulse and colour means something different in every frame. Correct
for a single static view; invalidating for an animation.

---

## Additional load-bearing properties

**Overlay containers declare `pointer-events: none`.** Only the controls within
them opt back in. Otherwise a full-size overlay absorbs every drag event and the
map becomes unpannable.

**Floating interface elements portal to `document.body`.** A tooltip or popover
rendered inside the map is clipped by the first ancestor declaring
`overflow: hidden`, and map containers essentially always have one.

**The hit sub-layer uses `circle-opacity: 0.00001`, not `0`.** MapLibre excludes
fully transparent geometry from hit testing, so the target must be nominally
visible while remaining imperceptible.

**Protocol registration is idempotent.** MapLibre throws when a protocol is
registered twice, and React Strict Mode invokes effects twice in development.

**Event handlers are held in a ref.** Passing an inline arrow function to
`onMouseMove` must not re-subscribe the MapLibre listener on every render; at
pointer-event rate the difference is material.

**Vite source aliases are anchored `^…$`.** Unanchored,
`@hridayanp/map-container` also matches `@hridayanp/map-controls`, and
`@hridayanp/ui` captures `@hridayanp/ui/styles.css`.

**Turborepo input globs cover every file affecting output.** The applications
keep stories in `stories/`, configuration in `.storybook/` and scripts in
`scripts/`, none matched by `src/**`. An omitted glob produces a cache hit on
stale output.

**Data retrieval, authorisation and application state remain with the host.**
The library renders what it is given. This is the property the entire
architecture depends on — see [Design Principles](/docs/principles).
