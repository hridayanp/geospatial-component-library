import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { VectorLayer, type VectorInteractionInfo } from '@hridayanp/vector-layer';
import { GeoHoverCard } from '@hridayanp/geo-hover';
import { DemoMap } from './demo/DemoMap';
import { makeLines, makeMixedGeometry, makePolygons } from './demo/data';
import { CONVECTIVE_VIEW, loadObservations } from './demo/assets';
import { useAsset } from './demo/useAsset';

const polygons = makePolygons();
const lines = makeLines();
const mixed = makeMixedGeometry();

const meta = {
  title: 'Geospatial/Vector Layer',
  component: VectorLayer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Renders GeoJSON of any geometry type on a MapLibre map, with symbology
configured entirely through props and MapLibre expressions.

**Installation**

\`\`\`bash
npm install @hridayanp/vector-layer @hridayanp/map-container maplibre-gl react
\`\`\`

### Responsibilities

The component owns GeoJSON normalisation, the source and sub-layer lifecycle,
geometry-type filtering, symbology application, clustering configuration and
simplification tolerance. Feature acquisition, attribute joins and the meaning
of feature properties remain with the consuming application.

### Data model

\`data\` accepts a FeatureCollection, a single Feature, a bare geometry, or an
array of features; input is normalised through \`toFeatureCollection\`. Point,
MultiPoint, LineString, MultiLineString, Polygon and MultiPolygon all render,
and a GeometryCollection is traversed for extent computation. Coordinates are
geographic WGS84 (EPSG:4326) in \`[longitude, latitude]\` order, per the GeoJSON
specification.

### Rendering model

One MapLibre \`geojson\` source backs up to five style layers, each filtered to
the geometry types it can draw:

| Layer id | MapLibre type | Geometry filter |
| --- | --- | --- |
| \`{id}-fill\` | \`fill\` | Polygon, MultiPolygon |
| \`{id}-outline\` | \`line\` | Polygon, MultiPolygon |
| \`{id}-line\` | \`line\` | LineString, MultiLineString |
| \`{id}-point\` | \`circle\` | Point, MultiPoint |
| \`{id}-hit\` | \`circle\` | Point, MultiPoint — only when \`hitRadius > 0\` |

Separate sub-layers are the only mechanism by which MapLibre permits geometry
types to be styled independently. The decomposition is part of the rendering
model rather than the configuration surface: the caller configures one
component. The sub-layer identifiers are public, because \`GeoHover\` is scoped
by layer id.

### Data-driven symbology

Every style prop accepts a literal **or** a MapLibre expression, typed as
\`StyleValue<T> = T | unknown[]\`. Expressions are evaluated by MapLibre per
feature on the GPU, which is why the component exposes no per-feature style
callback:

\`\`\`tsx
fill={['coalesce', ['get', 'color'], '#64748b']}
fillOpacity={['interpolate', ['linear'], ['get', 'intensity'], 0, 0.1, 1, 0.8]}
\`\`\`

The layer-level \`opacity\` prop composes with these automatically: literals are
multiplied directly, expressions are wrapped in \`['*', expr, factor]\`.

### Interaction model

\`onHover\`, \`onLeave\` and \`onClick\` receive a \`VectorInteractionInfo\`
carrying the topmost feature, every feature under the pointer, the geographic
coordinate, the page position and the sub-layer that was hit. The component
holds no selection or hover state; interaction state is owned entirely by the
application.

### Data used in these stories

\`assets/vector.geojson\` — 3,190 Point features in EPSG:4326 over the extent
84.339, 19.590, 90.139, 25.090, carrying numeric attributes
(\`thunderstorm_prob_pct\`, \`wind_gust_kt\`, \`thunderstorm_distance_km\`) and
categorical ones (\`thunderstorm_occurrence\`, \`gust_intensity\`). Stories that
demonstrate polygon and line dispatch use generated geometry, since the sample
collection contains only points.

### Performance

\`tolerance\` controls Douglas–Peucker simplification at the source. Prefer a
\`filter\` expression to re-slicing the collection — geometry stays uploaded to
the GPU and only the draw decision changes. Clustering moves aggregation into
the source and is substantially cheaper than drawing tens of thousands of
individual circles.

### Limitations

The component renders no labels; text placement has enough configuration
surface to warrant a dedicated MapLibre \`symbol\` layer. Clustering applies to
point geometry only, per the GeoJSON source specification.
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
    // would misreport the array form. A text control keeps both representable.
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

/** Point features rendered with a uniform symbology. */
export const Basic: Story = {
  args: {
    pointRadius: 3,
    pointColor: '#38bdf8',
    pointStrokeColor: '#0f172a',
    pointStrokeWidth: 0.5,
    opacity: 0.9,
  },
  render: (args) => {
    const { value: observations } = useAsset(loadObservations);
    return (
      <DemoMap
        {...CONVECTIVE_VIEW}
        note="3,190 observation points from assets/vector.geojson. Every control below is a live prop on the layer."
      >
        <VectorLayer {...args} data={observations} />
      </DemoMap>
    );
  },
};

/**
 * A single FeatureCollection containing polygon, line and point geometry. The
 * layer derives one sub-layer per geometry type from the same source.
 */
export const GeometryTypes: Story = {
  args: { data: mixed },
  render: (args) => (
    <DemoMap note="Polygon, MultiPolygon, LineString, MultiLineString and Point features, dispatched to their respective sub-layers and styled independently.">
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

/**
 * Symbology derived from feature properties through MapLibre expressions,
 * evaluated per feature on the GPU.
 */
export const DataDrivenStyling: Story = {
  args: {},
  render: () => {
    const { value: observations } = useAsset(loadObservations);
    return (
      <DemoMap
        {...CONVECTIVE_VIEW}
        note="Radius interpolates from thunderstorm_prob_pct (0–50) and colour steps through gust intensity classes derived from wind_gust_kt."
      >
        <VectorLayer
          data={observations}
          pointRadius={[
            'interpolate',
            ['linear'],
            ['get', 'thunderstorm_prob_pct'],
            0,
            1.5,
            50,
            7,
          ]}
          pointColor={[
            'step',
            ['get', 'wind_gust_kt'],
            '#38bdf8',
            10,
            '#facc15',
            15,
            '#f97316',
            19,
            '#dc2626',
          ]}
          pointStrokeWidth={0}
          opacity={0.85}
        />
      </DemoMap>
    );
  },
};

/**
 * `fill={false}` omits the fill sub-layer entirely rather than registering one
 * with zero opacity — appropriate for boundaries and reference geometry.
 */
export const OutlineOnly: Story = {
  args: { data: polygons, fill: false, stroke: '#94a3b8', strokeWidth: 1.5 },
  render: (args) => (
    <DemoMap
      size="short"
      note="One fewer style layer and one fewer draw call than a transparent fill."
    >
      <VectorLayer {...args} />
    </DemoMap>
  ),
};

/** `strokeDasharray` is expressed in line widths rather than pixels. */
export const DashedLines: Story = {
  args: { data: lines, stroke: '#a78bfa', strokeWidth: 2 },
  render: (args) => (
    <DemoMap size="short" note="A [3, 2] pattern at a 2px stroke draws 6px dashes separated by 4px gaps.">
      <VectorLayer {...args} strokeDasharray={[3, 2]} />
    </DemoMap>
  ),
};

/**
 * Feature picking. `hitRadius` registers an invisible wider target so small
 * symbols remain acquirable without being drawn larger.
 */
export const Hover: Story = {
  args: {},
  render: () => {
    const { value: observations } = useAsset(loadObservations);
    const [info, setInfo] = useState<VectorInteractionInfo | null>(null);
    const properties = info?.feature.properties ?? null;
    return (
      <DemoMap
        {...CONVECTIVE_VIEW}
        note="The hit sub-layer uses circle-opacity 0.00001 rather than 0, because MapLibre excludes fully transparent geometry from hit testing."
      >
        <VectorLayer
          data={observations}
          pointRadius={3}
          pointColor="#22d3ee"
          pointStrokeWidth={0}
          hitRadius={12}
          onHover={setInfo}
          onLeave={() => setInfo(null)}
        />
        {info && properties && (
          <GeoHoverCard
            x={info.point.x}
            y={info.point.y}
            sections={[
              {
                title: 'Observation',
                subtitle: `${info.lngLat[1].toFixed(3)}°, ${info.lngLat[0].toFixed(3)}°`,
                accentColor: '#22d3ee',
                rows: [
                  {
                    label: 'Convective probability',
                    value: Number(properties['thunderstorm_prob_pct']),
                    unit: '%',
                  },
                  {
                    label: 'Gust',
                    value: Number(properties['wind_gust_kt']),
                    unit: 'kt',
                  },
                  {
                    label: 'Distance to cell',
                    value: Number(properties['thunderstorm_distance_km']),
                    unit: 'km',
                  },
                  {
                    label: 'Occurrence',
                    value: String(properties['thunderstorm_occurrence']),
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

/**
 * A `filter` expression changes what draws without re-uploading geometry. The
 * source retains every feature; only the draw decision changes.
 */
export const Filtering: Story = {
  args: {},
  render: () => {
    const { value: observations } = useAsset(loadObservations);
    const [threshold, setThreshold] = useState(10);
    return (
      <div>
        <p className="demo-note">
          The source holds all{' '}
          {observations?.features.length.toLocaleString() ?? '—'} features
          throughout. Handing the source a new FeatureCollection on every change
          would re-parse and re-upload the geometry instead.
        </p>
        <label
          className="gcl-row"
          style={{ marginBottom: 10, fontSize: 12, maxWidth: 360 }}
        >
          probability ≥ {threshold}%
          <input
            type="range"
            min={0}
            max={50}
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
            style={{ flex: 1 }}
          />
        </label>
        <DemoMap {...CONVECTIVE_VIEW} size="short">
          <VectorLayer
            data={observations}
            pointRadius={4}
            pointColor="#f59e0b"
            pointStrokeWidth={0}
            filter={['>=', ['get', 'thunderstorm_prob_pct'], threshold]}
          />
        </DemoMap>
      </div>
    );
  },
};

/**
 * Source-level clustering for dense point data. Cluster features carry a
 * `point_count` property, addressable from an expression.
 */
export const Clustering: Story = {
  args: {},
  render: () => {
    const { value: observations } = useAsset(loadObservations);
    return (
      <DemoMap
        {...CONVECTIVE_VIEW}
        note="3,190 points aggregated at a 50px radius. Radius steps with point_count; zooming in dissolves the clusters."
      >
        <VectorLayer
          data={observations}
          cluster
          clusterRadius={50}
          pointRadius={['step', ['get', 'point_count'], 6, 25, 10, 100, 15, 400, 21]}
          pointColor={['step', ['get', 'point_count'], '#34d399', 100, '#0ea5e9', 400, '#6366f1']}
          pointStrokeColor="#0f172a"
          pointStrokeWidth={1}
        />
      </DemoMap>
    );
  },
};

/**
 * An empty collection is a supported state. The source is still registered, so
 * features arriving later require no remount.
 */
export const EmptyData: Story = {
  args: { data: { type: 'FeatureCollection', features: [] } },
  render: (args) => (
    <DemoMap
      size="short"
      note="This is also the state during an asynchronous load — `data={null}` behaves identically."
    >
      <VectorLayer {...args} />
    </DemoMap>
  ),
};
