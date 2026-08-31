import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { GeoHover, GeoHoverCard, useMapHover } from '@hridayanp/geo-hover';
import { RasterLayer } from '@hridayanp/raster-layer';
import { VectorLayer } from '@hridayanp/vector-layer';
import { GeoLegend } from '@hridayanp/geo-legend';
import { DemoMap, DemoSurface } from './demo/DemoMap';
import { PALETTES } from './demo/data';
import {
  ASSET_FRAME_KEYS,
  CONVECTIVE_VIEW,
  loadConvectiveRaster,
  loadObservations,
} from './demo/assets';
import { useAsset } from './demo/useAsset';

const meta = {
  title: 'Overlays/Geo Hover',
  component: GeoHover,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Pointer-driven inspection of map content: vector feature picking, raster value
probing, and a portalled readout card positioned against the pointer.

**Installation**

\`\`\`bash
npm install @hridayanp/geo-hover @hridayanp/map-container maplibre-gl react react-dom
import '@hridayanp/ui/styles.css';
\`\`\`

### Two capabilities

| Capability | Enabled by | Mechanism |
| --- | --- | --- |
| Feature picking | \`layerIds\` | \`queryRenderedFeatures\` scoped to those style layers |
| Raster probing | \`raster\` | Samples the in-memory band at the pointer |

Either may be used alone. With both, a single hover yields the features under
the pointer **and** the underlying band value, which is what an operational
readout generally requires.

### Data model

Raster probing reads the same \`RasterData\` the application already supplied to
\`RasterLayer\`. No request is issued and no second decode occurs; a hover costs
an index calculation and an array read. This is only possible because the host
owns the data — a component that retrieved its own rasters would have to
retrieve again here.

Feature picking operates on geometry already rendered by MapLibre, so
\`layerIds\` must reference style layers that are currently drawn.

\`\`\`ts
interface HoverState {
  x: number;                    // page coordinates, for a fixed-position element
  y: number;
  lngLat: LngLat;               // geographic position under the pointer
  features: GeoJsonFeature[];   // topmost first; empty for a raster-only probe
  value?: number | null;        // band value, when a raster was supplied
}
\`\`\`

### Where domain knowledge lives

Every other component in this library is domain-agnostic by construction. A
readout card cannot be: something must decide that \`wind_gust_kt\` is labelled
"Gust" and measured in knots.

\`sections\` is that boundary. It receives the raw hover state and returns card
content, and it is supplied by the application. Returning an empty array
suppresses the card for that hover.

When \`sections\` is omitted, a default builder renders a single row from the
probed value, labelled with \`title\` and suffixed with \`unit\`.

### Card positioning

\`GeoHoverCard\` renders into \`document.body\` with \`position: fixed\`. A
readout rendered inside the map container is clipped by the first ancestor
declaring \`overflow: hidden\` — and map containers almost invariably have one.
The card also flips and clamps against the viewport edges.

### Sampling modes

\`'nearest'\` (the default) returns a value that exists in the source grid,
which is correct for classified data and for readouts where an actual
measurement is expected. \`'bilinear'\` interpolates the four surrounding cells,
matching what the smoothed rendering displays. Positions outside the extent and
cells holding NoData return \`value: null\` rather than raising.

### Performance

\`queryRenderedFeatures\` executes on every pointer-move event. Unscoped, it
traverses every rendered style layer including the entire basemap — the
difference between a responsive readout and a visibly janky one. Raster probing
is an array read and is negligible by comparison.

### Data used in these stories

\`assets/raster.tif\` for probing, and \`assets/vector.geojson\` — 3,190 Point
observations carrying \`thunderstorm_prob_pct\`, \`wind_gust_kt\`,
\`thunderstorm_distance_km\` and \`thunderstorm_occurrence\` — for picking.
        `,
      },
    },
  },
  argTypes: {
    sampling: { control: 'inline-radio', options: ['nearest', 'bilinear'] },
    enabled: { control: 'boolean' },
    unit: { control: 'text' },
    title: { control: 'text' },
  },
} satisfies Meta<typeof GeoHover>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Reading a band value at the pointer, with no feature picking configured. */
export const RasterProbe: Story = {
  args: { title: 'Convective probability', unit: '%', sampling: 'nearest' },
  render: (args) => {
    const { value: raster } = useAsset(loadConvectiveRaster);
    return (
      <DemoMap
        {...CONVECTIVE_VIEW}
        note="The reported value is sampled from the same decoded array that was colourised — no request, no second decode."
      >
        <RasterLayer
          data={raster}
          frameKey={ASSET_FRAME_KEYS.convective}
          colorScale={[...PALETTES.heat]}
          min={0}
          max={50}
          opacity={0.85}
        />
        <GeoLegend
          title="Convective probability"
          colorScale={[...PALETTES.heat]}
          min={0}
          max={50}
          unit="%"
          ticks={5}
          placement="bottom-right"
        />
        <GeoHover {...args} raster={raster} />
      </DemoMap>
    );
  },
};

/**
 * `'nearest'` reports a cell value that exists in the source grid; `'bilinear'`
 * interpolates, matching what the smoothed rendering displays.
 */
export const SamplingModes: Story = {
  args: {},
  render: () => {
    const { value: raster } = useAsset(loadConvectiveRaster);
    return (
      <div className="demo-grid">
        {(['nearest', 'bilinear'] as const).map((sampling) => (
          <DemoMap
            key={sampling}
            {...CONVECTIVE_VIEW}
            size="short"
            note={`sampling: "${sampling}"`}
          >
            <RasterLayer
              id={`probe-${sampling}`}
              data={raster}
              frameKey={ASSET_FRAME_KEYS.convective}
              colorScale={[...PALETTES.viridis]}
              min={0}
              max={50}
              opacity={0.85}
            />
            <GeoHover
              raster={raster}
              sampling={sampling}
              title="Probability"
              unit="%"
            />
          </DemoMap>
        ))}
      </div>
    );
  },
};

/**
 * Feature picking scoped to a layer. `sections` maps the picked feature's
 * properties onto labelled rows — the seam where domain knowledge enters.
 */
export const FeatureInspection: Story = {
  args: {},
  render: () => {
    const { value: observations } = useAsset(loadObservations);
    return (
      <DemoMap
        {...CONVECTIVE_VIEW}
        note="layerIds is scoped to the observation layer's hit sub-layer, so queryRenderedFeatures does not traverse the basemap on every pointer move."
      >
        <VectorLayer
          id="observations"
          data={observations}
          pointRadius={3}
          pointColor="#22d3ee"
          pointStrokeWidth={0}
          hitRadius={12}
        />
        <GeoHover
          layerIds={['observations-hit']}
          sections={(state) => {
            const properties = state.features[0]?.properties;
            if (!properties) return [];
            return [
              {
                title: 'Observation',
                subtitle: String(properties['thunderstorm_occurrence'] ?? ''),
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
                    label: 'Gust intensity',
                    value: String(properties['gust_intensity']),
                  },
                ],
              },
            ];
          }}
        />
      </DemoMap>
    );
  },
};

/**
 * One card, two sections: a probed band value and the picked feature. This is
 * how a composed map stays readable at the pointer.
 */
export const CombinedSections: Story = {
  args: {},
  render: () => {
    const { value: raster } = useAsset(loadConvectiveRaster);
    const { value: observations } = useAsset(loadObservations);
    return (
      <DemoMap
        {...CONVECTIVE_VIEW}
        note="A single GeoHover handles both capabilities. Sections are appended conditionally, so the card shows only what is genuinely under the pointer."
      >
        <RasterLayer
          data={raster}
          frameKey={ASSET_FRAME_KEYS.convective}
          colorScale={[...PALETTES.ocean]}
          min={0}
          max={50}
          opacity={0.8}
        />
        <VectorLayer
          id="observations"
          data={observations}
          pointRadius={2.5}
          pointColor="#f8fafc"
          pointStrokeWidth={0}
          opacity={0.55}
          hitRadius={12}
        />
        <GeoHover
          layerIds={['observations-hit']}
          raster={raster}
          sampling="bilinear"
          sections={(state) => {
            const sections = [];
            if (state.value != null) {
              sections.push({
                title: 'Gridded field',
                accentColor: '#38bdf8',
                rows: [
                  { label: 'Probability', value: state.value, unit: '%' },
                  {
                    label: 'Position',
                    value: `${state.lngLat[1].toFixed(3)}°, ${state.lngLat[0].toFixed(3)}°`,
                  },
                ],
              });
            }
            const properties = state.features[0]?.properties;
            if (properties) {
              sections.push({
                title: 'Nearest observation',
                accentColor: '#f59e0b',
                rows: [
                  {
                    label: 'Probability',
                    value: Number(properties['thunderstorm_prob_pct']),
                    unit: '%',
                  },
                  {
                    label: 'Gust',
                    value: Number(properties['wind_gust_kt']),
                    unit: 'kt',
                  },
                ],
              });
            }
            return sections;
          }}
        />
      </DemoMap>
    );
  },
};

/**
 * `render` replaces the card body while retaining the positioning, edge
 * flipping and portalling.
 */
export const CustomCard: Story = {
  args: {},
  render: () => {
    const { value: raster } = useAsset(loadConvectiveRaster);
    return (
      <DemoMap
        {...CONVECTIVE_VIEW}
        note="Useful when the default label/value layout is the wrong shape for the data — a single large figure, a sparkline, a classified badge."
      >
        <RasterLayer
          data={raster}
          frameKey={ASSET_FRAME_KEYS.convective}
          colorScale={[...PALETTES.magma]}
          min={0}
          max={50}
          opacity={0.85}
        />
        <GeoHover
          raster={raster}
          sections={(state) => [
            {
              title: 'Reading',
              rows: [{ label: 'Probability', value: state.value ?? null }],
            },
          ]}
          render={(sections) => (
            <div style={{ minWidth: 150 }}>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  fontFamily: 'var(--gcl-font-mono)',
                  lineHeight: 1,
                }}
              >
                {Number(sections[0]?.rows[0]?.value ?? 0).toFixed(1)}%
              </div>
              <div style={{ fontSize: 10, color: 'var(--gcl-fg-muted)', marginTop: 4 }}>
                CONVECTIVE PROBABILITY
              </div>
            </div>
          )}
        />
      </DemoMap>
    );
  },
};

/**
 * `useMapHover` exposes the raw state with no card, for readouts that belong
 * elsewhere in the application layout.
 */
export const HookOnly: Story = {
  args: {},
  render: () => {
    const { value: raster } = useAsset(loadConvectiveRaster);
    const { value: observations } = useAsset(loadObservations);

    function Readout() {
      const hover = useMapHover({
        raster,
        layerIds: ['observations-point'],
      });
      return (
        <div
          className="gcl-panel gcl-panel--floating gcl-panel--top-left"
          style={{ minWidth: 200 }}
        >
          <div className="gcl-panel__body demo-readout">
            {hover
              ? `value     ${hover.value?.toFixed(2) ?? '—'} %
lng       ${hover.lngLat[0].toFixed(4)}
lat       ${hover.lngLat[1].toFixed(4)}
features  ${hover.features.length}`
              : 'Move the pointer over the map.'}
          </div>
        </div>
      );
    }

    return (
      <DemoMap
        {...CONVECTIVE_VIEW}
        note="The hook returns HoverState or null. null means nothing is under the pointer — the shape a conditional readout requires."
      >
        <RasterLayer
          data={raster}
          frameKey={ASSET_FRAME_KEYS.convective}
          colorScale={[...PALETTES.viridis]}
          min={0}
          max={50}
          opacity={0.8}
        />
        <VectorLayer
          id="observations"
          data={observations}
          pointRadius={2.5}
          pointColor="#f472b6"
          pointStrokeWidth={0}
        />
        <Readout />
      </DemoMap>
    );
  },
};

/**
 * `GeoHoverCard` accepts explicit coordinates and requires no map, so it can be
 * driven from any pointer source.
 */
export const CardOnly: Story = {
  args: {},
  render: () => {
    const [position, setPosition] = useState({ x: 260, y: 200 });
    return (
      <DemoSurface note="Positioning, viewport clamping and portalling apply regardless of what supplies the coordinates.">
        <div
          style={{ height: 260, position: 'relative', cursor: 'crosshair' }}
          onMouseMove={(event) =>
            setPosition({ x: event.clientX, y: event.clientY })
          }
        >
          <GeoHoverCard
            x={position.x}
            y={position.y}
            sections={[
              {
                title: 'Sample',
                accentColor: '#34d399',
                subtitle: 'Coordinates supplied by the host',
                rows: [
                  { label: 'Probability', value: 42, unit: '%' },
                  { label: 'Gust', value: 3.14159, unit: 'kt' },
                  { label: 'Unavailable', value: null },
                ],
              },
            ]}
          />
        </div>
      </DemoSurface>
    );
  },
};
