# @hridayanp/map-compare

Swipe and side-by-side comparison of synchronised MapLibre views, and grids of
small multiples over one extent.

## Installation

```bash
npm install @hridayanp/map-compare @hridayanp/map-container maplibre-gl react
```

```ts
import '@hridayanp/ui/styles.css';
```

## Two maps, one view state

```tsx
import { CompareMaps } from '@hridayanp/map-compare';

<CompareMaps
  center={[87.2, 22.3]}
  zoom={6}
  beforeLabel="2017"
  afterLabel="2024"
  before={<RasterLayer data={epoch2017} frameKey="2017" colorScale={ramp} min={0} max={50} />}
  after={<RasterLayer data={epoch2024} frameKey="2024" colorScale={ramp} min={0} max={50} />}
/>;
```

Each pane is an ordinary `MapContainer`, so the layers inside a comparison are
the same components used anywhere else and have no knowledge that they are being
compared.

Panning or zooming either pane moves both; the divider changes only how much of
the second is revealed. Comparison is only valid when the panes show the same
ground at the same scale, so the synchronisation is not a convenience — an
unsynchronised comparison invites the reader to attribute a difference in framing
to a difference in the data.

## Modes

```tsx
<CompareMaps mode="swipe" />          {/* default — one viewport, a divider */}
<CompareMaps mode="side-by-side" />   {/* two viewports abreast */}
<CompareMaps orientation="horizontal" /> {/* split across, not down */}
```

## Configuration

| Prop | Type | Default | Behaviour |
| --- | --- | --- | --- |
| `before` / `after` | `ReactNode` | — | Layers and overlays for each pane |
| `mode` | `'swipe' \| 'side-by-side'` | `'swipe'` | |
| `orientation` | `'vertical' \| 'horizontal'` | `'vertical'` | Split axis in swipe mode |
| `position` | `number` | — | Controlled divider position, `0..1` |
| `defaultPosition` | `number` | `0.5` | Uncontrolled initial position |
| `onPositionChange` | `(position: number) => void` | — | |
| `beforeLabel` / `afterLabel` | `ReactNode` | — | Epoch or scenario captions |
| `afterMapStyle` | `StyleSpecification \| string` | the shared `mapStyle` | Per-pane basemap |
| `onReady` | `({ before, after }) => void` | — | Both MapLibre instances |

Every `MapContainer` prop is also accepted and applied to both panes.

## Small multiples

```tsx
import { MapGrid } from '@hridayanp/map-compare';

<MapGrid
  center={[87.2, 22.3]}
  zoom={5}
  columns={3}
  panes={years.map((year) => ({
    id: year,
    label: year,
    content: <RasterLayer data={byYear[year]} frameKey={year} colorScale={ramp} min={0} max={50} />,
  }))}
/>;
```

Small multiples are the appropriate form once a comparison exceeds two states: a
reader can hold two swipe positions in mind, but not six, and faceting lets every
state be seen at once rather than remembered.

## Interpretation

**Every pane must share one colour domain.** Passing a different `min`/`max` to
each produces a comparison in which a difference in colour may mean a difference
in scaling rather than in the data — the same failure mode as an unfixed domain
across an animated sequence, and harder to notice because the panes are adjacent.

## Implementation notes

**Clip, don't resize.** The revealed pane keeps its full viewport and is clipped
by `clip-path`, so both panes render the same extent at the same scale. Resizing
the second pane instead would give the two different aspect ratios and break the
comparison.

**`jumpTo`, never `easeTo`.** An animated follower lags the leader by the
animation duration, so during a drag the panes would show different ground —
precisely the state synchronisation exists to prevent.

**A re-entrancy guard.** Applying a camera to a follower fires that follower's
own `move` event, which would propagate back. Without the guard the maps
oscillate until the gesture ends, and on three or more panes the feedback
compounds into visible stutter.

## Accessibility

The divider is a `separator` in the accessibility tree and responds to the arrow
keys, `Home`, `End`, and `Enter`/`Space` to recentre. A swipe control operable
only by dragging is unusable for keyboard and switch users, and a comparison map
is often the only place a particular fact is presented.

The drag uses pointer capture, so a fast drag does not detach when the cursor
outruns the handle.

## Performance

Each pane is an independent MapLibre instance with its own WebGL context.
Browsers cap live contexts — commonly around sixteen — and discard the oldest
when the cap is exceeded, blanking a pane that is still on screen. Beyond roughly
six panes in a `MapGrid`, paginate the facets.

## Hooks

```ts
import { useMapSync, useSwipeDivider } from '@hridayanp/map-compare';
```

`useMapSync(maps, options)` keeps any number of MapLibre instances on one view
state. `useSwipeDivider(options)` supplies the drag and keyboard behaviour with
no layout of its own.

## Documentation

Interactive examples live in the workspace Storybook:

```bash
npm run storybook
```

## License

MIT
