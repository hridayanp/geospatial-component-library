## Purpose

`map-widgets` provides the furniture around a map: a scale bar, a cursor
coordinate readout, a north arrow, an overview inset, a place search box, a
colour-ramp picker and a loading indicator.

```bash
npm install @hridayanp/map-widgets @hridayanp/map-container maplibre-gl react
```

```ts
import '@hridayanp/ui/styles.css';
```

```tsx
<MapContainer center={[92, 25.5]} zoom={6}>
  <LocationSearch onSearch={geocode} />
  <MapControlBar>
    <ZoomControl />
    <NorthArrow />
  </MapControlBar>
  <ScaleBar unit="nautical" />
  <CoordinateReadout format="ddm" />
  <MiniMap mapStyle={overviewStyle} />
  <MapLoadingOverlay />
</MapContainer>
```

## Scope

Each widget is a property of a map, not of an application. Layer pickers are
deliberately absent, as they are from [`map-controls`](/docs/map-controls):
which layers exist and how they are grouped is an application's information
architecture. The search box takes the host's geocoder as a function; the ramp
picker emits colours the host passes on.

## `ScaleBar`

Measures the geodesic distance across its own width at the **centre of the
view** on every move. Web Mercator's scale at 60° latitude is half its scale at
the equator, so a fixed bar would be wrong almost everywhere. The length is
rounded down to a 1–2–5 step.

| Prop | Type | Default |
| --- | --- | --- |
| `unit` | `'metric' \| 'imperial' \| 'nautical'` | `'metric'` |
| `maxWidth` | `number` (px) | `120` |
| `placement` | `PanelPlacement` | `'bottom-left'` |

## `CoordinateReadout`

The position under the pointer, **latitude first**, through
[`formatLatLon`](/docs/geo-inputs). Updates at most once per animation frame and
falls back to the map centre when the pointer leaves.

| Prop | Type | Default |
| --- | --- | --- |
| `format` | `'decimal' \| 'dms' \| 'ddm' \| 'signed'` | `'decimal'` |
| `precision` | `number` | per format |
| `showZoom` | `boolean` | `false` |
| `idleText` | `string` | the map centre |
| `placement` | `PanelPlacement` | `'bottom-right'` |

## `NorthArrow`

A needle that turns with the map; click to face north (and flatten pitch). It
appears only once the map is rotated unless `alwaysVisible`. Designed to sit in
a `MapControlBar`.

## `MiniMap`

A second, non-interactive MapLibre map that follows the main one at
`zoomOffset` levels further out (default 5, capped at `maxZoom`) and outlines the
main viewport. Clicking it recentres the main map. The default style is blank —
pass a light, label-free basemap.

## `LocationSearch`

```tsx
<LocationSearch
  onSearch={async (query, signal) => {
    const hits = await gazetteer.search(query, { signal });
    return hits.map((h) => ({ id: h.id, label: h.name, description: h.region, lngLat: [h.lon, h.lat] }));
  }}
  onSelect={(place) => setSelected(place)}
/>
```

The component owns the interaction — debouncing (`debounceMs`, 300), cancelling
superseded requests through the `AbortSignal`, keyboard navigation and the ARIA
combobox pattern — and none of the data. Choosing a result fits its `bounds` or
flies to `flyToZoom`. Typed coordinates in any notation `parseLatLon` reads are
offered as the first result without calling `onSearch`.

## `ColorRampPicker`

Offers perceptually ordered scientific ramps — Viridis, Cividis, Magma, Inferno,
Plasma, single-hue ColorBrewer sequences and diverging ramps — and emits the
**colours themselves**, ready for any `colorScale` prop:

```tsx
<ColorRampPicker value={rampId} onChange={(id, colors) => { setRampId(id); setColors(colors); }} />
<RasterLayer colorScale={colors} … />
```

Rainbow ramps are left out on purpose: they invent boundaries the data does not
have. Pass `ramps` to supply your own and `kinds` to filter; `onReversedChange`
adds a reverse toggle.

## `MapLoadingOverlay`

Without `loading`, follows the map's own `dataloading` and `idle` events —
basemap tiles, raster frames and GeoJSON alike. With it, controlled. Appears
after `delayMs` (200) so fast loads never flash, and announces itself politely
to screen readers.
