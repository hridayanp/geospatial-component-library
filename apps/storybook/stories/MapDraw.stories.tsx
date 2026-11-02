import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  DrawControl,
  formatArea,
  formatDistance,
  measureFeature,
  useMapDraw,
  type DrawMode,
} from '@hridayanp/map-draw';
import type { GeoJsonFeature } from '@hridayanp/geo-utils';
import { Button, Panel } from '@hridayanp/ui';
import { DemoMap } from './demo/DemoMap';

const AREA: GeoJsonFeature = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [90.6, 24.4],
        [93.2, 24.1],
        [93.8, 26.3],
        [91.4, 27.1],
        [90.6, 24.4],
      ],
    ],
  },
  properties: { name: 'Warning area' },
};

function summarise(features: GeoJsonFeature[]): string {
  if (features.length === 0) return 'Draw something on the map.';
  return features
    .map((feature, i) => {
      const m = measureFeature(feature);
      const parts = [`${i + 1}. ${String(feature.properties?.['mode'] ?? feature.geometry?.type)}`];
      if (m.radiusKm != null) parts.push(`r ${formatDistance(m.radiusKm)}`);
      if (m.areaKm2 != null) parts.push(formatArea(m.areaKm2));
      if (m.lengthKm != null) parts.push(formatDistance(m.lengthKm));
      return parts.join('  ');
    })
    .join('\n');
}

const meta = {
  title: 'Interaction/Map Draw',
  component: DrawControl,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Drawing, editing and measuring on the map — point, line, polygon, rectangle,
circle and freehand — built on terra-draw.

**Installation**

\`\`\`bash
npm install @hridayanp/map-draw @hridayanp/map-container maplibre-gl react
import '@hridayanp/ui/styles.css';
\`\`\`

### Output

Finished shapes leave through \`onChange\` as plain GeoJSON features, in drawing
order; \`onFinish\` fires once per completed shape with its measurements. The
engine's own guide and handle features are filtered out. \`defaultFeatures\`
seeds an existing shape for editing — an area of interest saved earlier.

### Measurement

\`measureFeature\` is geodesic: polygon area by spherical excess, lengths along
great circles. An area drawn over a subcontinent is reported in real km², not
squared degrees. Circles report their radius as well.

### Area-of-interest workflows

\`singleFeature\` keeps only the most recent shape, so drawing a second area
replaces the first — the behaviour a warning-area or extract-region form wants.

### Basemap switches

MapLibre drops the engine's layers with the old style. The hook snapshots the
shapes and restores them onto the new style, so a basemap change never loses
work in progress.

### Building a custom toolbar

\`useMapDraw\` exposes the mode, the shapes and the actions; \`DrawControl\` is
the ready-made toolbar built on it.
`,
      },
    },
  },
  argTypes: {
    modes: { control: 'check', options: ['select', 'point', 'linestring', 'polygon', 'rectangle', 'circle', 'freehand'] },
    color: { control: 'color' },
    onChange: { control: false },
    onFinish: { control: false },
  },
} satisfies Meta<typeof DrawControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllTools: Story = {
  args: { placement: 'top-left', color: '#38bdf8' },
  render: function Render(args) {
    const [features, setFeatures] = useState<GeoJsonFeature[]>([]);
    return (
      <DemoMap note="Pick a tool, draw, then use the select tool to move or reshape. Esc cancels, Enter finishes a line or polygon.">
        <DrawControl {...args} onChange={setFeatures} />
        <Panel placement="top-right" title="Shapes" style={{ minWidth: 220 }}>
          <pre className="demo-readout" style={{ margin: 0 }}>{summarise(features)}</pre>
        </Panel>
      </DemoMap>
    );
  },
};

export const AreaOfInterest: Story = {
  name: 'Area of interest',
  args: { modes: ['polygon', 'rectangle', 'circle', 'select'], singleFeature: true, color: '#f59e0b' },
  render: function Render(args) {
    const [area, setArea] = useState<GeoJsonFeature | null>(null);
    return (
      <DemoMap note="singleFeature: drawing a new area replaces the previous one. The host receives exactly one shape.">
        <DrawControl {...args} onChange={(features) => setArea(features[0] ?? null)} />
        <Panel placement="bottom-left" title="Area of interest">
          <div className="demo-readout">{area ? summarise([area]) : 'None drawn'}</div>
        </Panel>
      </DemoMap>
    );
  },
};

export const EditExisting: Story = {
  name: 'Edit an existing shape',
  args: { modes: ['select', 'polygon'], defaultFeatures: [AREA], color: '#ef4444' },
  render: (args) => (
    <DemoMap note="defaultFeatures seeds a saved polygon; choose the select tool to drag vertices or add midpoints.">
      <DrawControl {...args} />
    </DemoMap>
  ),
};

function CustomToolbar() {
  const draw = useMapDraw({ modes: ['linestring', 'polygon'], color: '#a78bfa' });
  const tools: { mode: DrawMode; label: string }[] = [
    { mode: 'linestring', label: 'Measure distance' },
    { mode: 'polygon', label: 'Measure area' },
  ];
  const last = draw.features[draw.features.length - 1];
  const m = last ? measureFeature(last) : null;
  return (
    <Panel placement="top-left" title="Measure">
      <div className="gcl-stack">
        <div className="gcl-row">
          {tools.map(({ mode, label }) => (
            <Button key={mode} variant="outline" size="sm" active={draw.mode === mode} onClick={() => draw.setMode(draw.mode === mode ? null : mode)}>
              {label}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={draw.clear} disabled={draw.features.length === 0}>
            Clear
          </Button>
        </div>
        <div className="demo-readout">
          {m?.lengthKm != null ? formatDistance(m.lengthKm) : m?.areaKm2 != null ? formatArea(m.areaKm2) : '—'}
        </div>
      </div>
    </Panel>
  );
}

export const HookToolbar: Story = {
  name: 'Custom toolbar (useMapDraw)',
  render: () => (
    <DemoMap note="The same engine driven from a toolbar built with the hook and @hridayanp/ui primitives.">
      <CustomToolbar />
    </DemoMap>
  ),
};
