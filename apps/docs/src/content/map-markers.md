## Purpose

`map-markers` provides DOM markers and popups whose content is React, and a
click-to-pick point selector built from them.

```bash
npm install @hridayanp/map-markers @hridayanp/map-container maplibre-gl react react-dom
```

```ts
import '@hridayanp/ui/styles.css';
```

```tsx
<MapContainer center={[92, 25.5]} zoom={6}>
  {stations.map((s) => (
    <MapMarker key={s.id} lngLat={s.lngLat} label={s.name} onClick={() => setSelected(s)}>
      <StatusChip value={s.gust} />
    </MapMarker>
  ))}

  {selected && (
    <MapPopup lngLat={selected.lngLat} onClose={() => setSelected(null)}>
      <StationSummary station={selected} />
    </MapPopup>
  )}
</MapContainer>
```

## Markers or a vector layer?

A marker is a DOM node that MapLibre repositions on every frame; a point in
[`VectorLayer`](/docs/vector-layer) is drawn on the GPU. Markers suit a handful
of things the reader interacts with individually — a selected station, an
active alert, a route waypoint. Hundreds of points belong in a vector layer.

## `MapMarker`

Children render through a **portal** into the element MapLibre positions, so
they keep React context, state and handlers. Without children the default pin
is drawn in the accent colour.

| Prop | Type | Default |
| --- | --- | --- |
| `lngLat` | `LngLat` | — (required) |
| `children` | `ReactNode` | the pin |
| `color` | `string` | `var(--gcl-accent)` — pin only |
| `anchor` | `PositionAnchor` | `'bottom'` for the pin, `'center'` otherwise |
| `offset` | `[number, number]` | — |
| `rotation` / `rotationAlignment` | | `0` / `'viewport'` |
| `draggable` / `onDragEnd` | | `false` / — |
| `onClick` | `(lngLat) => void` | — |
| `label` | `string` | — accessible name |
| `className` / `style` | | — |

A marker with `onClick` becomes a keyboard-focusable button: Enter and Space
activate it, and `label` is its accessible name. Clicks on a marker do not reach
the map's own click handler.

## `MapPopup`

Controlled: render it to open, unmount it to close, and unmount it from
`onClose` when the user dismisses it. `onClose` is not called when the host
unmounts the popup itself.

| Prop | Type | Default |
| --- | --- | --- |
| `lngLat` | `LngLat` | — (required) |
| `children` | `ReactNode` | — (required) |
| `onClose` | `() => void` | — |
| `closeButton` / `closeOnClick` / `closeOnMove` | `boolean` | `true` / `true` / `false` |
| `anchor` | `PositionAnchor` | whichever side fits |
| `offset` | `number` | `12` |
| `maxWidth` | `string` | `'280px'` |
| `className` | `string` | — |

The popup carries the `gcl-popup` class, which restyles MapLibre's popup with
the library tokens in both themes.

## `PointPicker`

Click to pick; drag the marker to adjust. The building block of every
point-forecast, meteogram or sounding flow.

| Prop | Type | Default |
| --- | --- | --- |
| `value` / `onChange` | `LngLat \| null` / `(lngLat) => void` | — (required) |
| `enabled` | `boolean` | `true` |
| `snap` / `gridOrigin` | `number` (degrees) | — / `0` |
| `precision` | `number` (decimals) | `4` (~11 m) |
| `draggable` | `boolean` | `true` |
| `color` / `children` / `label` | | pin / — / `'Selected point'` |

`snap={0.25} gridOrigin={0.125}` snaps to the centres of a 0.25° model grid, so
the coordinate handed to the host is the one it should query. The cursor is a
crosshair while picking is enabled.
