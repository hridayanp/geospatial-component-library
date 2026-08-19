# @hridayanp/map-container

A reusable MapLibre GL map, plus the React context and source/layer plumbing
every other `@hridayanp/*` layer package builds on.

## Installation

```bash
npm install @hridayanp/map-container maplibre-gl react react-dom
```


Optional peers, only if you use the matching protocol:

```bash
npm install pmtiles @geomatico/maplibre-cog-protocol
```

## What it owns, and what it does not

It owns the map instance, the camera, and a context that lets child layers
attach themselves. It knows nothing about what is drawn on it, where data comes
from, or what the map is *for* — which is what makes the same component usable
for a weather overlay, a logistics view and a coverage map.

## Usage

```tsx
import { MapContainer } from '@hridayanp/map-container';
import 'maplibre-gl/dist/maplibre-gl.css';

<MapContainer center={[92, 25.5]} zoom={6} style={{ height: 480 }}>
  {/* layers and overlays */}
</MapContainer>
```

## The default style makes no network request

`mapStyle` defaults to a blank background. Nothing is fetched unless you ask
for it — which keeps the component usable offline, in tests, and in
environments where an unexpected outbound request is a problem.

```ts
import { createRasterStyle, createBlankStyle, withPMTilesOutline } from '@hridayanp/map-container';

const style = createRasterStyle('https://tile.example.com/{z}/{x}/{y}.png', {
  attribution: '© Example',      // most providers' terms require this
});
```

## Props

| Prop | Type | Notes |
| --- | --- | --- |
| `mapStyle` | `StyleSpecification \| string` | Blank background by default |
| `center` / `zoom` / `bearing` / `pitch` | | Controlled camera; sub-pixel changes are ignored so a controlled centre does not fight the user's panning |
| `bounds` | `Bounds` | Fits an extent instead of a centre/zoom |
| `minZoom` / `maxZoom` / `maxBounds` | | Applied live |
| `interactive` | `boolean` | `false` disables every gesture handler |
| `projection` | `'mercator' \| 'globe'` | Applied defensively; ignored with a warning on MapLibre 4 |
| `preserveDrawingBuffer` | `boolean` | Passed in both the MapLibre 4 and 5 shapes |
| `onLoad` / `onMove` / `onMoveEnd` / `onClick` / `onMouseMove` / `onError` | | Handlers live in a ref, so an inline arrow never re-subscribes |

## Ref handle

```tsx
const ref = useRef<MapContainerHandle>(null);
ref.current?.fitBounds(bounds);
ref.current?.flyTo({ center, zoom, duration: 600 });
ref.current?.getMap();     // the raw MapLibre instance
```

## Building your own layer

`useMapSourceLayers` is the hook the library's own layers use. It adds a
source and its layers, then keeps them in sync **in place**:

- GeoJSON sources are updated with `setData`, image sources with `updateImage`;
- paint, layout, filter and zoom-range changes are applied as individual
  property updates;
- a full re-add happens only when the source type or the set of layer ids
  genuinely changes;
- teardown removes layers before the source, which MapLibre requires;
- everything re-attaches automatically after a basemap swap, because MapLibre
  discards all non-style sources and layers at that point.

```tsx
import { useMapSourceLayers, useMapLayerEvent } from '@hridayanp/map-container';

useMapSourceLayers({
  sourceId: 'my-source',
  source: { type: 'geojson', data },
  layers: [{ id: 'my-fill', type: 'fill', paint: { 'fill-color': '#38bdf8' } }],
  beforeId: 'labels',
});

useMapLayerEvent('my-fill', 'click', (event) => { /* ... */ });
```

## Resizing

A `ResizeObserver` watches the container. MapLibre only listens to window
resizes, so a map inside a collapsible panel or a split pane would otherwise
stay the wrong size.

## Optional protocols

```ts
import { registerPMTilesProtocol, registerCOGProtocol } from '@hridayanp/map-container';

await registerPMTilesProtocol();   // pmtiles:// sources
await registerCOGProtocol();       // cog:// sources
```

Both are idempotent — MapLibre throws when a protocol is registered twice, and
React Strict Mode runs effects more than once in development.

## Documentation

Interactive examples for every prop live in the workspace Storybook:

```bash
npm run storybook
```

## License

MIT
