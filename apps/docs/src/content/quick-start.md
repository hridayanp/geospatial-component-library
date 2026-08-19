A complete rendering pipeline — map surface, basemap, raster layer, legend,
temporal playback and value inspection — assembled incrementally.

## 1. Install

```bash
npm install @hridayanp/map-container @hridayanp/raster-layer \
  @hridayanp/geo-legend maplibre-gl
```

## 2. Import stylesheets

Once, at the application entry point:

```ts
import 'maplibre-gl/dist/maplibre-gl.css';
import '@hridayanp/ui/styles.css';
```

## 3. Mount a map surface

`MapContainer` fills its parent element, so it requires an ancestor with a
resolved height.

```tsx
import { MapContainer } from '@hridayanp/map-container';

export function Map() {
  return (
    <div style={{ height: 520 }}>
      <MapContainer center={[92, 25.5]} zoom={6} />
    </div>
  );
}
```

The result is a uniform background. This is the defined behaviour: `mapStyle`
defaults to a background-only MapLibre style specification, so the component
issues no network request until a basemap is supplied. That property makes the
component viable in offline deployments, in test environments, and wherever an
unattributed outbound request is unacceptable.

## 4. Supply a basemap

```tsx
import { MapContainer, createRasterStyle } from '@hridayanp/map-container';

const basemap = createRasterStyle(
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  { attribution: '© OpenStreetMap contributors' },
);

<MapContainer center={[92, 25.5]} zoom={6} mapStyle={basemap} />
```

`createRasterStyle` produces a complete `StyleSpecification` for an XYZ raster
tile endpoint. Attribution is a first-class option because most tile services
require it contractually.

## 5. Render a raster band

A raster is a typed array, its grid dimensions, and its geographic extent.
Acquisition is the host application's concern — a fetch, a worker, a WebSocket
message or a static import are all equivalent from the layer's perspective.

```tsx
import { RasterLayer } from '@hridayanp/raster-layer';
import { GeoLegend } from '@hridayanp/geo-legend';

const palette = ['#0b2545', '#134074', '#8da9c4', '#f4d35e', '#ee964b', '#c1121f'];

<MapContainer center={[92, 25.5]} zoom={6} mapStyle={basemap}>
  <RasterLayer
    data={{
      data: values,              // Float32Array, row-major, north row first
      width: 110,
      height: 96,
      bounds: [88, 22, 96, 29],  // [west, south, east, north], EPSG:4326
      noData: -9999,
      unit: 'index',
    }}
    colorScale={palette}
    min={0}
    max={100}
    opacity={0.85}
  />

  <GeoLegend
    title="Intensity"
    colorScale={palette}
    min={0}
    max={100}
    unit="index"
    placement="bottom-right"
  />
</MapContainer>
```

Layer components resolve the enclosing map instance through React context and
register their own MapLibre source and style layers. Composition is therefore
expressed as JSX nesting, and mount order determines draw order.

Two conventions govern the grid: values are **row-major with the northern row
first**, matching image space and GeoTIFF row ordering; and `bounds` describes
the **image edges**, not the centres of the outer cells.

## 6. Sequence frames over time

The active index is held in application state; the layer receives the
corresponding frame through `data`. `frameKey` establishes cache identity for
the decoded and colourised image, so revisiting a frame is a texture swap rather
than a re-decode.

```tsx
import { useState } from 'react';
import { RasterLayer } from '@hridayanp/raster-layer';
import { TimelineControl } from '@hridayanp/timeline-control';

function Animated({ frames }) {
  const [index, setIndex] = useState(0);
  const active = frames[index];

  return (
    <MapContainer center={[92, 25.5]} zoom={6} mapStyle={basemap}>
      <RasterLayer
        data={active.meta.raster}
        frameKey={active.id}
        colorScale={palette}
        min={0}
        max={100}
      />
      <TimelineControl
        frames={frames}
        index={index}
        onIndexChange={setIndex}
        placement="bottom-center"
      />
    </MapContainer>
  );
}
```

> **Warning:** Specify `min` and `max` explicitly for any temporal sequence.
> Without them each frame is normalised against its own value range, so a
> low-magnitude frame consumes the full colour ramp and the sequence appears to
> pulse. Colour ceases to be comparable between frames, which invalidates visual
> interpretation of the animation.

## 7. Inspect values under the pointer

```tsx
import { GeoHover } from '@hridayanp/geo-hover';

<GeoHover raster={active.meta.raster} title="Intensity" unit="index" />
```

The probe samples the array already resident in application memory. No request
is issued and no second decode occurs.

## Continue

- [Composing Layers](/docs/composition) — raster, vector and particle layers on one map
- [`raster-layer`](/docs/raster-layer) — full configuration surface and the frame-transition model
- [Theming](/docs/theming) — aligning overlay presentation with an application design language
- [Runtime Flow](/docs/runtime-flow) — the lifecycle underlying the above
