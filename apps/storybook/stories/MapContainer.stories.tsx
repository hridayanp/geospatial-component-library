import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  MapContainer,
  createBlankStyle,
  type MapContainerHandle,
} from '@hridayanp/map-container';
import { VectorLayer } from '@hridayanp/vector-layer';
import { RasterLayer } from '@hridayanp/raster-layer';
import type { ViewState } from '@hridayanp/geo-utils';
import { DemoMap } from './demo/DemoMap';
import { DEMO_BASEMAP, PALETTES } from './demo/data';
import {
  ASSET_FRAME_KEYS,
  CONVECTIVE_BOUNDS,
  CONVECTIVE_VIEW,
  loadConvectiveRaster,
  loadObservations,
} from './demo/assets';
import { useAsset } from './demo/useAsset';

const meta = {
  title: 'Geospatial/Map Container',
  component: MapContainer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
The composition root of the library. \`MapContainer\` owns a MapLibre GL map
instance, manages its view state, and publishes a React context through which
every other layer package resolves the map it renders into.

**Installation**

\`\`\`bash
npm install @hridayanp/map-container maplibre-gl react react-dom
\`\`\`

### Responsibilities

The component owns map construction and disposal, view state, style application
and reload recovery, and container resize observation. Source and layer
registration belongs to the layer packages, through \`useMapSourceLayers\`; data
retrieval, tile hosting, credentials and basemap selection policy remain with
the consuming application.

It holds no knowledge of what is drawn on the map or what the map depicts, which
is what makes the same component serviceable for a meteorological overlay, a
logistics view and a network-coverage map.

### Rendering model

The component renders two sibling elements: one owned by MapLibre, whose
children React never reconciles, and one absolutely positioned overlay for
legends, controls and readouts. The overlay declares \`pointer-events: none\` so
map panning stays available between panels; each panel re-enables pointer
interaction for its own subtree.

Rendering is Web Mercator (EPSG:3857) unless \`projection="globe"\` is set on
MapLibre 5. Web Mercator is undefined at the poles, so latitude is effectively
bounded at ±85.051129°.

### View state

\`center\`, \`zoom\`, \`bearing\` and \`pitch\` are controlled props; \`bounds\`
fits an extent instead and re-fits on change. Controlled updates apply a
sub-pixel threshold before issuing a camera change, so a controlled \`center\`
does not compete with an in-progress user gesture.

\`onMove\` reports the camera on every animation frame during a gesture;
\`onMoveEnd\` reports once it settles. Prefer the latter for any handler doing
non-trivial work. Callbacks are held in a ref internally, so passing an inline
arrow function does not re-subscribe the underlying MapLibre listener.

### Map context

\`\`\`ts
interface MapContextValue {
  map: MapLibreMap | null;
  ready: boolean;        // style loaded; sources may be added
  styleVersion: number;  // increments once per style, not per style mutation
}
\`\`\`

\`useMap()\` throws outside a \`MapContainer\`, deliberately: a layer that
silently renders nothing is harder to diagnose than one that reports why.
\`useMapOptional()\` returns \`null\` instead.

MapLibre discards every source and style layer added on top of a style when
\`setStyle\` is called. \`styleVersion\` increments once per loaded style, so an
effect that lists it re-registers automatically after a basemap change.

### Style specifications

\`mapStyle\` defaults to a background-only style specification and issues no
network request until a basemap is supplied — which keeps the component viable
offline, in test environments, and wherever an unattributed outbound request is
unacceptable. \`createBlankStyle\`, \`createRasterStyle\` and
\`withPMTilesOutline\` construct valid specifications; any MapLibre
\`StyleSpecification\` or a URL resolving to one is accepted.

### Geospatial considerations

\`center\` is \`[longitude, latitude]\` in decimal degrees, and every extent is
\`[west, south, east, north]\`, both EPSG:4326. No reprojection is performed by
this library; data in a projected CRS must be transformed upstream.
        `,
      },
    },
  },
  argTypes: {
    center: { control: 'object', description: '[longitude, latitude], EPSG:4326' },
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

/** A style specification, a centre and a zoom level. */
export const Basic: Story = {
  args: {
    center: CONVECTIVE_VIEW.center,
    zoom: CONVECTIVE_VIEW.zoom,
    mapStyle: DEMO_BASEMAP as never,
  },
  render: (args) => {
    const { value: raster } = useAsset(loadConvectiveRaster);
    return (
      <div className="demo-map">
        <MapContainer {...args}>
          <RasterLayer
            data={raster}
            frameKey={ASSET_FRAME_KEYS.convective}
            colorScale={[...PALETTES.heat]}
            min={0}
            max={50}
            opacity={0.85}
          />
        </MapContainer>
      </div>
    );
  },
};

/**
 * The default style is a background only. No tile request is issued until a
 * basemap is supplied.
 */
export const BlankDefaultStyle: Story = {
  args: { center: CONVECTIVE_VIEW.center, zoom: 5 },
  render: (args) => {
    const { value: observations } = useAsset(loadObservations);
    return (
      <div>
        <p className="demo-note">
          Appropriate offline, in test environments, and wherever the data
          matters more than the geographic context. Layers render identically
          against a blank background.
        </p>
        <div className="demo-map demo-map--short">
          <MapContainer {...args} mapStyle={createBlankStyle('#0b1220')}>
            <VectorLayer
              data={observations}
              pointRadius={2.5}
              pointColor="#38bdf8"
              pointStrokeWidth={0}
            />
          </MapContainer>
        </div>
      </div>
    );
  },
};

/**
 * `bounds` fits an extent on mount instead of applying a centre and zoom, and
 * re-fits whenever the extent changes.
 */
export const FitBounds: Story = {
  args: { bounds: CONVECTIVE_BOUNDS, fitBoundsPadding: 40 },
  render: (args) => {
    const { value: raster } = useAsset(loadConvectiveRaster);
    return (
      <DemoMap
        note="The extent is the georeferenced footprint of assets/raster.tif, read from its ModelTiepoint and ModelPixelScale tags."
        {...args}
        center={undefined}
        zoom={undefined}
      >
        <RasterLayer
          data={raster}
          frameKey={ASSET_FRAME_KEYS.convective}
          colorScale={[...PALETTES.viridis]}
          min={0}
          max={50}
          opacity={0.85}
        />
      </DemoMap>
    );
  },
};

/**
 * `onMove` reports view state continuously during a gesture; `onMoveEnd`
 * reports once the camera settles.
 */
export const CameraEvents: Story = {
  args: {},
  render: () => {
    const { value: observations } = useAsset(loadObservations);
    const [view, setView] = useState<ViewState | null>(null);
    return (
      <div>
        <DemoMap
          {...CONVECTIVE_VIEW}
          note="Pan and zoom the map. The readout is driven by onMove, which fires on every animation frame of the gesture."
          size="short"
          onMove={setView}
        >
          <VectorLayer
            data={observations}
            pointRadius={2.5}
            pointColor="#38bdf8"
            pointStrokeWidth={0}
            opacity={0.7}
          />
        </DemoMap>
        <div className="demo-surface" style={{ marginTop: 12 }}>
          <div className="demo-readout">
            {view
              ? `center  ${view.center[0].toFixed(3)}, ${view.center[1].toFixed(3)}
zoom    ${view.zoom.toFixed(2)}
bearing ${(view.bearing ?? 0).toFixed(1)}
pitch   ${(view.pitch ?? 0).toFixed(1)}`
              : 'Move the map to read its view state.'}
          </div>
        </div>
      </div>
    );
  },
};

/**
 * Some camera changes are actions rather than state. `MapContainerHandle`
 * exposes `fitBounds`, `flyTo`, `resize` and `getMap`.
 */
export const ImperativeCamera: Story = {
  args: {},
  render: () => {
    const ref = useRef<MapContainerHandle>(null);
    const { value: raster } = useAsset(loadConvectiveRaster);
    return (
      <div>
        <p className="demo-note">
          <code className="demo-code">getMap()</code> returns the underlying
          MapLibre instance, so any capability the component does not surface
          remains directly available.
        </p>
        <div className="gcl-row" style={{ marginBottom: 10 }}>
          <button
            className="gcl-button gcl-button--outline"
            onClick={() => ref.current?.fitBounds(CONVECTIVE_BOUNDS, { padding: 40 })}
          >
            Fit raster extent
          </button>
          <button
            className="gcl-button gcl-button--outline"
            onClick={() => ref.current?.flyTo({ center: [86.2, 23.4], zoom: 7 })}
          >
            Fly to sub-region
          </button>
        </div>
        <div className="demo-map demo-map--short">
          <MapContainer
            ref={ref}
            center={CONVECTIVE_VIEW.center}
            zoom={CONVECTIVE_VIEW.zoom}
            mapStyle={DEMO_BASEMAP as never}
          >
            <RasterLayer
              data={raster}
              frameKey={ASSET_FRAME_KEYS.convective}
              colorScale={[...PALETTES.heat]}
              min={0}
              max={50}
              opacity={0.85}
            />
          </MapContainer>
        </div>
      </div>
    );
  },
};

/** `interactive={false}` disables every gesture handler on the map. */
export const NonInteractive: Story = {
  args: {
    interactive: false,
    center: CONVECTIVE_VIEW.center,
    zoom: CONVECTIVE_VIEW.zoom,
  },
  render: (args) => {
    const { value: raster } = useAsset(loadConvectiveRaster);
    return (
      <DemoMap
        note="Appropriate for thumbnails, print output, and any context where the map is an illustration rather than an instrument."
        {...args}
      >
        <RasterLayer
          data={raster}
          frameKey={ASSET_FRAME_KEYS.convective}
          colorScale={[...PALETTES.magma]}
          min={0}
          max={50}
          opacity={0.85}
        />
      </DemoMap>
    );
  },
};

/**
 * Globe projection, available on MapLibre 5 and later. The prop is applied once
 * the style has loaded, since `setProjection` requires it.
 */
export const GlobeProjection: Story = {
  args: { projection: 'globe', center: CONVECTIVE_VIEW.center, zoom: 2.4 },
  render: (args) => {
    const { value: observations } = useAsset(loadObservations);
    return (
      <DemoMap
        note="Applied defensively: on a MapLibre version without setProjection the prop is ignored with a warning rather than raising. A style replacement re-applies it, because the incoming style carries its own projection."
        {...args}
      >
        <VectorLayer
          data={observations}
          pointRadius={2}
          pointColor="#38bdf8"
          pointStrokeWidth={0}
        />
      </DemoMap>
    );
  },
};
