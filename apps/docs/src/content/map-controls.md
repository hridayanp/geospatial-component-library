The genuinely reusable map controls — zoom, reset view, fullscreen, opacity and
basemap switching — and deliberately nothing else.

```bash
npm install @hridayanp/map-controls @hridayanp/map-container maplibre-gl react
```

Remember the stylesheet: `import '@hridayanp/ui/styles.css'`.

## Usage

```tsx
<MapContainer center={[92, 25.5]} zoom={6}>
  <MapControlBar placement="top-right">
    <ZoomControl />
    <ResetViewControl bounds={[88, 22, 96, 29]} />
    <FullscreenControl />
  </MapControlBar>

  <MapControlBar placement="bottom-left">
    <OpacityControl value={opacity} onChange={setOpacity} />
    <BasemapSwitcher value={basemap} onChange={setBasemap} options={basemaps} />
  </MapControlBar>
</MapContainer>
```

## What is here, and what is not

Here: things that are true of **any** map. Zooming, framing an extent, going
fullscreen, dimming a layer, changing the basemap.

Not here: layer pickers, site selectors, model switchers, alert panels, date
range choosers. Those encode what an *application* is, not what a *map* does. A
component library that shipped them would be shipping someone else's product,
and every consumer would immediately need to fight the assumptions baked into
them.

If you need a layer picker, build it from [`ui`](/docs/ui) primitives inside a
`MapControlBar` — it accepts arbitrary children.

## Components

### `MapControlBar`

Docks and groups controls. The bar itself is transparent to pointer events, so
the map stays draggable in the gaps **between** control groups; only the buttons
capture the pointer.

```tsx
<MapControlBar placement="top-right" direction="vertical" gap={8}>
```

| Prop | Default | Notes |
| --- | --- | --- |
| `placement` | `'top-right'` | Any of the eight dock positions |
| `direction` | `'vertical'` | Or `'horizontal'` |
| `gap` | `6` | Pixels between children |
| `offset` | `12` | Distance from the map edge |

### `ZoomControl`

Reads the map's own `minZoom`/`maxZoom` and **disables itself at the limits**
rather than presenting a button that clicks with no effect. A disabled control
is honest; a dead one looks broken.

```tsx
<ZoomControl step={1} showReset />
```

### `ResetViewControl`

Takes either a `view` or a `bounds`:

```tsx
<ResetViewControl view={{ center: [92, 25.5], zoom: 6 }} />
<ResetViewControl bounds={[88, 22, 96, 29]} padding={40} />
```

With neither, it restores the camera the map was first mounted with.

### `FullscreenControl`

Expands the map container by default — not the document — so surrounding chrome
you *want* to keep (a legend, a timeline) goes fullscreen with it.

It calls `map.resize()` **after** the transition completes. Resizing during the
CSS transition captures an intermediate size and leaves the canvas stretched.

```tsx
<FullscreenControl target={() => document.getElementById('app')!} />
```

### `OpacityControl`

```tsx
<OpacityControl value={opacity} onChange={setOpacity} label="Rainfall" />
<OpacityControl value={opacity} onChange={setOpacity} inline />
```

A popover by default; `inline` renders a bare slider suitable for embedding in a
legend footer.

### `BasemapSwitcher`

```tsx
<BasemapSwitcher
  value={basemap}
  onChange={setBasemap}
  options={[
    { id: 'dark',  label: 'Dark',  style: createBlankStyle('#0b1220') },
    { id: 'terrain', label: 'Terrain', style: terrainStyle },
  ]}
/>
```

`applyToMap` is **optional and off by default**. Leave it off when the host
passes `mapStyle` to `MapContainer` itself — otherwise the switcher calls
`setStyle` and the controlled prop calls it again, and the two fight over the
map on every change.

Turn it on only for an uncontrolled map where the switcher is the sole owner of
the style.

## Controlled by design

`OpacityControl` and `BasemapSwitcher` have no internal state.

Opacity almost always belongs to the layer the host already manages — the same
number is passed to `<RasterLayer opacity={…} />`. A control holding its own copy
would disagree with the layer the moment anything else changed it (a preset, a
URL parameter, a reset button).

`ZoomControl` and `FullscreenControl` are different: their state lives on the map
and the browser respectively, so there is nothing for the host to own.

## Basemap switching and your layers

Swapping a style **discards every source and layer added on top of it**. That is
MapLibre's behaviour, not a choice this library makes.

Every layer package here re-attaches automatically on the next `styledata` event,
via the `styleVersion` counter described in
[`map-container`](/docs/map-container#why-styleversion-exists). Anything you added
to the map by hand has to do the same:

```tsx
const { map, ready, styleVersion } = useMap();

useEffect(() => {
  if (!map || !ready) return;
  map.addSource('mine', { /* … */ });
  map.addLayer({ /* … */ });
  return () => { /* remove layers, then the source */ };
}, [map, ready, styleVersion]);   // ← styleVersion is the important one
```

## Building your own control

```tsx
import { MapControlBar } from '@hridayanp/map-controls';
import { Button, Panel } from '@hridayanp/ui';
import { useMap } from '@hridayanp/map-container';

function NorthUpControl() {
  const { map } = useMap();
  return (
    <Button variant="ghost" onClick={() => map?.easeTo({ bearing: 0 })}>
      N
    </Button>
  );
}

<MapControlBar placement="top-right">
  <ZoomControl />
  <NorthUpControl />
</MapControlBar>
```

Using [`ui`](/docs/ui) primitives is what keeps a custom control visually
identical to the shipped ones.
