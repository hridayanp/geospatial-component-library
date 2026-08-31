import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  BasemapSwitcher,
  FullscreenControl,
  MapControlBar,
  OpacityControl,
  ResetViewControl,
  ZoomControl,
} from '@hridayanp/map-controls';
import { RasterLayer } from '@hridayanp/raster-layer';
import { GeoLegend } from '@hridayanp/geo-legend';
import { createBlankStyle, createRasterStyle } from '@hridayanp/map-container';
import { DemoMap } from './demo/DemoMap';
import { DEMO_BASEMAP, PALETTES } from './demo/data';
import {
  ASSET_FRAME_KEYS,
  CONVECTIVE_BOUNDS,
  CONVECTIVE_VIEW,
  loadConvectiveRaster,
} from './demo/assets';
import { useAsset } from './demo/useAsset';

/**
 * Style specifications are constructed once at module scope. A specification
 * rebuilt on every render would change `mapStyle`'s identity and cause
 * `MapContainer` to call `setStyle` on each render, discarding and re-adding
 * every layer registered on top of it.
 */
const BASEMAPS = [
  { id: 'blank', label: 'Blank', style: createBlankStyle('#0b1220') },
  { id: 'osm', label: 'Street', style: DEMO_BASEMAP as never },
  {
    id: 'light',
    label: 'Light',
    style: createRasterStyle('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      backgroundColor: '#f8fafc',
    }),
  },
];

const meta = {
  title: 'Overlays/Map Controls',
  component: MapControlBar,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
The view-state and presentation controls common to any map: zoom, view reset,
fullscreen, layer opacity and basemap selection, together with a bar that docks
and groups them.

**Installation**

\`\`\`bash
npm install @hridayanp/map-controls @hridayanp/map-container maplibre-gl react
import '@hridayanp/ui/styles.css';
\`\`\`

### Scope

The package covers operations that are properties of a map: changing the view,
framing an extent, expanding the viewport, attenuating a layer, exchanging the
basemap.

Layer pickers, site selectors, model-run switchers and advisory panels express
an application's information architecture rather than a cartographic capability,
and are therefore outside the package's boundary. \`MapControlBar\` accepts
arbitrary children, so an application-specific control composed from
\`@hridayanp/ui\` primitives sits alongside the shipped ones and inherits the
same visual language.

### Components

\`MapControlBar\` docks and groups controls, and stays transparent to pointer
events so map panning remains available between groups.

\`ZoomControl\` tracks the map's own \`minZoom\`/\`maxZoom\` and disables each
button at the corresponding limit rather than presenting a control that produces
no effect.

\`ResetViewControl\` restores a defined view; \`bounds\` takes precedence over
\`view\`, and with neither the control restores the camera the map was mounted
with.

\`FullscreenControl\` expands the map's own container by default rather than the
document, so overlays belonging to the map expand with it. It calls
\`map.resize()\` after the transition completes — resizing during the CSS
transition captures an intermediate size and distorts the canvas.

\`OpacityControl\` renders a slider, behind a popover by default or \`inline\`
for embedding in a legend footer.

\`BasemapSwitcher\` takes \`options\` of \`{ id, label, style }\`, a \`value\`
holding the active option's id, and \`onChange(id, style)\`.

### State ownership

\`OpacityControl\` and \`BasemapSwitcher\` are fully controlled. Layer opacity
almost always belongs to the layer the host already manages — the same value is
passed to \`RasterLayer\` — and a control holding an internal copy would diverge
the moment a preset, a URL parameter or a reset action modified it.

\`ZoomControl\` and \`FullscreenControl\` are different: their state lives on the
map instance and in the browser respectively, so there is nothing for the host to
own.

### Basemap reload and layer recovery

Exchanging a style discards every source and style layer added on top of it.
This is MapLibre behaviour rather than a choice made by this library. Every layer
package here re-registers automatically on the next loaded style, through the
\`styleVersion\` counter published by \`MapContainer\`; sources and layers added
directly by the host must list \`styleVersion\` in their effect dependencies.

\`applyToMap\` defaults to \`false\` for the same reason: when the host passes
\`mapStyle\` to \`MapContainer\`, enabling it produces two writers contending for
the same map state.
        `,
      },
    },
  },
  argTypes: {
    placement: {
      control: 'select',
      options: [
        'top-left',
        'top-right',
        'top-center',
        'bottom-left',
        'bottom-right',
        'bottom-center',
      ],
    },
    orientation: { control: 'inline-radio', options: ['vertical', 'horizontal'] },
  },
} satisfies Meta<typeof MapControlBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A docked control cluster. */
export const Basic: Story = {
  args: { placement: 'top-right', orientation: 'vertical' },
  render: (args) => (
    <DemoMap {...CONVECTIVE_VIEW} note="MapControlBar docks to one of six positions and groups its children into segmented clusters. The bar is transparent to pointer events, so map panning remains available between groups.">
      <MapControlBar {...args}>
        <ZoomControl />
        <ResetViewControl bounds={CONVECTIVE_BOUNDS} />
        <FullscreenControl />
      </MapControlBar>
    </DemoMap>
  ),
};

/** `orientation="horizontal"` lays the cluster out along the x-axis. */
export const Horizontal: Story = {
  args: { placement: 'top-left', orientation: 'horizontal' },
  render: (args) => (
    <DemoMap {...CONVECTIVE_VIEW} size="short">
      <MapControlBar {...args}>
        <ZoomControl />
        <ResetViewControl view={{ center: CONVECTIVE_VIEW.center, zoom: CONVECTIVE_VIEW.zoom }} />
        <FullscreenControl />
      </MapControlBar>
    </DemoMap>
  ),
};

/** Layer opacity, owned by the application and applied to the layer. */
export const Opacity: Story = {
  args: {},
  render: () => {
    const { value: raster } = useAsset(loadConvectiveRaster);
    const [opacity, setOpacity] = useState(0.85);
    return (
      <DemoMap {...CONVECTIVE_VIEW} note="The slider and the layer read the same value. A control holding an internal copy would diverge the moment a preset, a URL parameter or a reset action modified it.">
        <RasterLayer
          data={raster}
          frameKey={ASSET_FRAME_KEYS.convective}
          colorScale={[...PALETTES.heat]}
          min={0}
          max={50}
          opacity={opacity}
        />
        <MapControlBar placement="top-right">
          <ZoomControl />
          <OpacityControl value={opacity} onChange={setOpacity} />
        </MapControlBar>
        <GeoLegend
          title="Convective probability"
          colorScale={[...PALETTES.heat]}
          min={0}
          max={50}
          unit="%"
          placement="bottom-right"
          footer={`Opacity ${Math.round(opacity * 100)}%`}
        />
      </DemoMap>
    );
  },
};

/** `inline` renders the slider directly, without the popover trigger. */
export const InlineOpacity: Story = {
  args: {},
  render: () => {
    const { value: raster } = useAsset(loadConvectiveRaster);
    const [opacity, setOpacity] = useState(0.6);
    return (
      <DemoMap {...CONVECTIVE_VIEW} size="short">
        <RasterLayer
          data={raster}
          frameKey={ASSET_FRAME_KEYS.convective}
          colorScale={[...PALETTES.ocean]}
          min={0}
          max={50}
          opacity={opacity}
        />
        <GeoLegend
          title="Convective probability"
          colorScale={[...PALETTES.ocean]}
          min={0}
          max={50}
          unit="%"
          placement="bottom-right"
          footer={<OpacityControl inline value={opacity} onChange={setOpacity} />}
        />
      </DemoMap>
    );
  },
};

/** Basemap selection, with layers re-registering automatically. */
export const Basemaps: Story = {
  args: {},
  render: () => {
    const { value: raster } = useAsset(loadConvectiveRaster);
    const [id, setId] = useState('osm');
    const active = BASEMAPS.find((option) => option.id === id)?.style;

    return (
      <DemoMap
        {...CONVECTIVE_VIEW}
        note="MapLibre discards every source and style layer when the style is replaced. Layer packages here re-register on the next loaded style, through the styleVersion counter published by MapContainer."
        mapStyle={active as never}
      >
        <RasterLayer
          data={raster}
          frameKey={ASSET_FRAME_KEYS.convective}
          colorScale={[...PALETTES.viridis]}
          min={0}
          max={50}
          opacity={0.8}
        />
        <MapControlBar placement="top-right">
          <ZoomControl />
        </MapControlBar>
        <div className="gcl-panel--floating gcl-panel--top-left">
          <BasemapSwitcher options={BASEMAPS} value={id} onChange={setId} />
        </div>
      </DemoMap>
    );
  },
};

/** The complete control set on one map. */
export const FullSet: Story = {
  args: {},
  render: () => {
    const { value: raster } = useAsset(loadConvectiveRaster);
    const [opacity, setOpacity] = useState(0.85);
    return (
      <DemoMap {...CONVECTIVE_VIEW} size="tall">
        <RasterLayer
          data={raster}
          frameKey={ASSET_FRAME_KEYS.convective}
          colorScale={[...PALETTES.magma]}
          min={0}
          max={50}
          opacity={opacity}
        />
        <MapControlBar placement="top-right">
          <ZoomControl />
          <OpacityControl value={opacity} onChange={setOpacity} />
          <ResetViewControl bounds={CONVECTIVE_BOUNDS} />
          <FullscreenControl />
        </MapControlBar>
        <GeoLegend
          title="Convective probability"
          colorScale={[...PALETTES.magma]}
          min={0}
          max={50}
          ticks={5}
          placement="bottom-right"
        />
      </DemoMap>
    );
  },
};
