From an empty React app to a working, animated map.

## 1. Install

```bash
npm install @hridayanp/map-container @hridayanp/raster-layer \
  @hridayanp/geo-legend maplibre-gl
```

## 2. Import the stylesheets once

In your application entry point:

```ts
import 'maplibre-gl/dist/maplibre-gl.css';
import '@hridayanp/ui/styles.css';
```

## 3. Render a map

`MapContainer` fills its parent, so give it a sized box.

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

You will see a blank dark rectangle. That is correct — **the default style makes
no network request**. Nothing is fetched unless you ask for it, which matters
for offline deployments and for tests.

## 4. Add a basemap

```tsx
import { MapContainer, createRasterStyle } from '@hridayanp/map-container';

const basemap = createRasterStyle(
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  { attribution: '© OpenStreetMap contributors' },
);

<MapContainer center={[92, 25.5]} zoom={6} mapStyle={basemap} />
```

> **Note:** Most tile providers require attribution in their terms of use.
> `createRasterStyle` takes it as an option rather than leaving you to remember.

## 5. Add data

A raster is a plain typed array plus its extent. Where you get it from is
entirely your business — a fetch, a worker, a WebSocket, a static import.

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
      bounds: [88, 22, 96, 29],  // [west, south, east, north]
      noData: -9999,
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

Layers attach themselves to the enclosing map through React context, so
composition is nothing more than nesting. Mount order is draw order.

## 6. Animate it

Hold an index in your own state and swap the `data` prop. `frameKey` is what
makes revisited frames instant — it is the cache key for the decoded, coloured
image.

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
        data={active.raster}
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

> **Warning:** Always set an explicit `min` and `max` for an animated sequence.
> Without them each frame self-scales to its own range, so a quiet frame uses
> the whole colour ramp and the animation appears to pulse. Colours stop being
> comparable between frames.

## 7. Read values under the pointer

```tsx
import { GeoHover } from '@hridayanp/geo-hover';

<GeoHover raster={active.raster} title="Intensity" unit="index" />
```

This samples the array you already have in memory — no round trip, no second
decode.

## Where to go next

- [Composing Layers](/docs/composition) — raster, vector and particles together
- [`raster-layer`](/docs/raster-layer) — every prop, and why frames never flash
- [Theming](/docs/theming) — make the overlays match your product
- [Runtime Flow](/docs/runtime-flow) — what happens under all of this
