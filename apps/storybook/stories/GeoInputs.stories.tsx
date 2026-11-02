import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  BboxEditor,
  LatLonInput,
  formatLatLon,
  parseLatLon,
} from '@hridayanp/geo-inputs';
import type { Bounds, LngLat } from '@hridayanp/geo-utils';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { PointPicker } from '@hridayanp/map-markers';
import { VectorLayer } from '@hridayanp/vector-layer';
import { Panel } from '@hridayanp/ui';
import { DemoMap, DemoSurface } from './demo/DemoMap';

const meta = {
  title: 'Interaction/Geo Inputs',
  component: LatLonInput,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Form controls for geographic values: a latitude/longitude field that reads every
common notation, and a bounding-box editor.

**Installation**

\`\`\`bash
npm install @hridayanp/geo-inputs react
import '@hridayanp/ui/styles.css';
\`\`\`

### Reading coordinates

\`parseLatLon\` accepts what people paste: signed decimal (\`9.8, 75.9\`),
hemisphere letters before or after (\`9.80°N 75.90°E\`, \`N 9 48.5 E 75 54.25\`),
DMS with any of the usual marks, and either axis first when letters say which is
which. Out-of-range values are rejected, never clamped. A bare numeric pair is
read latitude first — the order people write — unless \`order="lonlat"\`.

### Writing coordinates

\`formatLatLon\` puts latitude first, as people read and say coordinates, in
decimal, DMS, degrees-decimal-minutes or signed notation. GeoJSON's \`[lng, lat]\`
stays the internal order throughout.

### Committing

\`LatLonInput\` commits on Enter or blur and redisplays the parsed value in one
notation, so what the user sees after committing is exactly what the
application received. Escape restores the last committed value.

### Bounding boxes

\`BboxEditor\` lays out north, west, east and south as a compass and emits only
valid boxes, saying which rule failed otherwise. \`onUseCurrentView\` is a
callback, so the package carries no map dependency.
`,
      },
    },
  },
  argTypes: {
    format: { control: 'inline-radio', options: ['decimal', 'dms', 'ddm', 'signed'] },
    onChange: { control: false },
  },
} satisfies Meta<typeof LatLonInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Coordinate: Story = {
  args: { label: 'Location', format: 'decimal', value: [75.9, 9.8], onChange: () => {} },
  render: function Render(args) {
    const [value, setValue] = useState<LngLat | null>(args.value);
    return (
      <DemoSurface note="Paste 9°48′N 75°54′E, N 9 48.5 E 75 54.25 or 75.9E 9.8N, then press Enter.">
        <div style={{ maxWidth: 320 }}>
          <LatLonInput {...args} value={value} onChange={setValue} />
        </div>
        <pre className="demo-readout">{value ? `[lng, lat] = [${value[0]}, ${value[1]}]` : 'null'}</pre>
      </DemoSurface>
    );
  },
};

export const Notations: Story = {
  args: { value: null, onChange: () => {} },
  render: () => {
    const inputs = ['9.8, 75.9', '9.80°N 75.90°E', "9°48'30\"N 75°54'15\"E", 'N 9 48.5 E 75 54.25', '33 51.6 S 151 12.4 E', '95, 10', '9.8N 10.2N'];
    const lines = inputs.map((text) => {
      const parsed = parseLatLon(text);
      return `${text.padEnd(26)} → ${parsed ? `${formatLatLon(parsed, { format: 'decimal', precision: 4 })}   ${formatLatLon(parsed, { format: 'dms' })}` : 'rejected'}`;
    });
    return (
      <DemoSurface note="parseLatLon and formatLatLon over typical input, including two that are correctly rejected.">
        <pre className="demo-readout">{lines.join('\n')}</pre>
      </DemoSurface>
    );
  },
};

export const WithPointPicker: Story = {
  name: 'Linked to a map',
  args: { value: null, onChange: () => {}, format: 'ddm' },
  render: function Render(args) {
    const [point, setPoint] = useState<LngLat | null>([92, 25.5]);
    return (
      <DemoMap note="Type a coordinate or click the map: one value, two editors.">
        <PointPicker value={point} onChange={setPoint} />
        <Panel placement="top-left" title="Position" style={{ width: 260 }}>
          <LatLonInput {...args} aria-label="Position" value={point} onChange={setPoint} />
        </Panel>
      </DemoMap>
    );
  },
};

export const BoundingBox: Story = {
  args: { value: null, onChange: () => {} },
  render: function Render() {
    const mapRef = useRef<MapLibreMap | null>(null);
    const [bounds, setBounds] = useState<Bounds | null>([89.5, 23, 94.5, 27.5]);
    const box = bounds
      ? {
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'Polygon' as const,
            coordinates: [[[bounds[0], bounds[1]], [bounds[2], bounds[1]], [bounds[2], bounds[3]], [bounds[0], bounds[3]], [bounds[0], bounds[1]]]],
          },
        }
      : null;
    return (
      <DemoMap onLoad={(map) => (mapRef.current = map)} zoom={5} note="Edit the edges, or pan the map and use its view. Invalid boxes are reported, never emitted.">
        <VectorLayer data={box} fill="#38bdf8" fillOpacity={0.12} stroke="#38bdf8" strokeWidth={2} />
        <Panel placement="top-left" title="Extract region" style={{ width: 260 }}>
          <BboxEditor
            value={bounds}
            onChange={setBounds}
            onUseCurrentView={() => {
              const b = mapRef.current?.getBounds();
              return b ? [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] : null;
            }}
          />
        </Panel>
      </DemoMap>
    );
  },
};
