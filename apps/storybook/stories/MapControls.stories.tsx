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
import {
  DEMO_BASEMAP,
  DEMO_BOUNDS,
  DEMO_CENTER,
  PALETTES,
  makeRaster,
} from './demo/data';

const raster = makeRaster();

const meta = {
  title: 'Overlays/Map Controls',
  component: MapControlBar,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
The map controls that are genuinely reusable, and only those.

**Installation**

\`\`\`bash
npm install @hridayanp/map-controls @hridayanp/map-container maplibre-gl react
import '@hridayanp/ui/styles.css';
\`\`\`

**What is here**

\`ZoomControl\`, \`ResetViewControl\`, \`FullscreenControl\`, \`OpacityControl\` and
\`BasemapSwitcher\`, grouped by \`MapControlBar\`.

**What is not**

Layer pickers, site selectors, model switchers, alert panels. Those are
application concerns — they encode what an application *is*, not what a map
does, and a component library that shipped them would be shipping someone
else's product.

**Controlled by design**

\`OpacityControl\` and \`BasemapSwitcher\` are controlled. Opacity almost always
belongs to the layer the host already manages; a control holding its own copy
would immediately disagree with it.

**A note on basemap switching**

Swapping a style discards every source and layer added on top of it. Layer
packages in this library re-attach themselves automatically; anything you added
by hand has to do the same.
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

/** A standard control cluster. */
export const Basic: Story = {
  args: { placement: 'top-right', orientation: 'vertical' },
  render: (args) => (
    <DemoMap note="Controls dock to a corner and group into segmented clusters. The bar itself is transparent to pointer events, so the map stays draggable between groups.">
      <MapControlBar {...args}>
        <ZoomControl />
        <ResetViewControl bounds={DEMO_BOUNDS} />
        <FullscreenControl />
      </MapControlBar>
    </DemoMap>
  ),
};

/** Laid out horizontally. */
export const Horizontal: Story = {
  args: { placement: 'top-left', orientation: 'horizontal' },
  render: (args) => (
    <DemoMap size="short">
      <MapControlBar {...args}>
        <ZoomControl />
        <ResetViewControl view={{ center: DEMO_CENTER, zoom: 5.6 }} />
        <FullscreenControl />
      </MapControlBar>
    </DemoMap>
  ),
};

/** Opacity, controlled by the host and applied to a layer. */
export const Opacity: Story = {
  args: {},
  render: () => {
    const [opacity, setOpacity] = useState(0.85);
    return (
      <DemoMap note="The slider and the raster read the same state — which is the point of making it controlled.">
        <RasterLayer
          data={raster}
          colorScale={[...PALETTES.heat]}
          min={0}
          max={100}
          opacity={opacity}
        />
        <MapControlBar placement="top-right">
          <ZoomControl />
          <OpacityControl value={opacity} onChange={setOpacity} />
        </MapControlBar>
        <GeoLegend
          title="Intensity"
          colorScale={[...PALETTES.heat]}
          min={0}
          max={100}
          placement="bottom-right"
          footer={`Opacity ${Math.round(opacity * 100)}%`}
        />
      </DemoMap>
    );
  },
};

/** An inline opacity slider, without the popover. */
export const InlineOpacity: Story = {
  args: {},
  render: () => {
    const [opacity, setOpacity] = useState(0.6);
    return (
      <DemoMap size="short">
        <RasterLayer
          data={raster}
          colorScale={[...PALETTES.ocean]}
          min={0}
          max={100}
          opacity={opacity}
        />
        <GeoLegend
          title="Rainfall"
          colorScale={[...PALETTES.ocean]}
          min={0}
          max={120}
          unit="mm"
          placement="bottom-right"
          footer={<OpacityControl inline value={opacity} onChange={setOpacity} />}
        />
      </DemoMap>
    );
  },
};

/** Switching basemaps, with layers re-attaching automatically. */
export const Basemaps: Story = {
  args: {},
  render: () => {
    const options = [
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
    const [id, setId] = useState('osm');
    const active = options.find((option) => option.id === id)?.style;

    return (
      <DemoMap
        note="Switch the basemap and watch the raster survive it. MapLibre discards everything on a style swap; the layer packages re-attach on the next `styledata` event."
        mapStyle={active as never}
      >
        <RasterLayer
          data={raster}
          colorScale={[...PALETTES.viridis]}
          min={0}
          max={100}
          opacity={0.8}
        />
        <MapControlBar placement="top-right">
          <ZoomControl />
        </MapControlBar>
        <div className="gcl-panel--floating gcl-panel--top-left">
          <BasemapSwitcher options={options} value={id} onChange={setId} />
        </div>
      </DemoMap>
    );
  },
};

/** Every control at once. */
export const FullSet: Story = {
  args: {},
  render: () => {
    const [opacity, setOpacity] = useState(0.85);
    return (
      <DemoMap size="tall">
        <RasterLayer
          data={raster}
          colorScale={[...PALETTES.magma]}
          min={0}
          max={100}
          opacity={opacity}
        />
        <MapControlBar placement="top-right">
          <ZoomControl />
          <OpacityControl value={opacity} onChange={setOpacity} />
          <ResetViewControl bounds={DEMO_BOUNDS} />
          <FullscreenControl />
        </MapControlBar>
        <GeoLegend
          title="Intensity"
          colorScale={[...PALETTES.magma]}
          min={0}
          max={100}
          ticks={5}
          placement="bottom-right"
        />
      </DemoMap>
    );
  },
};
