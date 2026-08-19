# @hridayanp/deck-overlay

Bridges deck.gl layers onto a MapLibre map managed by `@hridayanp/map-container`.

## Installation

```bash
npm install @hridayanp/deck-overlay @hridayanp/map-container maplibre-gl @deck.gl/core @deck.gl/mapbox react
```


## Why it is its own package

It is the only place in the library that knows about deck.gl. Keeping it
separate means a raster or vector layer never drags a WebGL rendering engine
into a bundle that has no use for one.

## Usage

Wrap deck-based layers so they share a single deck.gl instance:

```tsx
import { DeckOverlay } from '@hridayanp/deck-overlay';

<MapContainer>
  <DeckOverlay>
    <WindParticleLayer id="surface" data={surface} />
    <WindParticleLayer id="upper" data={upper} />
  </DeckOverlay>
</MapContainer>
```

Each additional overlay is a separate deck.gl instance with its own animation
loop and picking pass, so a map with three deck layers should still have exactly
one overlay.

Using it is **optional**: `useDeckLayers` falls back to a private overlay when
no host is present, so a single deck-based layer still works dropped straight
into a `<MapContainer>`.

## Contributing your own layers

```tsx
import { useDeckLayers } from '@hridayanp/deck-overlay';

useDeckLayers('my-layer', [new ScatterplotLayer({ /* ... */ })]);
```

## Interleaving

`interleaved` (default `true`) draws deck.gl *inside* the MapLibre render pass,
so basemap labels can sit above data and depth testing works. Set `false` to
composite deck on top — faster, but always drawn over everything.

## Documentation

Interactive examples for every prop live in the workspace Storybook:

```bash
npm run storybook
```

## License

MIT
