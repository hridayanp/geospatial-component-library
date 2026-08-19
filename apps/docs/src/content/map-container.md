The composition root. It owns a MapLibre instance, the camera, and a React
context that every other layer package attaches to.

```bash
npm install @hridayanp/map-container maplibre-gl react react-dom
```

## What it owns, and what it does not

It owns the map, the camera and the context. It knows nothing about what is
drawn on it, where data comes from, or what the map is *for* — which is what
makes the same component usable for a weather overlay, a logistics view and a
coverage map.

## Basic usage

```tsx
import { MapContainer } from '@hridayanp/map-container';
import 'maplibre-gl/dist/maplibre-gl.css';

<div style={{ height: 520 }}>
  <MapContainer center={[92, 25.5]} zoom={6}>
    {/* layers and overlays */}
  </MapContainer>
</div>
```

The component fills its parent, so give it a sized box.

## The default style makes no network request

`mapStyle` defaults to a blank background. Nothing is fetched unless you ask for
it, which keeps the component usable offline, in tests, and in environments
where an unexpected outbound request is a problem.

```ts
import {
  createBlankStyle,
  createRasterStyle,
  withPMTilesOutline,
} from '@hridayanp/map-container';

// Background only — zero requests
createBlankStyle('#0b1220');

// A raster basemap. Attribution is an option because most providers require it.
const style = createRasterStyle('https://tile.example.com/{z}/{x}/{y}.png', {
  attribution: '© Example',
  maxzoom: 19,
});

// Add a PMTiles boundary overlay to an existing style
withPMTilesOutline(style, {
  url: 'https://example.com/boundaries.pmtiles',
  sourceLayer: 'admin',
  color: '#94a3b8',
});
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `mapStyle` | `StyleSpecification \| string` | blank | See above |
| `center` | `[lng, lat]` | `[0, 0]` | Controlled; sub-pixel changes ignored |
| `zoom` | `number` | `1` | Controlled |
| `bearing` / `pitch` | `number` | `0` | Controlled |
| `bounds` | `Bounds` | — | Fits an extent instead of centre/zoom; re-fits on change |
| `fitBoundsPadding` | `number` | `24` | Pixels |
| `minZoom` / `maxZoom` | `number` | — | Applied live |
| `maxBounds` | `Bounds` | — | Restricts panning |
| `interactive` | `boolean` | `true` | `false` disables every gesture handler |
| `projection` | `'mercator' \| 'globe'` | — | Requires MapLibre 5; ignored with a warning otherwise |
| `attributionControl` | `boolean` | `true` | |
| `cursor` | `string` | — | CSS cursor over the canvas |
| `preserveDrawingBuffer` | `boolean` | `false` | Passed in both the MapLibre 4 and 5 shapes |
| `renderWorldCopies` | `boolean` | `true` | |
| `onLoad` | `(map) => void` | — | Style loaded, safe to add sources |
| `onMove` / `onMoveEnd` | `(view: ViewState) => void` | — | Prefer `onMoveEnd` for anything expensive |
| `onClick` / `onMouseMove` / `onMouseLeave` | | — | |
| `onError` | `(error) => void` | — | Defaults to `console.error` |

> **Note:** Handlers are held in a ref internally, so passing an inline arrow
> function does not re-subscribe the MapLibre listener on every render. For
> `onMouseMove` that is the difference between smooth and unusable.

## The imperative handle

Some camera changes are actions rather than state:

```tsx
const ref = useRef<MapContainerHandle>(null);

ref.current?.fitBounds([88, 22, 96, 29], { padding: 40 });
ref.current?.flyTo({ center: [90.4, 25.6], zoom: 8, duration: 600 });
ref.current?.resize();
ref.current?.getMap();   // the raw MapLibre instance — nothing is hidden
```

## The context

```ts
interface MapContextValue {
  map: MapLibreMap | null;
  ready: boolean;        // style loaded, safe to addSource
  styleVersion: number;  // increments on every styledata event
}
```

```tsx
import { useMap, useMapOptional, useReadyMap } from '@hridayanp/map-container';

const { map, ready } = useMap();   // throws outside a MapContainer
const maybe = useMapOptional();    // returns null instead
const readyMap = useReadyMap();    // the map, but only once ready
```

`useMap()` throws deliberately. A layer that silently renders nothing is far
harder to debug than one that says why.

### Why `styleVersion` exists

MapLibre **discards every non-style source and layer** when `setStyle` is
called. Any effect that lists `styleVersion` in its dependencies re-attaches
automatically after a basemap swap. That single number is the entire mechanism
behind the basemap switcher not wiping your data.

## Building your own layer

`useMapSourceLayers` is the hook the library's own layers use.

```tsx
import { useMapSourceLayers, useMapLayerEvent } from '@hridayanp/map-container';

useMapSourceLayers({
  sourceId: 'my-source',
  source: { type: 'geojson', data },
  layers: [
    { id: 'my-fill', type: 'fill', paint: { 'fill-color': '#38bdf8' } },
  ],
  beforeId: 'labels',
});

useMapLayerEvent('my-fill', 'click', (event) => { /* … */ });
```

It keeps everything in sync **in place**:

- GeoJSON sources update with `setData`, image sources with `updateImage`
- paint, layout, filter and zoom-range changes apply as individual property
  updates
- a full re-add happens only when the source *type* or the *set of layer ids*
  changes
- teardown removes layers before the source, which MapLibre requires
- everything re-attaches after a style swap

The naive alternative — remove and re-add on every change — makes MapLibre
unmount the layer, drop its GPU texture and visibly flash.

## Resize handling

A `ResizeObserver` watches the container. MapLibre only listens for window
resizes, so a map inside a collapsible panel or a split pane would otherwise
stay the wrong size.

## Optional protocols

```ts
import {
  registerPMTilesProtocol,
  registerCOGProtocol,
} from '@hridayanp/map-container';

await registerPMTilesProtocol();   // enables pmtiles:// sources
await registerCOGProtocol();       // enables cog:// sources
```

Both are idempotent — MapLibre throws when a protocol is registered twice, and
React Strict Mode runs effects twice in development.

Use `cog://` when you want MapLibre to stream a Cloud-Optimised GeoTIFF
directly. Use [`raster-layer`](/docs/raster-layer) when you need control over
the colour ramp, NoData handling or value inspection.
