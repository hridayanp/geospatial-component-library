import { useCallback, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  DataTileLayer,
  encodeTileValues,
  tileBounds,
  type DataTileLoader,
  type DataTileSample,
} from '@hridayanp/data-tile-layer';
import { GeoLegend } from '@hridayanp/geo-legend';
import { Panel } from '@hridayanp/ui';
import { DemoMap } from './demo/DemoMap';
import { PALETTES } from './demo/data';

const SIZE = 256;

/** A smooth synthetic temperature field over the globe, °C. */
function temperatureAt(lng: number, lat: number, shift = 0): number {
  return (
    28 -
    Math.abs(lat) * 0.55 +
    6 * Math.sin(((lng + shift) / 9) * Math.PI) * Math.cos((lat / 7) * Math.PI) +
    3 * Math.cos(((lng - lat) / 13) * Math.PI)
  );
}

/** Evaluate a field at every pixel of a tile. */
function tileValues(z: number, x: number, y: number, shift = 0): Float32Array {
  const [west, south, east, north] = tileBounds(z, x, y);
  const values = new Float32Array(SIZE * SIZE);
  for (let row = 0; row < SIZE; row++) {
    // Rows are evenly spaced in Mercator, not in latitude; good enough for a demo field.
    const lat = north - ((row + 0.5) / SIZE) * (north - south);
    for (let column = 0; column < SIZE; column++) {
      const lng = west + ((column + 0.5) / SIZE) * (east - west);
      values[row * SIZE + column] = temperatureAt(lng, lat, shift);
    }
  }
  return values;
}

/** Tiles as raw values: the loader skips image decoding altogether. */
const valueLoader: DataTileLoader = async ({ z, x, y }) => ({
  values: tileValues(z, x, y),
  width: SIZE,
  height: SIZE,
});

/** A second "run", shifted, for the difference story. */
const shiftedLoader: DataTileLoader = async ({ z, x, y }) => ({
  values: tileValues(z, x, y, 4),
  width: SIZE,
  height: SIZE,
});

const ENCODING = { format: 'uint16' as const, scale: 0.01, offset: -50 };

/** Tiles as 16-bit encoded images, exactly as a tile server would send them. */
const encodedLoader: DataTileLoader = async ({ z, x, y }) => {
  const pixels = encodeTileValues(tileValues(z, x, y), SIZE, SIZE, ENCODING);
  return new ImageData(pixels, SIZE, SIZE);
};

const meta = {
  title: 'Geospatial/Data Tile Layer',
  component: DataTileLayer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
A tiled data field delivered as value-encoded image tiles, decoded and coloured
in the browser.

**Installation**

\`\`\`bash
npm install @hridayanp/data-tile-layer @hridayanp/map-container maplibre-gl react
\`\`\`

### Tiles carry numbers

The default contract packs a 16-bit integer into red and green
(\`raw = R × 256 + G\`), then \`value = raw × scale + offset\`; alpha 0 is NoData.
Terrarium and Terrain-RGB elevation encodings are built in. Each tile is decoded
once and cached, so a new colour ramp or range **recolours from memory with no
new requests**, and the value under the pointer is exact rather than inverted
from a colour.

### Where tiles come from

\`tiles\` takes a \`{z}/{x}/{y}\` URL template fetched with \`fetch\` — supply a URL
the host has already authorised. \`loadTile\` takes over entirely: add headers,
read from a worker, or return decoded values directly. These stories generate
every tile in the browser through \`loadTile\`.

### Difference

\`subtract\` names a second tile set; the layer renders \`A − B\` cell by cell. Use
it with a diverging ramp and a range symmetric about zero.

### Range

\`min\` and \`max\` are required. A tiled field has no global minimum the browser
can see, and per-tile scaling would make every tile edge a colour seam.
`,
      },
    },
  },
  argTypes: {
    colorScale: { control: 'object' },
    loadTile: { control: false },
    subtract: { control: false },
  },
} satisfies Meta<typeof DataTileLayer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Values: Story = {
  args: { colorScale: [...PALETTES.heat], min: -5, max: 40, opacity: 0.85, maxZoom: 6 },
  render: (args) => (
    <DemoMap zoom={4} note="Tiles generated as raw values. Change the range or ramp: tiles recolour without being regenerated.">
      <DataTileLayer {...args} loadTile={valueLoader} frameKey="values" />
      <GeoLegend title="Temperature" unit="°C" colorScale={args.colorScale as string[]} min={args.min} max={args.max} placement="bottom-right" />
    </DemoMap>
  ),
};

export const EncodedTiles: Story = {
  name: 'Encoded 16-bit tiles',
  args: { colorScale: [...PALETTES.viridis], min: 0, max: 35, encoding: ENCODING, maxZoom: 6, resampling: 'nearest' },
  render: (args) => (
    <DemoMap zoom={4} note="The same field packed into PNG-style RGBA (scale 0.01, offset −50) and decoded by the layer.">
      <DataTileLayer {...args} loadTile={encodedLoader} frameKey="encoded" />
    </DemoMap>
  ),
};

export const Difference: Story = {
  name: 'Difference (A − B)',
  args: { colorScale: [...PALETTES.diverging].reverse(), min: -8, max: 8, maxZoom: 6, opacity: 0.9 },
  render: (args) => (
    <DemoMap zoom={4} note="Run A minus run B, cell by cell, on a diverging ramp centred on zero.">
      <DataTileLayer {...args} loadTile={valueLoader} subtract={{ loadTile: shiftedLoader }} frameKey="diff" />
      <GeoLegend title="A − B" unit="°C" colorScale={args.colorScale as string[]} min={args.min} max={args.max} placement="bottom-right" />
    </DemoMap>
  ),
};

export const ValueUnderPointer: Story = {
  name: 'Value under the pointer',
  args: { colorScale: [...PALETTES.heat], min: -5, max: 40, maxZoom: 6 },
  render: function Render(args) {
    const [sample, setSample] = useState<DataTileSample | null>(null);
    const onHover = useCallback((next: DataTileSample | null) => setSample(next), []);
    return (
      <DemoMap zoom={4} note="onHoverValue reads the decoded tile cache — exact values, no request.">
        <DataTileLayer {...args} loadTile={valueLoader} frameKey="hover" onHoverValue={onHover} />
        <Panel placement="top-left" title="Value">
          <div className="demo-readout">
            {sample?.value != null
              ? `${sample.value.toFixed(2)} °C\n${sample.lngLat[1].toFixed(2)}, ${sample.lngLat[0].toFixed(2)}\nfrom z${sample.tileZoom}`
              : 'Move over the map'}
          </div>
        </Panel>
      </DemoMap>
    );
  },
};
