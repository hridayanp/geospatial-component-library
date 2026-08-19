import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  MapContainer,
  createBlankStyle,
  type MapContainerHandle,
} from '@hridayanp/map-container';
import { VectorLayer } from '@hridayanp/vector-layer';
import type { ViewState } from '@hridayanp/geo-utils';
import { DemoMap } from './demo/DemoMap';
import { DEMO_BASEMAP, DEMO_BOUNDS, DEMO_CENTER, makePolygons } from './demo/data';

const meta = {
  title: 'Geospatial/Map Container',
  component: MapContainer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
The composition root. \`MapContainer\` owns a MapLibre instance, the camera and
a React context; everything else in the library attaches to it.

**Installation**

\`\`\`bash
npm install @hridayanp/map-container maplibre-gl react react-dom
\`\`\`

**What it deliberately does not do**

It has no notion of what is drawn on it, where data comes from, or what the map
is *for*. That is what makes the same component usable for a weather overlay, a
logistics view and a coverage map.

**A note on the default style**

The default \`mapStyle\` renders a blank background and makes **no network
request**. Supply your own style — or use \`createRasterStyle(tiles, { attribution })\`
— to get a basemap. This keeps the component usable offline and in tests, and
avoids silently fetching tiles a host never agreed to.
        `,
      },
    },
  },
  argTypes: {
    center: { control: 'object', description: '[longitude, latitude]' },
    zoom: { control: { type: 'range', min: 0, max: 18, step: 0.25 } },
    bearing: { control: { type: 'range', min: 0, max: 360, step: 1 } },
    pitch: { control: { type: 'range', min: 0, max: 60, step: 1 } },
    interactive: { control: 'boolean' },
    projection: { control: 'inline-radio', options: ['mercator', 'globe'] },
    attributionControl: { control: 'boolean' },
    cursor: { control: 'text' },
  },
} satisfies Meta<typeof MapContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The smallest useful map: a basemap style, a centre and a zoom. */
export const Basic: Story = {
  args: {
    center: DEMO_CENTER,
    zoom: 5.6,
    mapStyle: DEMO_BASEMAP as never,
  },
  render: (args) => (
    <div className="demo-map">
      <MapContainer {...args} />
    </div>
  ),
};

/** With no `mapStyle`, nothing is fetched and the map is a plain background. */
export const BlankDefaultStyle: Story = {
  args: { center: DEMO_CENTER, zoom: 5 },
  render: (args) => (
    <div>
      <p className="demo-note">
        The library default. No tiles are requested — useful offline, in tests,
        and any time data matters more than context.
      </p>
      <div className="demo-map demo-map--short">
        <MapContainer {...args} mapStyle={createBlankStyle('#0b1220')}>
          <VectorLayer data={makePolygons()} fill="#1e293b" stroke="#38bdf8" />
        </MapContainer>
      </div>
    </div>
  ),
};

/** `bounds` fits an extent instead of setting a centre and zoom. */
export const FitBounds: Story = {
  args: { bounds: DEMO_BOUNDS, fitBoundsPadding: 40 },
  render: (args) => (
    <DemoMap
      note="Passing `bounds` fits the extent on mount, and re-fits whenever it changes."
      {...args}
      center={undefined}
      zoom={undefined}
    >
      <VectorLayer data={makePolygons()} fill={false} stroke="#38bdf8" />
    </DemoMap>
  ),
};

/**
 * `onMove` reports the camera continuously; `onMoveEnd` only once it settles.
 * Prefer the latter for anything expensive.
 */
export const CameraEvents: Story = {
  args: {},
  render: () => {
    const [view, setView] = useState<ViewState | null>(null);
    return (
      <div>
        <DemoMap
          note="Pan and zoom the map — the readout below is driven by onMove."
          size="short"
          onMove={setView}
        >
          <VectorLayer data={makePolygons()} fill="#1e293b88" stroke="#38bdf8" />
        </DemoMap>
        <div className="demo-surface" style={{ marginTop: 12 }}>
          <div className="demo-readout">
            {view
              ? `center  ${view.center[0].toFixed(3)}, ${view.center[1].toFixed(3)}
zoom    ${view.zoom.toFixed(2)}
bearing ${(view.bearing ?? 0).toFixed(1)}
pitch   ${(view.pitch ?? 0).toFixed(1)}`
              : 'Move the map to see its camera state.'}
          </div>
        </div>
      </div>
    );
  },
};

/** Driving the camera imperatively through the component's ref. */
export const ImperativeCamera: Story = {
  args: {},
  render: () => {
    const ref = useRef<MapContainerHandle>(null);
    return (
      <div>
        <p className="demo-note">
          <code className="demo-code">fitBounds</code>,{' '}
          <code className="demo-code">flyTo</code> and{' '}
          <code className="demo-code">resize</code> are exposed on the ref, for
          the cases where a camera change is an action rather than state.
        </p>
        <div className="gcl-row" style={{ marginBottom: 10 }}>
          <button
            className="gcl-button gcl-button--outline"
            onClick={() => ref.current?.fitBounds(DEMO_BOUNDS)}
          >
            Fit domain
          </button>
          <button
            className="gcl-button gcl-button--outline"
            onClick={() => ref.current?.flyTo({ center: [90.4, 25.6], zoom: 8 })}
          >
            Fly to Zone A
          </button>
        </div>
        <div className="demo-map demo-map--short">
          <MapContainer
            ref={ref}
            center={DEMO_CENTER}
            zoom={5.2}
            mapStyle={DEMO_BASEMAP as never}
          >
            <VectorLayer data={makePolygons()} fill="#1e293b88" stroke="#38bdf8" />
          </MapContainer>
        </div>
      </div>
    );
  },
};

/** A static map: no dragging, no zooming, no rotation. */
export const NonInteractive: Story = {
  args: { interactive: false, center: DEMO_CENTER, zoom: 5.4 },
  render: (args) => (
    <DemoMap
      note="Useful for thumbnails, print output and anywhere a map is an illustration rather than a tool."
      {...args}
    >
      <VectorLayer data={makePolygons()} fill="#1e293b88" stroke="#38bdf8" />
    </DemoMap>
  ),
};

/** Globe projection, on MapLibre 5 and later. */
export const GlobeProjection: Story = {
  args: { projection: 'globe', center: DEMO_CENTER, zoom: 2.4 },
  render: (args) => (
    <DemoMap
      note="Applied defensively — on a MapLibre version without setProjection, the prop is ignored with a warning rather than throwing."
      {...args}
    >
      <VectorLayer data={makePolygons()} fill="#1e293b88" stroke="#38bdf8" />
    </DemoMap>
  ),
};
