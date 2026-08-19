## Purpose

`MapContainer` is the composition root of the library. It owns a MapLibre GL map
instance, manages its view state, and publishes a React context through which
every other layer package resolves the map it renders into.

It solves the lifecycle problem at the boundary between React and an imperative
rendering engine: MapLibre owns a canvas and a mutable source/layer registry,
React owns a declarative tree, and the two must not contend for the same DOM
subtree or the same registry entries.

```bash
npm install @hridayanp/map-container maplibre-gl react react-dom
```

## Responsibilities

| Concern | Owner |
| --- | --- |
| Map instance construction and disposal | `MapContainer` |
| View state (centre, zoom, bearing, pitch) | `MapContainer`, controlled or uncontrolled |
| Style specification and reload recovery | `MapContainer` |
| Container resize observation | `MapContainer` |
| Source and layer registration | Layer packages, via `useMapSourceLayers` |
| Data retrieval, tile hosting, credentials | Host application |
| Basemap selection policy | Host application |

The component has no knowledge of what is rendered on the map, where data
originates, or what the map depicts. That boundary is what makes the same
component serviceable for a meteorological overlay, a logistics view and a
network-coverage map.

## Basic usage

```tsx
import { MapContainer } from '@hridayanp/map-container';
import 'maplibre-gl/dist/maplibre-gl.css';

<div style={{ height: 520 }}>
  <MapContainer center={[92, 25.5]} zoom={6}>
    {/* layer and overlay components */}
  </MapContainer>
</div>
```

The component fills its parent element, which must therefore have a resolved
height.

## Style specifications

`mapStyle` defaults to a background-only style specification. No tile request is
issued until a basemap is supplied, which keeps the component viable offline, in
test environments, and wherever an unattributed outbound request is
unacceptable.

```ts
import {
  createBlankStyle,
  createRasterStyle,
  withPMTilesOutline,
  DEFAULT_MAP_STYLE,
} from '@hridayanp/map-container';

// Background only; issues no network request.
createBlankStyle('#0b1220');

// An XYZ raster tile basemap. Attribution is an explicit option because
// most tile services require it contractually.
const style = createRasterStyle('https://tile.example.com/{z}/{x}/{y}.png', {
  attribution: '© Example',
  maxzoom: 19,
});

// Add a PMTiles-backed vector boundary layer to an existing specification.
withPMTilesOutline(style, {
  url: 'https://example.com/boundaries.pmtiles',
  sourceLayer: 'admin',
  color: '#94a3b8',
});
```

Any valid MapLibre `StyleSpecification`, or a URL resolving to one, is accepted.

## Configuration

| Prop | Type | Default | Behaviour |
| --- | --- | --- | --- |
| `mapStyle` | `StyleSpecification \| string` | blank background | Style specification or URL |
| `center` | `[lng, lat]` | `[0, 0]` | Controlled centre; sub-pixel deltas are ignored |
| `zoom` | `number` | `1` | Controlled zoom level |
| `bearing` | `number` | `0` | Camera rotation, degrees |
| `pitch` | `number` | `0` | Camera tilt, degrees |
| `bounds` | `Bounds` | — | Fits an extent instead of centre/zoom; re-fits on change |
| `fitBoundsPadding` | `number` | `24` | Pixels of padding when fitting `bounds` |
| `minZoom` / `maxZoom` | `number` | — | Applied to the live map |
| `maxBounds` | `Bounds` | — | Constrains panning |
| `interactive` | `boolean` | `true` | `false` disables every gesture handler |
| `projection` | `'mercator' \| 'globe'` | — | Requires MapLibre 5; applied defensively and ignored on earlier versions |
| `attributionControl` | `boolean` | `true` | MapLibre's attribution control |
| `cursor` | `CSSProperties['cursor']` | — | CSS cursor over the canvas |
| `preserveDrawingBuffer` | `boolean` | `false` | Retains the WebGL drawing buffer so `canvas.toDataURL()` succeeds; costs memory |
| `renderWorldCopies` | `boolean` | `true` | Horizontal world repetition at low zoom |
| `className` / `style` | | — | Applied to the outer element |

### Callbacks

| Prop | Signature | Fired |
| --- | --- | --- |
| `onLoad` | `(map: MapLibreMap) => void` | Style loaded; sources may be added |
| `onMove` | `(view: ViewState) => void` | Continuously during camera motion |
| `onMoveEnd` | `(view: ViewState) => void` | Once the camera settles |
| `onClick` | `(event: MapMouseEvent) => void` | Canvas click |
| `onMouseMove` | `(event: MapMouseEvent) => void` | Pointer motion over the canvas |
| `onMouseLeave` | `() => void` | Pointer exits the canvas |
| `onError` | `(error: Error) => void` | Map errors; defaults to `console.error` |

> **Note:** Callbacks are held in a ref internally, so passing an inline arrow
> function does not re-subscribe the underlying MapLibre listener on each
> render. For `onMouseMove`, which fires at pointer-event rate, this is a
> material performance property rather than a micro-optimisation.

Prefer `onMoveEnd` for any expensive reaction to view-state change; `onMove`
fires on every animation frame during a gesture.

## Imperative handle

Certain view-state changes are actions rather than state. `MapContainerHandle`
exposes them:

```tsx
const ref = useRef<MapContainerHandle>(null);

ref.current?.fitBounds([88, 22, 96, 29], { padding: 40, duration: 600 });
ref.current?.flyTo({ center: [90.4, 25.6], zoom: 8, duration: 600 });
ref.current?.resize();
ref.current?.getMap();   // the underlying MapLibre instance
```

`getMap()` returns the raw instance. Any MapLibre capability the library does
not surface remains directly available.

## Map context

```ts
interface MapContextValue {
  map: MapLibreMap | null;
  ready: boolean;        // style loaded; sources may be added
  styleVersion: number;  // increments on every styledata event
}
```

```tsx
import { useMap, useMapOptional, useReadyMap } from '@hridayanp/map-container';

const { map, ready } = useMap();   // throws outside a MapContainer
const maybe = useMapOptional();    // returns null outside a MapContainer
const readyMap = useReadyMap();    // the map instance, only once ready
```

`useMap()` throws deliberately. A layer that silently renders nothing is
considerably harder to diagnose than one that reports why.

### `styleVersion`

MapLibre **discards every source and style layer added on top of a style** when
`setStyle` is called. Any effect that lists `styleVersion` among its
dependencies re-registers automatically after a style reload. That single
counter is the entire mechanism by which a basemap change does not remove
application data from the map.

## Building a custom layer

`useMapSourceLayers` is the hook the library's own layer packages use. It
reconciles a source and its style layers against the map, in place.

```tsx
import { useMapSourceLayers, useMapLayerEvent } from '@hridayanp/map-container';

useMapSourceLayers({
  sourceId: 'catchments',
  source: { type: 'geojson', data: featureCollection },
  layers: [
    {
      id: 'catchments-fill',
      type: 'fill',
      paint: { 'fill-color': '#38bdf8', 'fill-opacity': 0.3 },
    },
  ],
  beforeId: 'basemap-labels',
});

useMapLayerEvent('catchments-fill', 'click', (event) => { /* … */ });
```

Reconciliation behaviour:

- GeoJSON sources update through `setData`; image sources through `updateImage`.
- Paint, layout, filter and zoom-range changes apply as individual property
  updates.
- A full re-registration occurs only when the source *type* or the *set of layer
  identifiers* changes.
- Teardown removes style layers before the source, as MapLibre requires.
- Every registration re-applies after a style reload.

Passing `source: null` detaches everything without unmounting — the mechanism by
which layer components implement `visible={false}`.

The alternative — removing and re-adding on every change — causes MapLibre to
unmount the layer, release its GPU texture, and re-upload it, producing a
visible discontinuity on each update.

Additional event hooks: `useMapEvent` for map-level events and `useMapCursor`
for cursor management.

## Interaction and resize

A `ResizeObserver` monitors the container element. MapLibre observes window
resize only, so a map inside a collapsible panel, a split pane or a tab would
otherwise retain a stale canvas size.

Controlled view-state props apply a sub-pixel threshold (`< 1e-6`) before
issuing a camera update, so a controlled `center` does not compete with an
in-progress user gesture.

## Optional protocols

```ts
import {
  registerPMTilesProtocol,
  registerCOGProtocol,
  registeredProtocols,
} from '@hridayanp/map-container';

await registerPMTilesProtocol();   // enables pmtiles:// sources
await registerCOGProtocol();       // enables cog:// sources
```

Both are idempotent: MapLibre throws when a protocol is registered twice, and
React Strict Mode invokes effects twice in development. `registeredProtocols`
reports the current registration set.

Each requires its optional peer — `pmtiles` and
`@geomatico/maplibre-cog-protocol` respectively — and raises a diagnostic error
naming the package when it is absent.

Use `cog://` when MapLibre should stream a Cloud-Optimised GeoTIFF directly as a
tiled raster source. Use [`raster-layer`](/docs/raster-layer) when the
application requires control over the colour ramp, NoData handling or value
inspection.

## Geospatial considerations

- `center` and all extents are geographic WGS84 (EPSG:4326), `[longitude, latitude]`
  in decimal degrees.
- Rendering is Web Mercator (EPSG:3857) unless `projection="globe"` is set on
  MapLibre 5. Web Mercator is undefined at the poles; latitudes are effectively
  bounded at ±85.051129° (`MERCATOR_MAX_LATITUDE` in
  [`geo-utils`](/docs/geo-utils)).
- `bounds` is `[west, south, east, north]`. An extent crossing the antimeridian
  must be expressed with `east < west` handled by the caller; the component does
  not normalise it.
- `maxBounds` constrains panning but not programmatic camera changes issued
  through the imperative handle.

## Performance considerations

- Prefer `onMoveEnd` to `onMove` for any handler performing non-trivial work.
- `preserveDrawingBuffer` retains an additional full-resolution buffer; enable
  it only when exporting the canvas as an image.
- `renderWorldCopies` increases draw calls at low zoom; disable it for
  single-region deployments.
- Layer registration is deferred until `ready`, so mounting many layers before
  the style resolves incurs no repeated work.
