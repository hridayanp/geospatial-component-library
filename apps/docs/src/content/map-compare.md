## Purpose

`map-compare` presents one geographic extent under two or more renderings and
keeps them on a single view state: a swipe divider for two states, a grid of
small multiples for more.

It addresses the question a change map exists to answer — *what is different
between these two states* — and does so without letting a difference in framing
be mistaken for a difference in the data.

```bash
npm install @hridayanp/map-compare @hridayanp/map-container maplibre-gl react
```

```ts
import '@hridayanp/ui/styles.css';
```

## Responsibilities

| Concern | Owner |
| --- | --- |
| Pane layout and reveal geometry | `CompareMaps`, `MapGrid` |
| View-state synchronisation across panes | `useMapSync` |
| Divider drag, keyboard operation and position state | `useSwipeDivider` |
| What each pane renders | Host application |
| Data acquisition and epoch alignment | Host application |
| Colour domain consistency between panes | Host application |

Each pane is an ordinary `MapContainer`, so the layer components inside a
comparison are the same components used anywhere else and have no knowledge that
they are being compared.

## Basic usage

```tsx
import { CompareMaps } from '@hridayanp/map-compare';

<div style={{ height: 520 }}>
  <CompareMaps
    center={[87.2, 22.3]}
    zoom={6}
    beforeLabel="2017"
    afterLabel="2024"
    before={
      <RasterLayer data={epoch2017} frameKey="2017" colorScale={ramp}
                   min={0} max={50} />
    }
    after={
      <RasterLayer data={epoch2024} frameKey="2024" colorScale={ramp}
                   min={0} max={50} />
    }
  />
</div>
```

## Rendering model

The revealed pane keeps its **full viewport** and is clipped with `clip-path`.
Both panes therefore render the same extent at the same scale, and the divider
changes only how much of the second is visible.

Resizing the second pane instead — the intuitive implementation — gives the two
panes different aspect ratios. MapLibre fits the extent to the viewport it is
given, so a narrowed pane shows a different area at a different scale, and the
comparison silently stops being one.

In `side-by-side` mode the panes occupy a two-track grid and both render fully;
the divider is not drawn.

## View-state synchronisation

Panning or zooming either pane moves both. Comparison is only valid when the
panes show the same ground at the same scale, so this is a correctness property
rather than a convenience.

Two details make the implementation correct:

**Followers are moved with `jumpTo`, never `easeTo`.** An animated follower lags
the leader by the animation duration, so during a drag the panes would show
different ground — precisely the state synchronisation exists to prevent.

**A re-entrancy guard.** Applying a camera to a follower fires that follower's
own `move` event. Without the guard it propagates back to the leader and on to
every other pane; the maps oscillate until the gesture ends, and on three or more
panes the feedback compounds into visible stutter.

```ts
import { useMapSync } from '@hridayanp/map-compare';

useMapSync([leftMap, rightMap, insetMap], { rotation: false });
```

The hook attaches to whatever maps are present on each render, so panes may
mount and unmount freely.

## Interaction model

The divider position is a **fraction of the container**, not a pixel offset, so a
resize preserves what the reader was looking at.

| Prop | Type | Default |
| --- | --- | --- |
| `position` | `number` | — (controlled, `0..1`) |
| `defaultPosition` | `number` | `0.5` |
| `onPositionChange` | `(position: number) => void` | — |

Dragging uses pointer events with capture, covering mouse, touch and pen in one
path. Capture is what keeps the drag alive when the pointer leaves the handle —
without it a fast drag detaches the moment the cursor outruns the element, which
is the usual reason a swipe control feels unreliable.

### Keyboard operation

The handle is a `separator` in the accessibility tree and responds to:

| Key | Effect |
| --- | --- |
| `←` / `→` (or `↑` / `↓` when horizontal) | Move by one step, 2% by default |
| `Home` / `End` | Fully reveal one pane |
| `Enter` / `Space` | Recentre the divider |

A swipe control operable only by dragging is unusable for keyboard and switch
users, and a comparison map is often the only place a particular fact is
presented.

## Configuration

| Prop | Type | Default | Behaviour |
| --- | --- | --- | --- |
| `before` / `after` | `ReactNode` | — | Layers and overlays for each pane |
| `mode` | `'swipe' \| 'side-by-side'` | `'swipe'` | |
| `orientation` | `'vertical' \| 'horizontal'` | `'vertical'` | Split axis in swipe mode |
| `beforeLabel` / `afterLabel` | `ReactNode` | — | Epoch or scenario captions |
| `afterMapStyle` | `StyleSpecification \| string` | the shared `mapStyle` | Per-pane basemap |
| `onReady` | `({ before, after }) => void` | — | Both MapLibre instances, once loaded |
| `className` / `style` | | — | Applied to the container |

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
    content: (
      <RasterLayer data={byYear[year]} frameKey={year} colorScale={ramp}
                   min={0} max={50} />
    ),
  }))}
/>
```

Small multiples are the appropriate form once a comparison exceeds two states: a
reader can hold two swipe positions in mind, but not six, and faceting lets every
state be seen at once rather than remembered.

| Prop | Type | Default |
| --- | --- | --- |
| `panes` | `MapGridPane[]` | — |
| `columns` | `number` | `min(panes.length, 2)` |
| `synchronized` | `boolean` | `true` |
| `onPaneClick` | `(id: string) => void` | — |

## Integration boundaries

**Every pane must share one colour domain.** Passing a different `min`/`max` to
each produces a comparison in which a difference in colour may mean a difference
in scaling rather than in the data. It is the same failure mode as an unfixed
domain across an animated sequence, and harder to notice because the panes are
adjacent — the reader has no opportunity to observe the legend changing.

The same applies to small multiples, and more strongly: facets work because the
reader compares colour across panes without re-reading a legend.

For a quantified answer rather than a visual one, pair a comparison with
[`classified-raster`](/docs/classified-raster), which cross-tabulates the two
epochs into a transition matrix.

## Performance considerations

- Each pane is an independent MapLibre instance with its own WebGL context.
  Browsers cap live contexts — commonly around sixteen — and discard the oldest
  when the cap is exceeded, blanking a pane that is still on screen. Beyond
  roughly six panes in a `MapGrid`, paginate the facets.
- Both panes render continuously in swipe mode; the clipped one is not culled.
  A comparison is therefore about twice the rendering cost of a single map.
- Changing the split resizes each pane's canvas, so the component calls
  `resize()` on both. MapLibre sizes its canvas from the container, and without
  the explicit call the revealed pane keeps its original canvas and its content
  is scaled rather than re-rendered.

## Geospatial considerations

- `center` and every extent are EPSG:4326 `[longitude, latitude]` in decimal
  degrees, as everywhere in the library.
- Both panes render in the map's projection. Comparing two epochs at different
  projections is not supported and would not be meaningful.
- Rotation and pitch are synchronised by default; pass `{ rotation: false }` to
  `useMapSync` to share only centre and zoom.
