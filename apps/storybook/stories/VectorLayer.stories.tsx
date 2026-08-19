import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { VectorLayer, type VectorInteractionInfo } from '@hridayanp/vector-layer';
import { GeoHoverCard } from '@hridayanp/geo-hover';
import { DemoMap } from './demo/DemoMap';
import {
  makeLines,
  makeMixedGeometry,
  makePoints,
  makePolygons,
} from './demo/data';

const polygons = makePolygons();
const lines = makeLines();
const points = makePoints(36);
const mixed = makeMixedGeometry();

const meta = {
  title: 'Geospatial/Vector Layer',
  component: VectorLayer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
One generic GeoJSON layer for every geometry type.

**Installation**

\`\`\`bash
npm install @hridayanp/vector-layer @hridayanp/map-container maplibre-gl react
\`\`\`

**Data format**

\`data\` accepts a FeatureCollection, a single Feature, a bare geometry, or an
array of features. Point, MultiPoint, LineString, MultiLineString, Polygon and
MultiPolygon all render; a GeometryCollection is traversed for bounds.

**Styling**

Every style prop takes either a literal or a MapLibre expression. That is the
whole mechanism behind per-feature styling — there is no \`getFillColor\`
callback, because \`['get', 'color']\` does the same job on the GPU:

\`\`\`tsx
fill={['coalesce', ['get', 'color'], '#64748b']}
fillOpacity={['interpolate', ['linear'], ['get', 'intensity'], 0, 0.1, 1, 0.8]}
\`\`\`

Internally the layer creates separate MapLibre sub-layers per geometry type —
the only way to style them independently — but they share one source and one
set of props.

**Interaction**

\`onHover\`, \`onLeave\` and \`onClick\` receive the picked feature, all features
under the pointer, the coordinate and the page position. \`hitRadius\` adds an
invisible, wider target around points so small symbols stay hoverable.

**Limitations**

- No labels yet; add a MapLibre \`symbol\` layer separately if you need them.
- Clustering applies to point data only, per the GeoJSON source spec.
        `,
      },
    },
  },
  argTypes: {
    opacity: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    fillOpacity: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    strokeWidth: { control: { type: 'range', min: 0, max: 8, step: 0.5 } },
    pointRadius: { control: { type: 'range', min: 1, max: 20, step: 1 } },
    hitRadius: { control: { type: 'range', min: 0, max: 30, step: 1 } },
    visible: { control: 'boolean' },
    cluster: { control: 'boolean' },
    // These accept a colour *or* a MapLibre expression, so a colour picker
    // would misreport the array form. Text keeps both honest.
    fill: { control: 'text' },
    stroke: { control: 'text' },
    pointColor: { control: 'text' },
    pointStrokeColor: { control: 'text' },
    filter: { control: false },
    data: { control: false },
  },
} satisfies Meta<typeof VectorLayer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Polygons with a fill and an outline. */
export const Basic: Story = {
  args: {
    data: polygons,
    fill: '#38bdf8',
    fillOpacity: 0.3,
    stroke: '#38bdf8',
    strokeWidth: 1.5,
  },
  render: (args) => (
    <DemoMap note="Every control below is a live prop.">
      <VectorLayer {...args} />
    </DemoMap>
  ),
};

/** Polygons, lines and points from one source, styled independently. */
export const GeometryTypes: Story = {
  args: { data: mixed },
  render: (args) => (
    <DemoMap note="A single FeatureCollection containing Polygon, MultiPolygon, LineString, MultiLineString and Point features.">
      <VectorLayer
        {...args}
        fill="#1e40af"
        fillOpacity={0.28}
        stroke="#60a5fa"
        strokeWidth={1.75}
        pointRadius={5}
        pointColor="#f472b6"
      />
    </DemoMap>
  ),
};

/** Each feature styled from its own properties, via expressions. */
export const DataDrivenStyling: Story = {
  args: { data: polygons },
  render: (args) => (
    <DemoMap note="Colour comes from each feature's `color` property; opacity is interpolated from its `intensity`.">
      <VectorLayer
        {...args}
        fill={['coalesce', ['get', 'color'], '#64748b']}
        fillOpacity={[
          'interpolate',
          ['linear'],
          ['get', 'intensity'],
          0,
          0.05,
          1,
          0.7,
        ]}
        stroke={['coalesce', ['get', 'color'], '#94a3b8']}
        strokeWidth={2}
      />
    </DemoMap>
  ),
};

/** Outline-only rendering, for boundaries and reference geometry. */
export const OutlineOnly: Story = {
  args: { data: polygons, fill: false, stroke: '#94a3b8', strokeWidth: 1.5 },
  render: (args) => (
    <DemoMap
      size="short"
      note="`fill={false}` skips the fill sub-layer entirely rather than drawing a transparent one."
    >
      <VectorLayer {...args} />
    </DemoMap>
  ),
};

/** Dashed lines. */
export const DashedLines: Story = {
  args: { data: lines, stroke: '#a78bfa', strokeWidth: 2 },
  render: (args) => (
    <DemoMap size="short">
      <VectorLayer {...args} strokeDasharray={[3, 2]} />
    </DemoMap>
  ),
};

/** Hover picking, wired to the readout card from `@hridayanp/geo-hover`. */
export const Hover: Story = {
  args: { data: points },
  render: (args) => {
    const [info, setInfo] = useState<VectorInteractionInfo | null>(null);
    return (
      <DemoMap note="Hover a point. `hitRadius` widens the target to 14px without changing what is drawn.">
        <VectorLayer
          {...args}
          pointRadius={5}
          pointColor="#22d3ee"
          hitRadius={14}
          onHover={setInfo}
          onLeave={() => setInfo(null)}
        />
        {info && (
          <GeoHoverCard
            x={info.point.x}
            y={info.point.y}
            sections={[
              {
                title: String(info.feature.properties?.['name'] ?? 'Feature'),
                accentColor: '#22d3ee',
                rows: [
                  { label: 'Value', value: Number(info.feature.properties?.['value']) },
                  {
                    label: 'Speed',
                    value: Number(info.feature.properties?.['speed']),
                    unit: 'kt',
                  },
                  {
                    label: 'Direction',
                    value: Number(info.feature.properties?.['direction']),
                    unit: '°',
                  },
                ],
              },
            ]}
          />
        )}
      </DemoMap>
    );
  },
};

/** Filtering without re-slicing the data. */
export const Filtering: Story = {
  args: { data: points },
  render: (args) => {
    const [threshold, setThreshold] = useState(50);
    return (
      <div>
        <p className="demo-note">
          The source keeps all {points.features.length} features; the filter
          expression decides what draws. Cheaper than handing the map a new
          FeatureCollection on every change.
        </p>
        <label
          className="gcl-row"
          style={{ marginBottom: 10, fontSize: 12, maxWidth: 320 }}
        >
          value ≥ {threshold}
          <input
            type="range"
            min={0}
            max={100}
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
            style={{ flex: 1 }}
          />
        </label>
        <DemoMap size="short">
          <VectorLayer
            {...args}
            pointRadius={6}
            pointColor="#f59e0b"
            filter={['>=', ['get', 'value'], threshold]}
          />
        </DemoMap>
      </div>
    );
  },
};

/** Clustering, for dense point data. */
export const Clustering: Story = {
  args: { data: makePoints(400, 99) },
  render: (args) => (
    <DemoMap note="400 points, clustered at a 50px radius. Zoom in to break the clusters apart.">
      <VectorLayer {...args} cluster clusterRadius={50} pointRadius={7} pointColor="#34d399" />
    </DemoMap>
  ),
};

/** An empty collection renders nothing. */
export const EmptyData: Story = {
  args: { data: { type: 'FeatureCollection', features: [] } },
  render: (args) => (
    <DemoMap
      size="short"
      note="An empty collection is a normal state — the source is still created, so adding features later needs no remount."
    >
      <VectorLayer {...args} />
    </DemoMap>
  ),
};
