# @hridayanp/geo-hover

Hover, picking and value inspection for maps.

## Installation

```bash
npm install @hridayanp/geo-hover @hridayanp/map-container maplibre-gl react react-dom
```



This package renders UI, so import the stylesheet once anywhere in your app:

```ts
import '@hridayanp/ui/styles.css';
```

Every colour, radius and font is a CSS custom property — override the variables
to retheme, and set `data-gcl-theme="light"` or `"dark"` on any ancestor to
switch modes.


## Two independent capabilities

- **Feature picking** — pass `layerIds` and the hook queries those layers for
  rendered features under the pointer.
- **Raster probing** — pass a `RasterData` and it samples the value at the
  cursor. This reads the array your application already has in memory: no round
  trip, no second decode, no server.

Use either, or both.

## Usage

```tsx
<GeoHover
  layerIds={['sites-hit']}
  raster={raster}
  sampling="bilinear"
  sections={(state) => [
    {
      title: 'Reading',
      accentColor: '#38bdf8',
      rows: [{ label: 'Value', value: state.value, unit: 'mm' }],
    },
  ]}
/>
```

## Where domain knowledge lives

`sections` turns raw hover state into card content — which properties matter,
what to call them, what units they are in. That function is the one place the
library expects to know what your data means, and it lives in your application
rather than in the package.

## The hook, for full control

```tsx
import { useMapHover } from '@hridayanp/geo-hover';

const hover = useMapHover({ layerIds: ['sites-point'], raster });
// { x, y, lngLat, features, value } | null
```

`null` when there is nothing under the pointer — exactly the shape a tooltip
wants.

## Why the card is portalled

Straight to `document.body`, positioned `fixed`. A tooltip rendered inside the
map gets clipped by the first ancestor with `overflow: hidden`, which is the
most common failure in map UIs. It also flips and clamps against the viewport
edges, so inspecting data near the edge of the screen still works.

`GeoHoverCard` can be used entirely on its own, with coordinates you supply.

## Sampling modes

`'nearest'` (default) returns a value that genuinely exists in the source —
right for classed data and for readouts where users expect to see a real
measurement. `'bilinear'` interpolates, matching what the smoothed rendering
actually shows.

## Performance

`queryRenderedFeatures` runs on every pointer move. **Always scope `layerIds`**
to the layers you care about; querying everything on a busy map is noticeably
expensive. Raster probing is a plain array read and costs nothing by comparison.

## Documentation

Interactive examples for every prop live in the workspace Storybook:

```bash
npm run storybook
```

## License

MIT
