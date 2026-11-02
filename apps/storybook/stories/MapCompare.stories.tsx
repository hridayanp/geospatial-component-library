import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CompareMaps, MapGrid } from '@hridayanp/map-compare';
import { RasterLayer } from '@hridayanp/raster-layer';
import { VectorLayer } from '@hridayanp/vector-layer';
import { GeoLegend } from '@hridayanp/geo-legend';
import { PALETTES, DEMO_BASEMAP } from './demo/data';
import {
  ASSET_FRAME_KEYS,
  CONVECTIVE_VIEW,
  loadConvectiveRaster,
  loadObservations,
} from './demo/assets';
import { useAsset } from './demo/useAsset';
import { deriveRasterSequence } from './demo/derive';

const meta = {
  title: 'Comparison/Map Compare',
  component: CompareMaps,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Swipe and side-by-side comparison of synchronised MapLibre views, and grids of
small multiples over one extent.

**Installation**

\`\`\`bash
npm install @hridayanp/map-compare @hridayanp/map-container maplibre-gl react
import '@hridayanp/ui/styles.css';
\`\`\`

### Responsibilities

The component owns pane layout, view-state synchronisation and divider
interaction. What each pane renders, and the data behind it, remain with the
consuming application — each pane is an ordinary \`MapContainer\`, so the layers
inside a comparison are the same components used anywhere else and have no
knowledge that they are being compared.

### Rendering model

The revealed pane keeps its **full viewport** and is clipped with
\`clip-path\`. Both panes therefore render the same extent at the same scale, and
the divider changes only how much of the second is visible. Resizing the second
pane instead would give the two different aspect ratios, which is the failure the
comparison exists to avoid.

### View-state synchronisation

Panning or zooming either pane moves both. Comparison is only valid when the
panes show the same ground at the same scale, so this is not a convenience — an
unsynchronised comparison invites the reader to attribute a difference in framing
to a difference in the data.

Two properties make it correct rather than merely functional. Followers are moved
with \`jumpTo\` rather than \`easeTo\`, because an animated follower lags the
leader by the animation duration and the panes would show different ground during
a drag. And a re-entrancy guard stops a follower's own \`move\` event propagating
back to the leader, which would otherwise oscillate until the gesture ends and,
on three or more panes, compound into visible stutter.

### Interaction model

The divider is a \`separator\` in the accessibility tree and responds to the
arrow keys, \`Home\`, \`End\` and \`Enter\`/\`Space\`. A swipe control operable
only by dragging is unusable for keyboard and switch users, and a comparison map
is often the only place a particular fact is presented. Dragging uses pointer
capture, so a fast drag does not detach when the cursor outruns the handle.

\`position\` is controllable, with \`defaultPosition\` for uncontrolled use.

### Interpretation

Every pane must share one colour domain. Passing a different \`min\`/\`max\` to
each produces a comparison in which a difference in colour may mean a difference
in scaling rather than in the data — the same failure mode as an unfixed domain
across an animated sequence, and harder to notice because the panes are adjacent.

### Data used in these stories

\`assets/raster.tif\`, decoded once and used to derive a temporal sequence
whose first and last steps stand in for two epochs. Both panes are given the same
domain and the same ramp.

### Performance

Each pane is an independent MapLibre instance with its own WebGL context.
Browsers cap live contexts — commonly around sixteen — and discard the oldest
when the cap is exceeded, blanking a pane that is still on screen. Beyond roughly
six panes in a \`MapGrid\`, paginate the facets.
        `,
      },
    },
  },
  argTypes: {
    mode: { control: 'inline-radio', options: ['swipe', 'side-by-side'] },
    orientation: { control: 'inline-radio', options: ['vertical', 'horizontal'] },
    defaultPosition: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    zoom: { control: { type: 'range', min: 2, max: 12, step: 0.25 } },
    before: { control: false },
    after: { control: false },
  },
} satisfies Meta<typeof CompareMaps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two epochs of one band, revealed by a draggable divider. */
export const Swipe: Story = {
  args: {
    mode: 'swipe',
    orientation: 'vertical',
    defaultPosition: 0.5,
    beforeLabel: '13:00 UTC',
    afterLabel: '20:30 UTC',
    before: null,
    after: null,
  },
  render: (args) => {
    const { value: base } = useAsset(loadConvectiveRaster);
    const frames = useMemo(
      () => (base ? deriveRasterSequence(base, 16) : []),
      [base],
    );
    const first = frames[0];
    const last = frames[frames.length - 1];

    return (
      <div style={{ height: 520 }}>
        <CompareMaps
          {...args}
          {...CONVECTIVE_VIEW}
          mapStyle={DEMO_BASEMAP as never}
          before={
            <RasterLayer
              data={first?.meta.raster ?? null}
              frameKey={first?.id ?? 'before'}
              colorScale={[...PALETTES.heat]}
              min={0}
              max={50}
              opacity={0.88}
            />
          }
          after={
            <>
              <RasterLayer
                data={last?.meta.raster ?? null}
                frameKey={last?.id ?? 'after'}
                colorScale={[...PALETTES.heat]}
                min={0}
                max={50}
                opacity={0.88}
              />
              <GeoLegend
                title="Convective probability"
                colorScale={[...PALETTES.heat]}
                min={0}
                max={50}
                unit="%"
                ticks={5}
                placement="bottom-right"
              />
            </>
          }
        />
      </div>
    );
  },
};

/** A horizontal split, for extents that are wider than they are tall. */
export const HorizontalSplit: Story = {
  args: {
    mode: 'swipe',
    orientation: 'horizontal',
    beforeLabel: 'Earlier',
    afterLabel: 'Later',
    before: null,
    after: null,
  },
  render: (args) => {
    const { value: base } = useAsset(loadConvectiveRaster);
    const frames = useMemo(
      () => (base ? deriveRasterSequence(base, 16) : []),
      [base],
    );
    return (
      <div style={{ height: 460 }}>
        <CompareMaps
          {...args}
          {...CONVECTIVE_VIEW}
          mapStyle={DEMO_BASEMAP as never}
          before={
            <RasterLayer
              data={frames[0]?.meta.raster ?? null}
              frameKey={frames[0]?.id ?? 'a'}
              colorScale={[...PALETTES.viridis]}
              min={0}
              max={50}
              opacity={0.88}
            />
          }
          after={
            <RasterLayer
              data={frames[frames.length - 1]?.meta.raster ?? null}
              frameKey={frames[frames.length - 1]?.id ?? 'b'}
              colorScale={[...PALETTES.viridis]}
              min={0}
              max={50}
              opacity={0.88}
            />
          }
        />
      </div>
    );
  },
};

/** Both panes fully visible, still on one view state. */
export const SideBySide: Story = {
  args: {
    mode: 'side-by-side',
    beforeLabel: 'Gridded field',
    afterLabel: 'Observations',
    before: null,
    after: null,
  },
  render: (args) => {
    const { value: raster } = useAsset(loadConvectiveRaster);
    const { value: observations } = useAsset(loadObservations);
    return (
      <div style={{ height: 460 }}>
        <CompareMaps
          {...args}
          {...CONVECTIVE_VIEW}
          mapStyle={DEMO_BASEMAP as never}
          before={
            <RasterLayer
              data={raster}
              frameKey={ASSET_FRAME_KEYS.convective}
              colorScale={[...PALETTES.heat]}
              min={0}
              max={50}
              opacity={0.88}
            />
          }
          after={
            <VectorLayer
              data={observations}
              pointRadius={[
                'interpolate',
                ['linear'],
                ['get', 'thunderstorm_prob_pct'],
                0,
                1.5,
                50,
                7,
              ]}
              pointColor={[
                'interpolate',
                ['linear'],
                ['get', 'thunderstorm_prob_pct'],
                0,
                '#0b2545',
                25,
                '#f4d35e',
                50,
                '#c1121f',
              ]}
              pointStrokeWidth={0}
              opacity={0.9}
            />
          }
        />
      </div>
    );
  },
};

/** A controlled divider, driven from application state. */
export const ControlledPosition: Story = {
  args: { before: null, after: null },
  render: () => {
    const { value: base } = useAsset(loadConvectiveRaster);
    const frames = useMemo(
      () => (base ? deriveRasterSequence(base, 16) : []),
      [base],
    );
    const [position, setPosition] = useState(0.35);

    return (
      <div>
        <label
          className="gcl-row"
          style={{ marginBottom: 10, fontSize: 12, maxWidth: 360 }}
        >
          Reveal {Math.round(position * 100)}%
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(position * 100)}
            onChange={(event) => setPosition(Number(event.target.value) / 100)}
            style={{ flex: 1 }}
          />
        </label>
        <div style={{ height: 420 }}>
          <CompareMaps
            {...CONVECTIVE_VIEW}
            mapStyle={DEMO_BASEMAP as never}
            position={position}
            onPositionChange={setPosition}
            beforeLabel="13:00 UTC"
            afterLabel="20:30 UTC"
            before={
              <RasterLayer
                data={frames[0]?.meta.raster ?? null}
                frameKey={frames[0]?.id ?? 'a'}
                colorScale={[...PALETTES.magma]}
                min={0}
                max={50}
                opacity={0.88}
              />
            }
            after={
              <RasterLayer
                data={frames[frames.length - 1]?.meta.raster ?? null}
                frameKey={frames[frames.length - 1]?.id ?? 'b'}
                colorScale={[...PALETTES.magma]}
                min={0}
                max={50}
                opacity={0.88}
              />
            }
          />
        </div>
      </div>
    );
  },
};

/**
 * Small multiples. Past two states a reader cannot hold swipe positions in mind,
 * and faceting lets every state be seen at once rather than remembered.
 */
export const SmallMultiples: Story = {
  args: { before: null, after: null },
  render: () => {
    const { value: base } = useAsset(loadConvectiveRaster);
    const frames = useMemo(
      () => (base ? deriveRasterSequence(base, 16) : []),
      [base],
    );
    const selected = useMemo(
      () => [0, 3, 6, 9, 12, 15].map((i) => frames[i]).filter(Boolean),
      [frames],
    );

    return (
      <div style={{ height: 560 }}>
        <MapGrid
          {...CONVECTIVE_VIEW}
          mapStyle={DEMO_BASEMAP as never}
          columns={3}
          panes={selected.map((frame) => ({
            id: frame!.id,
            label: frame!.label,
            content: (
              <RasterLayer
                data={frame!.meta.raster}
                frameKey={frame!.id}
                colorScale={[...PALETTES.heat]}
                min={0}
                max={50}
                opacity={0.9}
              />
            ),
          }))}
        />
      </div>
    );
  },
};
