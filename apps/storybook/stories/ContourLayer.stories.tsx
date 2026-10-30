import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ContourLayer, computeContours } from '@hridayanp/contour-layer';
import { RasterLayer } from '@hridayanp/raster-layer';
import { GeoLegend } from '@hridayanp/geo-legend';
import type { RasterData } from '@hridayanp/raster-utils';
import { DemoMap, DemoSurface } from './demo/DemoMap';
import { PALETTES, makeRaster } from './demo/data';
import { CONVECTIVE_VIEW, loadConvectiveRaster } from './demo/assets';
import { useAsset } from './demo/useAsset';

/** A smooth field rescaled into a mean-sea-level-pressure range. */
function makePressureField(): RasterData {
  const base = makeRaster({ width: 120, height: 104, blobs: 5, seed: 12 });
  const data = new Float32Array(base.data.length);
  for (let i = 0; i < data.length; i++) data[i] = 1022 - (base.data[i] as number) * 0.32;
  return { ...base, data, noData: null, unit: 'hPa' };
}

const PRESSURE = makePressureField();
const TEMPERATURE: RasterData = (() => {
  const base = makeRaster({ width: 120, height: 104, blobs: 3, seed: 3 });
  const data = new Float32Array(base.data.length);
  for (let i = 0; i < data.length; i++) data[i] = 8 + (base.data[i] as number) * 0.3;
  return { ...base, data, noData: null, unit: '°C' };
})();

const BLOBS = makeRaster({ seed: 7 });

const meta = {
  title: 'Geospatial/Contour Layer',
  component: ContourLayer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Isolines traced from a raster with marching squares — isobars, isotherms,
isohyets — and drawn by MapLibre as an ordinary GeoJSON source.

**Installation**

\`\`\`bash
npm install @hridayanp/contour-layer @hridayanp/map-container maplibre-gl react
\`\`\`

### Levels

\`interval\` and \`base\` generate levels on round numbers relative to the base —
isobars every 4 hPa through 1000, isotherms every 5 °C through 0 — wherever the
data range starts. \`levels\` gives explicit values for thresholds that carry
meaning. Every \`majorEvery\`-th level, counted from \`base\`, is an index contour:
drawn thicker and labelled.

### Geometry

The grid is contoured through **cell centres**, so a line never runs beyond the
outermost data, and cells holding NoData leave a gap rather than an invented
line. Saddles are resolved by the cell-centre average. \`smoothing\` applies
Chaikin corner-cutting so lines read as drawn isolines rather than grid
stair-steps.

### Labels

Labels need a \`glyphs\` URL in the map style. On a style without one — such as
the blank default, or the raster basemap in these stories — labels are skipped
silently rather than failing the layer.

### Computation without a map

\`computeContours\` is a pure function from \`RasterData\` to GeoJSON, so it runs
in a worker and its output renders through \`VectorLayer\` or anything else that
reads GeoJSON.
`,
      },
    },
  },
  argTypes: {
    color: { control: 'color' },
    colorScale: { control: 'object' },
    levels: { control: 'object' },
  },
} satisfies Meta<typeof ContourLayer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Isobars: Story = {
  args: { interval: 2, base: 1000, majorEvery: 5, width: 1, majorWidth: 2.2, color: '#e2e8f0' },
  render: (args) => (
    <DemoMap note="Isobars every 2 hPa anchored on 1000 hPa; every fifth line is an index contour.">
      <ContourLayer {...args} data={PRESSURE} />
    </DemoMap>
  ),
};

export const ColouredByValue: Story = {
  args: { interval: 2, base: 0, colorScale: [...PALETTES.heat], width: 1.5, majorWidth: 2.5 },
  render: (args) => (
    <DemoMap note="Each isotherm takes its colour from the ramp, matching the legend.">
      <ContourLayer {...args} data={TEMPERATURE} />
      <GeoLegend title="Temperature" unit="°C" colorScale={[...PALETTES.heat]} min={8} max={38} placement="bottom-right" />
    </DemoMap>
  ),
};

export const OverRaster: Story = {
  name: 'Over a raster',
  args: { interval: 10, base: 0, color: '#0f172a', width: 0.8, majorWidth: 1.6, majorEvery: 2 },
  render: function Render(args) {
    const { value } = useAsset(loadConvectiveRaster);
    return (
      <DemoMap center={CONVECTIVE_VIEW.center} zoom={CONVECTIVE_VIEW.zoom} note="Contours of the decoded convective-probability GeoTIFF, drawn over the same field.">
        <RasterLayer data={value} colorScale={[...PALETTES.viridis]} min={0} max={50} opacity={0.85} />
        <ContourLayer {...args} data={value} />
      </DemoMap>
    );
  },
};

export const ThresholdLevels: Story = {
  name: 'Explicit thresholds',
  args: { levels: [30, 60, 85], dasharray: [3, 2], color: '#facc15', width: 2, majorWidth: 2 },
  render: (args) => (
    <DemoMap note="Explicit levels for warning thresholds, dashed.">
      <RasterLayer data={BLOBS} colorScale={[...PALETTES.ocean]} opacity={0.7} />
      <ContourLayer {...args} data={BLOBS} />
    </DemoMap>
  ),
};

export const ComputeOnly: Story = {
  name: 'computeContours (no map)',
  render: function Render() {
    const summary = useMemo(() => {
      const contours = computeContours(PRESSURE, { interval: 4, base: 1000 });
      const byLevel = new Map<number, number>();
      for (const feature of contours.features) {
        const value = (feature.properties as { value: number }).value;
        byLevel.set(value, (byLevel.get(value) ?? 0) + 1);
      }
      return [...byLevel.entries()].map(([value, lines]) => `${value} hPa  ${lines} line${lines > 1 ? 's' : ''}`).join('\n');
    }, []);
    return (
      <DemoSurface note="The same tracing as a pure function — the output is a GeoJSON FeatureCollection.">
        <pre className="demo-readout">{summary}</pre>
      </DemoSurface>
    );
  },
};
