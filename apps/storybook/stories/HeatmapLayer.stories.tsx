import type { Meta, StoryObj } from '@storybook/react-vite';
import { HeatmapLayer } from '@hridayanp/heatmap-layer';
import type { GeoJsonFeatureCollection } from '@hridayanp/geo-utils';
import { DemoMap } from './demo/DemoMap';
import { PALETTES, makeRandom } from './demo/data';
import { CONVECTIVE_VIEW, loadObservations } from './demo/assets';
import { useAsset } from './demo/useAsset';

/** Clustered points with an intensity property — strikes around storm cells. */
function makeStrikes(count = 1500): GeoJsonFeatureCollection {
  const random = makeRandom(17);
  const cells = [
    [90.4, 24.1, 0.5],
    [92.8, 26.2, 0.35],
    [93.9, 24.6, 0.6],
    [89.3, 26.8, 0.3],
  ] as const;
  const gaussian = () => Math.sqrt(-2 * Math.log(random() + 1e-9)) * Math.cos(2 * Math.PI * random());
  return {
    type: 'FeatureCollection',
    features: Array.from({ length: count }, (_, i) => {
      const [lng, lat, spread] = cells[i % cells.length]!;
      return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [lng + gaussian() * spread, lat + gaussian() * spread * 0.8] },
        properties: { peakCurrent: Math.round(5 + random() * 115) },
      };
    }),
  };
}

const STRIKES = makeStrikes();

const meta = {
  title: 'Geospatial/Heatmap Layer',
  component: HeatmapLayer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
A point-density heatmap computed on the GPU by MapLibre.

**Installation**

\`\`\`bash
npm install @hridayanp/heatmap-layer @hridayanp/map-container maplibre-gl react
\`\`\`

### When to use it

For the *shape* of a distribution — where reports cluster, where lightning
struck — when the points are too many to read individually. The kernel is in
screen pixels, so the surface changes as the reader zooms. For a statistically
defined surface with a chosen bandwidth in kilometres, compute \`kernelDensity\`
from \`hotspot-analysis\` and draw it with \`RasterLayer\`.

### Weighting

Without \`weightProperty\` every point counts once and the surface is plain
density. With it, \`weightDomain\` maps the property's range onto weights 0–1.

### Colour

The lowest ramp stop is always rendered transparent; otherwise the ramp's first
colour would cover the whole map. \`pointsFromZoom\` cross-fades to individual
points where the density surface stops being useful.
`,
      },
    },
  },
  argTypes: {
    colorScale: { control: 'object' },
    radius: { control: 'object' },
    intensity: { control: 'object' },
  },
} satisfies Meta<typeof HeatmapLayer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Density: Story = {
  args: { opacity: 0.8 },
  render: (args) => (
    <DemoMap note="1,500 synthetic lightning strikes, counted equally.">
      <HeatmapLayer {...args} data={STRIKES} />
    </DemoMap>
  ),
};

export const Weighted: Story = {
  args: { weightProperty: 'peakCurrent', weightDomain: [0, 120], colorScale: [...PALETTES.magma], intensity: 1.4 },
  render: (args) => (
    <DemoMap note="Each strike weighted by its peak current (0–120 kA).">
      <HeatmapLayer {...args} data={STRIKES} />
    </DemoMap>
  ),
};

export const PointsAtHighZoom: Story = {
  name: 'Points at high zoom',
  args: { pointsFromZoom: 7.5, radius: [[3, 10], [8, 30]] },
  render: (args) => (
    <DemoMap zoom={7} note="Zoom past 7.5 and the surface hands over to the individual points.">
      <HeatmapLayer {...args} data={STRIKES} />
    </DemoMap>
  ),
};

export const Observations: Story = {
  name: 'Sample observations',
  args: { colorScale: [...PALETTES.ocean], radius: [[5, 6], [9, 20]] },
  render: function Render(args) {
    const { value } = useAsset(loadObservations);
    return (
      <DemoMap center={CONVECTIVE_VIEW.center} zoom={CONVECTIVE_VIEW.zoom} note="Density of the 3,190 sample observation points.">
        <HeatmapLayer {...args} data={value} />
      </DemoMap>
    );
  },
};

export const Empty: Story = {
  args: {},
  render: (args) => (
    <DemoMap note="null data renders nothing and throws nothing.">
      <HeatmapLayer {...args} data={null} />
    </DemoMap>
  ),
};
