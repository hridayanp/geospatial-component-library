## Purpose

`deck-overlay` is the interoperability layer between deck.gl and a MapLibre map
managed by [`map-container`](/docs/map-container). It provisions one
`MapboxOverlay`, collects deck.gl layers contributed by descendant components,
and composites them into the map's render pass.

```bash
npm install @hridayanp/deck-overlay @hridayanp/map-container \
  maplibre-gl @deck.gl/core @deck.gl/mapbox react
```

## Why it is a separate package

It is the only module in the library that references deck.gl.

Isolating it means a raster or vector layer never introduces a second WebGL
rendering engine into a bundle that has no use for one. An application rendering
only GeoJSON installs `vector-layer` and acquires MapLibre; it does not acquire
deck.gl transitively.

This applies the dependency rule from [Design Principles](/docs/principles)
literally: a heavy runtime lives behind the narrowest package boundary that can
contain it.

## Responsibilities

| Concern | Owner |
| --- | --- |
| `MapboxOverlay` lifecycle and map registration | `DeckOverlay` |
| Layer collection, ordering and deregistration | `DeckOverlay`, via `useDeckLayers` |
| Interleaving and draw-order placement | `DeckOverlay` |
| deck.gl layer construction and its data | The contributing component |
| Picking semantics and event handling | The contributing component |

## Usage

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

## Why a single overlay matters

Each `MapboxOverlay` is a **separate deck.gl instance** — its own WebGL context
bindings, its own animation loop, and its own picking pass on every pointer
event. Three deck-based layers without a shared host means three of each,
running concurrently against the same canvas.

The observable consequences are reduced frame rate and non-deterministic draw
order between overlays, because nothing coordinates which instance renders
first.

A map with three deck-based layers should therefore contain exactly one
`<DeckOverlay>`.

## The wrapper is optional

`useDeckLayers` falls back to a private overlay when no host is present:

```tsx
{/* one layer, one implicit overlay — correct */}
<MapContainer center={[92, 25.5]} zoom={5}>
  <WindParticleLayer data={field} />
</MapContainer>
```

A single deck-based layer dropped into a `MapContainer` operates correctly. The
wrapper becomes necessary at two or more.

## Contributing layers

```tsx
import { useDeckLayers } from '@hridayanp/deck-overlay';
import { ScatterplotLayer } from '@deck.gl/layers';

function Observations({ data }: { data: Observation[] }) {
  const layers = useMemo(
    () => [
      new ScatterplotLayer({
        id: 'observations',
        data,
        getPosition: (d: Observation) => d.position,   // [lng, lat], EPSG:4326
        getRadius: 400,                                // metres
        radiusUnits: 'meters',
        getFillColor: [56, 189, 248, 200],
      }),
    ],
    [data],
  );

  useDeckLayers('observations', layers);
  return null;
}
```

The first argument is a **stable registration key**. Layers registered under the
same key replace one another; layers under distinct keys are concatenated in
registration order. The key is how the overlay identifies which layers to remove
when a component unmounts.

`DeckLayer` is typed `Layer | null | undefined | false`, so conditional layers
may be expressed inline without filtering.

> **Note:** Construct deck.gl layers inside a `useMemo`. deck.gl reconciles by
> layer `id`, but a new array identity on each render still forces a diff pass —
> negligible for two layers, measurable for twenty.

## Draw order

Within one overlay, layers draw in registration order: later keys composite
above earlier ones.

To position deck's output relative to **MapLibre** style layers, use `beforeId`:

```tsx
<DeckOverlay beforeId="basemap-labels">
```

deck's entire draw call is inserted below that style layer, so basemap labels
remain legible above animated data. Without it, deck composites above everything
MapLibre rendered.

## Interleaving

```tsx
<DeckOverlay interleaved={true} />   // default
<DeckOverlay interleaved={false} />
```

`interleaved: true` draws deck.gl **inside** the MapLibre render pass. Depth
testing operates against MapLibre geometry, `beforeId` is meaningful, and
extruded or terrain-aware content sorts correctly.

`interleaved: false` composites deck onto a separate canvas above the map. It is
marginally faster and avoids a class of WebGL state interaction, but deck output
is then **always** drawn above everything and `beforeId` has no effect.

Retain the default. Change it only in response to an observed state-conflict
defect, accepting the loss of draw-order control.

## Configuration

| Prop | Type | Default | Behaviour |
| --- | --- | --- | --- |
| `interleaved` | `boolean` | `true` | See above |
| `beforeId` | `string` | — | Inserts the deck draw call below this style layer |
| `layers` | `DeckLayer[]` | — | Layers contributed directly, in addition to those registered by children |
| `children` | `ReactNode` | — | Components that register layers |

## Integration boundaries and requirements

- **WebGL2.** deck.gl 9 requires it; there is no fallback path.
- The overlay must be a descendant of `MapContainer`; it resolves the map from
  context.
- deck.gl core packages are **peer** dependencies. Two resolutions of
  `@deck.gl/core` in one bundle produce layers that fail an internal
  `instanceof` check and are silently not rendered.
- deck.gl positions are geographic WGS84 `[longitude, latitude]`, matching the
  rest of the library. Radius and elevation units are per-layer deck.gl
  configuration (`radiusUnits`, `widthUnits`) and are not normalised here.
