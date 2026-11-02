## Purpose

`map-controls` provides the view-state and presentation controls that are common
to any map: zoom, view reset, fullscreen, layer opacity and basemap selection,
together with a bar that docks and groups them.

```bash
npm install @hridayanp/map-controls @hridayanp/map-container maplibre-gl react
```

```ts
import '@hridayanp/ui/styles.css';
```

```tsx
<MapContainer center={[92, 25.5]} zoom={6}>
  <MapControlBar placement="top-right">
    <ZoomControl />
    <ResetViewControl bounds={[88, 22, 96, 29]} />
    <FullscreenControl />
  </MapControlBar>

  <MapControlBar placement="bottom-left">
    <OpacityControl value={opacity} onChange={setOpacity} label="Precipitation" />
    <BasemapSwitcher value={basemapId} onChange={setBasemap} options={basemaps} />
  </MapControlBar>
</MapContainer>
```

## Scope

The package covers operations that are properties of **a map**: changing the
view, framing an extent, expanding the viewport, attenuating a layer, exchanging
the basemap.

It does not cover layer pickers, site selectors, model-run switchers, advisory
panels or date-range choosers. Those express an application's information
architecture rather than a cartographic capability, and a library shipping them
would embed one product's assumptions in every consumer.

`MapControlBar` accepts arbitrary children, so an application-specific control
composed from [`ui`](/docs/ui) primitives sits alongside the shipped ones and
inherits the same visual language.

## Components

### `MapControlBar`

Docks and groups controls. The bar is transparent to pointer events, so map
panning remains available between control groups; only the controls themselves
capture the pointer.

| Prop | Type | Default |
| --- | --- | --- |
| `placement` | `PanelPlacement` | `'top-right'` |
| `orientation` | `'vertical' \| 'horizontal'` | `'vertical'` |
| `className` / `style` | | — |
| `children` | `ReactNode` | — |

### `ZoomControl`

Tracks the map's zoom and **disables each button at the corresponding limit**
rather than presenting a control that produces no effect. Zoom changes are eased
over 200 ms.

| Prop | Type | Default |
| --- | --- | --- |
| `step` | `number` | `1` |
| `className` | `string` | — |

### `ResetViewControl`

Restores a defined view. `bounds` takes precedence over `view`; with neither, the
control restores the camera the map was mounted with.

| Prop | Type | Default |
| --- | --- | --- |
| `view` | `ViewState` | — |
| `bounds` | `Bounds` | — |
| `padding` | `number` | `24` |
| `label` | `string` | — |
| `className` | `string` | — |

```tsx
<ResetViewControl view={{ center: [92, 25.5], zoom: 6 }} />
<ResetViewControl bounds={[88, 22, 96, 29]} padding={40} />
```

### `FullscreenControl`

Expands the map's own container by default rather than the document, so overlays
that belong to the map — legend, timeline, control bars — expand with it. The
control calls `map.resize()` **after** the transition completes; resizing during
the CSS transition captures an intermediate size and leaves the canvas
distorted.

| Prop | Type | Default |
| --- | --- | --- |
| `target` | `HTMLElement \| null` | the map container |
| `className` | `string` | — |

### `OpacityControl`

| Prop | Type | Default |
| --- | --- | --- |
| `value` | `number` | — (required) |
| `onChange` | `(value: number) => void` | — (required) |
| `label` | `string` | `'Opacity'` |
| `inline` | `boolean` | `false` |
| `className` | `string` | — |

`inline` renders a bare slider suitable for embedding in a legend footer;
otherwise the slider is presented behind a popover trigger.

### `BasemapSwitcher`

| Prop | Type | Default |
| --- | --- | --- |
| `options` | `BasemapOption[]` | — (required) |
| `value` | `string` | — (required) — the active option's `id` |
| `onChange` | `(id: string, style: StyleSpecification \| string) => void` | — (required) |
| `applyToMap` | `boolean` | `false` |
| `className` | `string` | — |

```tsx
const basemaps: BasemapOption[] = [
  { id: 'dark',    label: 'Dark',    style: createBlankStyle('#0b1220') },
  { id: 'terrain', label: 'Terrain', style: terrainStyle },
];

<BasemapSwitcher value={basemapId} onChange={setBasemap} options={basemaps} />
```

> **Warning:** `applyToMap` defaults to `false` deliberately. When the host
> passes `mapStyle` to `MapContainer`, enabling it means the switcher calls
> `setStyle` and the controlled prop calls it again — two writers contending for
> the same map state. Enable it only for an uncontrolled map where the switcher
> is the sole owner of the style.

## State ownership

`OpacityControl` and `BasemapSwitcher` are fully controlled.

Layer opacity almost always belongs to the layer the host already manages — the
same value is passed to `<RasterLayer opacity={…} />`. A control holding an
internal copy would diverge from the layer the moment anything else modified it:
a preset, a URL parameter, a reset action.

`ZoomControl` and `FullscreenControl` are different: their state lives on the
map instance and in the browser respectively, so there is nothing for the host
to own.

## Basemap reload and layer recovery

Exchanging a style **discards every source and style layer added on top of it**.
This is MapLibre behaviour, not a choice made by this library.

Every layer package here re-registers automatically on the next `styledata`
event, through the `styleVersion` counter described in
[`map-container`](/docs/map-container#styleversion). Sources and layers added
directly by the host must implement the same recovery:

```tsx
const { map, ready, styleVersion } = useMap();

useEffect(() => {
  if (!map || !ready) return;
  map.addSource('mine', { /* … */ });
  map.addLayer({ /* … */ });
  return () => { /* remove layers, then the source */ };
}, [map, ready, styleVersion]);   // styleVersion is the operative dependency
```

## Extending the control set

```tsx
import { MapControlBar } from '@hridayanp/map-controls';
import { Button } from '@hridayanp/ui';
import { useMap } from '@hridayanp/map-container';

function NorthUpControl() {
  const { map } = useMap();
  return (
    <Button aria-label="Reset bearing" onClick={() => map?.easeTo({ bearing: 0 })}>
      N
    </Button>
  );
}

<MapControlBar placement="top-right">
  <ZoomControl />
  <NorthUpControl />
</MapControlBar>
```

Building from [`ui`](/docs/ui) primitives is what keeps an application-specific
control visually indistinguishable from the shipped ones.

## Accessibility

Controls carry accessible names and are reachable by keyboard. Tooltips,
popovers and selects are Radix primitives, so focus management, escape handling
and ARIA wiring are correct without re-implementation. Disabled states are
communicated through the `disabled` attribute rather than by visual treatment
alone.
