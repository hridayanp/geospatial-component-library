The ordered lifecycle of a composed map: initial mount, a temporal frame
transition, and a basemap style reload.

## Reference composition

```tsx
<MapContainer center={[92, 25.5]} zoom={6}>
  <RasterLayer data={raster} colorScale={palette} min={0} max={100} frameKey={ts} />
  <VectorLayer data={boundaries} fill={false} stroke="#94a3b8" />
  <WindParticleLayer data={{ kind: 'field', u, v, width, height, bounds }} />
  <GeoLegend colorScale={palette} min={0} max={100} placement="bottom-right" />
  <GeoHover raster={raster} unit="mm" />
</MapContainer>
```

## Mount sequence

**1. `MapContainer` renders its DOM structure.**

```tsx
<div style={{ position: 'relative' }}>        {/* React-owned */}
  <div ref={containerRef} />                   {/* MapLibre-owned; React never reconciles its children */}
  <MapContext.Provider>
    <div style={{ pointerEvents: 'none' }}>    {/* overlay layer */}
      {children}
    </div>
  </MapContext.Provider>
</div>
```

Two siblings rather than one node. If children rendered into the element
MapLibre owns, React's reconciler and MapLibre's canvas management would both
mutate the same `childNodes` collection.

The overlay layer declares `pointer-events: none` so that map panning remains
available between panels; each `Panel` re-enables pointer interaction for its
own subtree.

**2. The map instance is constructed** and event listeners are attached. Context
is `{ map, ready: false, styleVersion: 0 }`. Children render immediately, but
every layer effect short-circuits on `ready`.

**3. The style loads.** The `load` event transitions context to
`{ ready: true, styleVersion: 1 }`. Every layer's effect dependency array
changes, so all layers attach at this point — in mount order, which is draw
order.

**4. `RasterLayer`** invokes `useRasterImage`. On a cache miss the band is
colourised to a PNG data URL, written into buffer A, and registered as a
MapLibre `image` source with an accompanying `raster` style layer.

**5. `VectorLayer`** normalises its input to a FeatureCollection, derives up to
five sub-layer specifications, and registers one `geojson` source with the
corresponding style layers.

**6. `WindParticleLayer`** encodes a UV texture, awaits
`WeatherLayers.loadTextureData`, constructs a `ParticleLayer`, and registers it
through `useDeckLayers`. With no `<DeckOverlay>` host present, the hook
provisions its own `MapboxOverlay` and calls `map.addControl`.

**7. `GeoLegend`** renders a `Panel` into the overlay layer. It performs no map
interaction.

**8. `GeoHover`** subscribes to the map's `mousemove` event. Each event samples
the raster array and updates local component state.

## Temporal frame transition

`frameKey` changes. The resulting sequence:

- `useRasterImage` increments an internal request identifier, **invalidating**
  any in-flight decode. It consults the frame cache; on a hit the colourised
  frame is available synchronously.
- `RasterLayer` writes the frame into the **inactive** image source, waits two
  animation frames, and then inverts which source is opaque. The transition
  produces no visible discontinuity.
- `useMapSourceLayers` observes an unchanged source type and an unchanged set of
  layer identifiers, and therefore calls `updateImage()` **in place** rather
  than removing and re-adding. No layer remount and no texture reallocation
  occur.
- `GeoHover` receives the new raster through props, so probed values remain
  consistent with the rendered frame.

### Request-identifier invalidation

Without it, rapid scrubbing allows a slow decode of frame *N* to resolve after
frame *N+3* has already rendered, overwriting it. The rendered frame then lags
or regresses relative to the scrubber — a defect that is difficult to reproduce
deliberately and straightforward to ship.

```ts
const id = ++requestId.current;
// … await decode …
if (cancelled || requestId.current !== id) return;   // superseded
```

### Two-frame buffer flip

The first animation frame allows React to commit the new image source. The
second allows MapLibre to complete the texture upload. Inverting the buffers
earlier exposes an unpopulated source.

Combined with `'raster-fade-duration': 0` — which disables MapLibre's own 300 ms
raster cross-fade, since it competes with the manual swap — the result is a hard
cut between frames with no intermediate blend.

## Basemap style reload

```tsx
<MapContainer mapStyle={nextStyle}>
```

MapLibre's `setStyle()` **discards every source and style layer added on top of
the previous style.** Without recovery, all application data would be removed
from the map.

The recovery mechanism is a monotonic counter in context:

```ts
map.on('styledata', () => setStyleVersion(v => v + 1));
```

Every layer's structural effect lists `styleVersion` among its dependencies, so
all layers re-register on the following tick. This is automatic for every layer
package in the library.

> **Warning:** Sources and layers added directly by the host application must
> implement the same recovery — either by subscribing to `styledata` or by
> using `useMapSourceLayers`, which handles it.

## Inside `useMapSourceLayers`

This hook backs every layer package and concentrates most of the lifecycle
subtlety. It is decomposed into four effects with deliberately distinct
dependency sets:

| Effect | Dependencies | Behaviour |
| --- | --- | --- |
| Structural | `map, ready, styleVersion, sourceId, sourceType, layerIdsKey, beforeId` | `addSource` and `addLayer`; teardown removes **layers before the source** |
| Source data | `source` | `setData` for GeoJSON sources, `updateImage` for image sources — applied in place |
| Style | `layers` | `setPaintProperty`, `setLayoutProperty`, `setFilter`, `setLayerZoomRange`, per changed key |
| Draw order | `beforeId, styleVersion` | `moveLayer` |

A full remove-and-re-add occurs **only** when the source *type* or the *set of
layer identifiers* changes. Changing a fill colour, a filter expression or the
GeoJSON payload never affects the layer lifecycle.

Teardown ordering is a MapLibre requirement: a source cannot be removed while a
layer still references it.

`applyLayerDiff` compares paint and layout objects key by key, falling back to
structural comparison for expression values — which are arrays, so reference
equality would report a change on every render.

## Event subscription

Handlers are held in a ref:

```tsx
handlers.current = { onLoad, onMove, onMouseMove, … };
```

Passing an inline arrow function to `onMouseMove` would otherwise re-subscribe
the MapLibre listener on every render. For a handler invoked at pointer-event
rate, the difference is material.

## Controlled view state

```ts
if (Math.abs(current.lng - center[0]) < 1e-6) return;
```

Sub-pixel differences are ignored. Without this guard, a controlled `center`
prop competes with user panning: the gesture updates the camera, the prop has
not yet been reconciled, and the map snaps back mid-interaction.

## Container resize

A `ResizeObserver` monitors the container element. MapLibre observes **window**
resize only, so a map inside a collapsible panel, a split pane or a tab would
otherwise retain a stale canvas size indefinitely.
