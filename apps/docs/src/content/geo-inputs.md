## Purpose

`geo-inputs` provides form controls for geographic values — a latitude/longitude
field that reads every common notation and a bounding-box editor — and the
parsing and formatting functions behind them.

```bash
npm install @hridayanp/geo-inputs react
```

```ts
import '@hridayanp/ui/styles.css';
```

```tsx
<LatLonInput label="Location" value={point} onChange={setPoint} format="ddm" />
<BboxEditor value={region} onChange={setRegion} onUseCurrentView={readMapBounds} />
```

There is no map dependency. These controls work in any form, with or without a
map on screen; `map-widgets` reuses the formatter for its coordinate readout.

## Reading coordinates

`parseLatLon(text)` returns `[longitude, latitude]` or `null`, and accepts what
people paste:

| Input | Result |
| --- | --- |
| `9.8, 75.9` | `[75.9, 9.8]` — a bare pair is latitude first |
| `-33.86 151.21` | `[151.21, -33.86]` |
| `9.80°N 75.90°E` | `[75.9, 9.8]` |
| `75.90E 9.80N` | `[75.9, 9.8]` — letters decide the axis |
| `9°48′30″N 75°54′15″E` | DMS, with `'`, `′`, `’`, `"`, `″` or `''` |
| `N 9 48.5 E 75 54.25` | degrees and decimal minutes, letters first |
| `95, 10` | `null` — latitude out of range |
| `9.8N 10.2N` | `null` — two latitudes |

Out-of-range values are rejected, never clamped: a clamped coordinate is a wrong
coordinate that looks right. `order: 'lonlat'` reads bare pairs the other way.
`parseCoordinate(text, 'lat' | 'lng')` reads a single field.

## Writing coordinates

`formatLatLon([lng, lat], { format, precision })` puts **latitude first**, the
order coordinates are read and spoken in:

| `format` | Output |
| --- | --- |
| `'decimal'` (default) | `9.80°N 75.90°E` |
| `'dms'` | `9°48′00″N 75°54′00″E` |
| `'ddm'` | `9°48.00′N 75°54.00′E` |
| `'signed'` | `9.8000, 75.9000` |

Rounding carries correctly — 59.999′ at two places becomes the next degree, not
`60.00′`. GeoJSON's `[lng, lat]` remains the order every value is passed in.

## `LatLonInput`

Commits on Enter or blur, then redisplays the parsed value in one notation, so
what the user sees after committing is exactly what the application received.
Escape restores the last committed value; clearing the field emits `null`. An
unreadable entry shows an inline message linked with `aria-describedby` and is
never emitted.

| Prop | Type | Default |
| --- | --- | --- |
| `value` / `onChange` | `LngLat \| null` | — (required) |
| `format` / `precision` | | `'decimal'` / per format |
| `order` | `'latlon' \| 'lonlat'` | `'latlon'` |
| `label` / `aria-label` | `string` | — |
| `placeholder` | `string` | `'9.80°N 75.90°E'` |
| `invalidMessage` | `string` | explains the accepted forms |
| `disabled`, `id`, `className` | | |

## `BboxEditor`

North, west, east and south laid out as a compass. Only valid boxes are emitted;
otherwise the failed rule is shown:

- every edge is a number;
- latitudes within ±90, longitudes within ±180;
- south below north;
- west below east, unless `allowAntimeridian` (then west > east crosses 180°).

`onUseCurrentView` is a callback returning a box — typically the map's current
bounds — so the package stays free of any map dependency. Below the fields, the
box's spherical area is shown (`boundsAreaKm2`).

| Prop | Type | Default |
| --- | --- | --- |
| `value` / `onChange` | `Bounds \| null` / `(bounds) => void` | — (required) |
| `onUseCurrentView` | `() => Bounds \| null` | — |
| `allowAntimeridian` | `boolean` | `false` |
| `precision` | `number` | `3` |
| `showArea` | `boolean` | `true` |
| `label`, `disabled`, `className` | | |

`validateBounds(bounds, options)` exposes the same rules for use elsewhere.
