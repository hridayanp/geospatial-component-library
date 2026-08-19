The bridge between deck.gl and a MapLibre map owned by
[`map-container`](/docs/map-container). One overlay, one deck instance, any
number of layers.

```bash
npm install @hridayanp/deck-overlay @hridayanp/map-container \
  maplibre-gl @deck.gl/core @deck.gl/mapbox react
```

## Why it is its own package

It is the **only** place in the library that knows deck.gl exists.

Keeping it separate means a raster layer or a vector layer never drags a WebGL
rendering engine into a bundle that has no use for one. An application that only
draws GeoJSON installs `vector-layer` and gets MapLibre; it does not get deck.gl
transitively.

This is the dependency-graph rule from [Design Principles](/docs/principles)
applied literally: heavy runtimes live behind the smallest possible package
boundary.

## Usage

Wrap deck-based layers so they share one instance:

```tsx
import { DeckOverlay } from '@hridayanp/deck-overlay';
import { WindParticleLayer } from '@hridayanp/wind-particle-layer';

<MapContainer center={[92, 25.5]} zoom={5}>
  <DeckOverlay>
    <WindParticleLayer id="surface" data={surface} />
    <WindParticleLayer id="upper"   data={upper} />
  </DeckOverlay>
</MapContainer>
```

## Why one overlay matters

Each `MapboxOverlay` is a **separate deck.gl instance** — its own WebGL context
bindings, its own animation loop, its own picking pass on every pointer move.
Three deck layers without a shared host means three of everything, running
concurrently, drawing to the same canvas.

The visible symptoms are a dropped frame rate and unpredictable draw order
between overlays, because nothing coordinates which instance renders first.

So: a map with three deck-based layers should have exactly **one**
`<DeckOverlay>`.

## It is optional

`useDeckLayers` falls back to a private overlay when no host is present:

```tsx
{/* works fine — one layer, one implicit overlay */}
<MapContainer>
  <WindParticleLayer data={field} />
</MapContainer>
```

Dropping a single deck-based layer into a `MapContainer` just works. The wrapper
only becomes necessary at two or more.

## Contributing your own layers

```tsx
import { useDeckLayers } from '@hridayanp/deck-overlay';
import { ScatterplotLayer } from '@deck.gl/layers';

function Points({ data }: { data: Point[] }) {
  const layers = useMemo(
    () => [
      new ScatterplotLayer({
        id: 'points',
        data,
        getPosition: (d: Point) => d.position,
        getRadius: 400,
        getFillColor: [56, 189, 248, 200],
      }),
    ],
    [data],
  );

  useDeckLayers('points', layers);
  return null;
}
```

The first argument is a **stable key**. Layers registered under the same key
replace each other; layers under different keys are concatenated in registration
order. That key is how the overlay knows which layers to drop when your component
unmounts.

> **Note:** Build your deck layers inside a `useMemo`. deck.gl reconciles by
> layer `id`, but a new array identity on every render still forces a diff pass
> — cheap for two layers, not free for twenty.

## Draw order

Within one overlay, layers draw in registration order: later keys on top. To
place deck's output relative to **MapLibre** layers, use `beforeId`:

```tsx
<DeckOverlay beforeId="basemap-labels">
```

deck's entire draw call is inserted below that MapLibre layer, so basemap labels
stay readable over animated data. Without it, deck draws above everything
MapLibre rendered.

## Interleaving

```tsx
<DeckOverlay interleaved={true} />   // default
<DeckOverlay interleaved={false} />
```

`interleaved: true` draws deck.gl **inside** the MapLibre render pass. Depth
testing works against MapLibre geometry, `beforeId` is meaningful, and 3D content
sorts correctly against extruded buildings or terrain.

`interleaved: false` composites deck on a separate canvas over the map. It is
slightly faster and avoids a class of WebGL state conflicts, but deck output is
then **always** drawn over everything — `beforeId` has no effect.

Start with the default. Switch only if you hit a state-conflict bug, and accept
losing draw-order control in exchange.

## Props

| Prop | Default | Notes |
| --- | --- | --- |
| `interleaved` | `true` | See above |
| `beforeId` | — | Insert the deck draw call below this MapLibre layer |
| `useDevicePixels` | deck default | `1` trades sharpness for fill rate on HiDPI |
| `pickingRadius` | `0` | Pixels of slop around the cursor |
| `onError` | — | deck.gl errors; otherwise logged |
| `children` | — | Deck-based layer components |

## Requirements and limits

- **WebGL2.** deck.gl 9 requires it; there is no fallback path.
- The overlay must be inside a `MapContainer` — it attaches to the map from
  context.
- deck.gl core packages are **peer** dependencies. That is deliberate: two copies
  of `@deck.gl/core` in one bundle produce layers that fail an `instanceof` check
  inside deck and silently never render.
