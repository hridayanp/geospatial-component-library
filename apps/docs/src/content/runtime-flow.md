What actually happens, in order, from mount through a timeline step to a basemap
swap.

## The composition

```tsx
<MapContainer center={[92, 25.5]} zoom={6}>
  <RasterLayer data={raster} colorScale={palette} min={0} max={100} frameKey={ts} />
  <VectorLayer data={boundaries} fill={false} stroke="#94a3b8" />
  <WindParticleLayer data={{ kind: 'field', u, v, width, height, bounds }} />
  <GeoLegend colorScale={palette} min={0} max={100} placement="bottom-right" />
  <GeoHover raster={raster} unit="mm" />
</MapContainer>
```

## Mount

**1. `MapContainer` renders.** It builds a specific DOM structure:

```tsx
<div style={{ position: 'relative' }}>        {/* React owns */}
  <div ref={containerRef} />                   {/* MapLibre owns — React NEVER touches its children */}
  <MapContext.Provider>
    <div style={{ pointerEvents: 'none' }}>    {/* overlay layer */}
      {children}
    </div>
  </MapContext.Provider>
</div>
```

Two siblings, not one node. If children rendered into the node MapLibre owns,
React's reconciler and MapLibre's canvas management would fight over
`childNodes`.

The overlay is `pointer-events: none` so the map stays draggable through the
gaps between panels; each `Panel` opts its own subtree back in.

**2. The map instance is created** and listeners are attached. Context is
`{ map, ready: false, styleVersion: 0 }`. Children render immediately but every
layer effect short-circuits on `ready`.

**3. The style loads.** `load` fires → `ready: true`, `styleVersion: 1`. Every
layer's effect dependency array changes, so they all attach now — in mount
order, which is draw order.

**4. `RasterLayer`** calls `useRasterImage`. Cache miss, so it colourises the
array into a PNG data URL, writes it to buffer A, and mounts an image source
plus a raster layer.

**5. `VectorLayer`** memoises the FeatureCollection, builds up to five
sub-layer specs, and adds one GeoJSON source with four layers.

**6. `WindParticleLayer`** encodes a UV texture, awaits
`WeatherLayers.loadTextureData`, constructs a `ParticleLayer`, and registers it
through `useDeckLayers`. There is no `<DeckOverlay>` host here, so the hook
creates its own `MapboxOverlay` and calls `map.addControl`.

**7. `GeoLegend`** renders a `Panel` into the overlay div. It never touches the
map.

**8. `GeoHover`** subscribes to `mousemove` on the map. Each move samples the
raster array and sets local state.

## A timeline step

`frameKey` changes. What happens:

- `useRasterImage` bumps an internal request id, which **cancels** any in-flight
  decode. It checks the cache; on a hit the frame is available synchronously.
- `RasterLayer` writes the frame to the **inactive** buffer, waits two animation
  frames, then flips which buffer is opaque. **No flash.**
- `useMapSourceLayers` sees the same source type and the same layer ids, so it
  calls `updateImage()` **in place** rather than removing and re-adding.
  **No remount, no texture churn.**
- `GeoHover` receives the new raster through props, so hover values track the
  frame on screen.

### Why the request id matters

Without it, scrubbing fast means a slow frame N can resolve *after* frame N+3
has already rendered, and overwrite it. The map then appears to lag or jump
backwards — a bug that is very hard to reproduce deliberately and very easy to
ship.

```ts
const id = ++requestId.current;
// … await decode …
if (cancelled || requestId.current !== id) return;   // superseded
```

### Why two animation frames

Frame one lets React commit the new image source. Frame two lets MapLibre finish
uploading the texture to the GPU. Flip any sooner and you see a blank buffer.

Combined with `'raster-fade-duration': 0` — which disables MapLibre's own 300 ms
cross-fade, since it fights the manual swap — the result is a hard, flash-free
cut between frames.

## A basemap swap

```tsx
<MapContainer mapStyle={nextStyle}>
```

MapLibre's `setStyle()` **discards every source and layer that was added on top
of the style.** Left alone, all your data would silently disappear.

The recovery is a single number in context:

```ts
map.on('styledata', () => setStyleVersion(v => v + 1));
```

Every layer's structural effect lists `styleVersion` in its dependencies, so all
of them re-attach on the next tick. Automatic, for every layer package in the
library.

> **Warning:** Anything you add to the map by hand — your own source, your own
> layer — has to do the same. Subscribe to `styledata` or use
> `useMapSourceLayers`, which handles it for you.

## Inside `useMapSourceLayers`

This is the hook every layer uses, and where most of the subtlety lives. It
splits into four effects with deliberately different dependency sets:

| Effect | Dependencies | What it does |
| --- | --- | --- |
| Structural | `map, ready, styleVersion, sourceId, sourceType, layerIdsKey, beforeId` | `addSource` + `addLayer`; teardown removes **layers before source** |
| Source data | `source` | `setData` for GeoJSON, `updateImage` for images — in place |
| Style | `layers` | `setPaintProperty` / `setLayoutProperty` / `setFilter` / `setLayerZoomRange`, per changed key |
| Draw order | `beforeId, styleVersion` | `moveLayer` |

A full remove-and-re-add happens **only** when the source *type* or the *set of
layer ids* changes. Changing a fill colour, a filter, or the GeoJSON payload
never touches the layer's lifecycle.

The teardown order is not optional: MapLibre refuses to remove a source that a
layer still references.

`applyLayerDiff` compares paint and layout objects key by key, falling back to
`JSON.stringify` for expression values — which are arrays, so `===` would report
every render as a change.

## Event handling

Handlers live in a ref:

```tsx
handlers.current = { onLoad, onMove, onMouseMove, … };
```

Passing an inline arrow to `onMouseMove` would otherwise re-subscribe the
MapLibre listener on every render. For a handler that fires at pointer rate,
that is the difference between smooth and unusable.

## Controlled camera

```tsx
if (Math.abs(current.lng - center[0]) < 1e-6) return;
```

Sub-pixel differences are ignored. Without this guard a controlled `center` prop
fights the user's own panning: they drag, the prop hasn't updated yet, and the
map snaps back mid-gesture.

## Resize

A `ResizeObserver` watches the container. MapLibre only listens for **window**
resizes, so a map inside a collapsible panel, a split pane or a tab would
otherwise stay the wrong size indefinitely.
