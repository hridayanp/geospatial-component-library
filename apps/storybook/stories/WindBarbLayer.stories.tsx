import { useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { WindBarbLayer, createBarbImage } from '@hridayanp/wind-barb-layer';
import { RasterLayer } from '@hridayanp/raster-layer';
import { DemoMap, DemoSurface } from './demo/DemoMap';
import { PALETTES, makeWindField, makeWindPoints } from './demo/data';
import { WIND_VIEW, loadWindField, loadWindSpeedRaster } from './demo/assets';
import { useAsset } from './demo/useAsset';

const FIELD = makeWindField({ maxSpeed: 60 });
const POINTS = { kind: 'points' as const, data: makeWindPoints(60), speedProperty: 'wind_speed_kt', directionProperty: 'wind_dir_deg' };

const meta = {
  title: 'Geospatial/Wind Barb Layer',
  component: WindBarbLayer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Wind barbs and direction arrows, drawn by MapLibre as a symbol layer.

**Installation**

\`\`\`bash
npm install @hridayanp/wind-barb-layer @hridayanp/map-container maplibre-gl react
\`\`\`

### Data

\`data\` takes the same shapes as \`WindParticleLayer\`: \`{ kind: 'field' }\` with
\`u\`/\`v\` grids, or \`{ kind: 'points' }\` with GeoJSON carrying a speed and a
direction. One object drives particles and barbs alike. \`unit\` converts the
input speed to knots, the unit barbs are drawn in.

### Convention

Speeds round to the nearest 5 kt; a pennant is 50 kt, a full feather 10 kt and a
half feather 5 kt; a lone half feather is set in from the tip; calm is a circle.
The shaft points to where the wind comes **from**. Feathers sit on the left of
the shaft in the northern hemisphere and mirror in the southern;
\`hemisphere="auto"\` picks per barb.

### Rendering

Icons are signed-distance-field images generated in the browser on first use, so
one image per speed serves any \`color\`, any \`colorStops\` and a halo. Nothing
depends on deck.gl. Gridded input is decimated to \`maxBarbs\` symbols, and
MapLibre's collision detection hides overlapping barbs unless \`allowOverlap\`.
`,
      },
    },
  },
  argTypes: {
    color: { control: 'color' },
    colorStops: { control: 'object' },
    mode: { control: 'inline-radio', options: ['barb', 'arrow'] },
    hemisphere: { control: 'inline-radio', options: ['auto', 'north', 'south'] },
  },
} satisfies Meta<typeof WindBarbLayer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Barbs: Story = {
  args: { maxBarbs: 300, size: 1, color: '#e2e8f0' },
  render: (args) => (
    <DemoMap note="A gridded vortex decimated to about 300 barbs.">
      <WindBarbLayer {...args} data={FIELD} />
    </DemoMap>
  ),
};

export const ColouredBySpeed: Story = {
  name: 'Coloured by speed',
  args: {
    maxBarbs: 300,
    colorStops: [
      [0, '#38bdf8'],
      [20, '#22c55e'],
      [35, '#facc15'],
      [50, '#ef4444'],
    ],
  },
  render: (args) => (
    <DemoMap note="colorStops map knots onto colour; the halo keeps light barbs legible over the basemap.">
      <WindBarbLayer {...args} data={FIELD} />
    </DemoMap>
  ),
};

export const Arrows: Story = {
  args: { mode: 'arrow', maxBarbs: 400, color: '#7dd3fc', arrowScale: [0.4, 1.1] },
  render: (args) => (
    <DemoMap note="Arrows point downwind and scale with speed.">
      <WindBarbLayer {...args} data={FIELD} />
    </DemoMap>
  ),
};

export const FromObservations: Story = {
  name: 'From observations',
  args: { allowOverlap: true },
  render: (args) => (
    <DemoMap note="Station observations with speed and direction properties.">
      <WindBarbLayer {...args} data={POINTS} />
    </DemoMap>
  ),
};

export const OverWindSpeed: Story = {
  name: 'Over a wind-speed raster',
  args: { maxBarbs: 450, unit: 'kt', color: '#f8fafc' },
  render: function Render(args) {
    const field = useAsset(loadWindField);
    const speed = useAsset(loadWindSpeedRaster);
    return (
      <DemoMap center={WIND_VIEW.center} zoom={WIND_VIEW.zoom} note="Barbs from the sample wind field over its speed raster.">
        <RasterLayer data={speed.value} colorScale={[...PALETTES.magma]} opacity={0.8} />
        <WindBarbLayer {...args} data={field.value} />
      </DemoMap>
    );
  },
};

export const Glyphs: Story = {
  name: 'Barb glyphs',
  render: function Render() {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
      const canvas = ref.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) return;
      const speeds = [0, 5, 10, 15, 25, 50, 65, 105];
      context.clearRect(0, 0, canvas.width, canvas.height);
      speeds.forEach((speed, i) => {
        const image = createBarbImage(speed);
        if (!image) return;
        // Render the distance field as a hard-edged mask, as MapLibre would.
        const pixels = new ImageData(image.width, image.height);
        for (let p = 0; p < image.width * image.height; p++) {
          const inside = image.data[p * 4 + 3]! >= 192;
          pixels.data[p * 4] = 226;
          pixels.data[p * 4 + 1] = 232;
          pixels.data[p * 4 + 2] = 240;
          pixels.data[p * 4 + 3] = inside ? 255 : 0;
        }
        context.putImageData(pixels, i * image.width, 0);
      });
    }, []);
    return (
      <DemoSurface note="0, 5, 10, 15, 25, 50, 65 and 105 kt — generated in the browser, as the layer does on demand.">
        <canvas ref={ref} width={128 * 8} height={128} style={{ width: '100%', maxWidth: 1024, background: '#0b1220', borderRadius: 8 }} />
      </DemoSurface>
    );
  },
};
