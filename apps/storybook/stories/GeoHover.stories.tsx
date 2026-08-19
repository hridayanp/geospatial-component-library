import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { GeoHover, GeoHoverCard, useMapHover } from '@hridayanp/geo-hover';
import { RasterLayer } from '@hridayanp/raster-layer';
import { VectorLayer } from '@hridayanp/vector-layer';
import { GeoLegend } from '@hridayanp/geo-legend';
import { DemoMap, DemoSurface } from './demo/DemoMap';
import { PALETTES, makePoints, makePolygons, makeRaster } from './demo/data';

const raster = makeRaster();
const points = makePoints(30);
const polygons = makePolygons();

const meta = {
  title: 'Overlays/Geo Hover',
  component: GeoHover,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Hover, picking and value inspection.

**Installation**

\`\`\`bash
npm install @hridayanp/geo-hover @hridayanp/map-container react react-dom
import '@hridayanp/ui/styles.css';
\`\`\`

**Two independent capabilities**

- **Feature picking** — pass \`layerIds\` and the hook queries those layers for
  rendered features under the pointer.
- **Raster probing** — pass a \`RasterData\` and it samples the value at the
  cursor. This reads the array the host already has in memory: no round trip,
  no second decode, no server.

Use either or both.

**Where domain knowledge lives**

The \`sections\` prop turns raw hover state into card content. That function is
the one place the library expects to know what your data means — and it lives
in your application, not in the package. Everything else here is generic.

**Why the card is portalled**

Straight to \`document.body\`, positioned \`fixed\`. A tooltip rendered inside the
map gets clipped by the first ancestor with \`overflow: hidden\` — which is the
most common failure in map UIs. It also flips and clamps against the viewport
edges, so inspecting data near the edge of the screen still works.

**Performance**

\`queryRenderedFeatures\` runs on every pointer move. Always scope \`layerIds\` to
the layers you actually care about; querying everything on a busy map is
noticeably expensive.
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

/** Reading a raster's value at the cursor. */
export const RasterProbe: Story = {
  args: { raster, title: 'Intensity', unit: 'index', sampling: 'nearest' },
  render: (args) => (
    <DemoMap note="Move the pointer over the field. The value comes from the same array that was colourised — no network, no extra decode.">
      <RasterLayer
        data={raster}
        colorScale={[...PALETTES.heat]}
        min={0}
        max={100}
        opacity={0.85}
      />
      <GeoLegend
        title="Intensity"
        colorScale={[...PALETTES.heat]}
        min={0}
        max={100}
        placement="bottom-right"
      />
      <GeoHover {...args} />
    </DemoMap>
  ),
};

/** `nearest` reports a real cell value; `bilinear` matches what you see. */
export const SamplingModes: Story = {
  args: { raster },
  render: () => (
    <div className="demo-grid">
      {(['nearest', 'bilinear'] as const).map((sampling) => (
        <DemoMap
          key={sampling}
          size="short"
          note={`sampling: "${sampling}"`}
        >
          <RasterLayer
            id={`probe-${sampling}`}
            data={raster}
            colorScale={[...PALETTES.viridis]}
            min={0}
            max={100}
            opacity={0.85}
          />
          <GeoHover raster={raster} sampling={sampling} title="Value" />
        </DemoMap>
      ))}
    </div>
  ),
};

/** Inspecting vector features. */
export const FeatureInspection: Story = {
  args: {},
  render: () => (
    <DemoMap note="Hovering a site shows its own properties, described by the story rather than guessed at by the library.">
      <VectorLayer
        id="sites"
        data={points}
        pointRadius={5}
        pointColor="#22d3ee"
        hitRadius={14}
      />
      <GeoHover
        layerIds={['sites-hit', 'sites-point']}
        sections={(state) => {
          const properties = state.features[0]?.properties;
          if (!properties) return [];
          return [
            {
              title: String(properties['name'] ?? 'Site'),
              accentColor: '#22d3ee',
              rows: [
                { label: 'Value', value: Number(properties['value']) },
                { label: 'Speed', value: Number(properties['speed']), unit: 'kt' },
                {
                  label: 'Direction',
                  value: Number(properties['direction']),
                  unit: '°',
                },
              ],
            },
          ];
        }}
      />
    </DemoMap>
  ),
};

/** Raster and vector in one card, as separate sections. */
export const CombinedSections: Story = {
  args: {},
  render: () => (
    <DemoMap note="One card, two sections: a probed raster value and the polygon underneath. Sections are how a composed map stays readable at the cursor.">
      <RasterLayer
        data={raster}
        colorScale={[...PALETTES.ocean]}
        min={0}
        max={100}
        opacity={0.8}
      />
      <VectorLayer
        id="zones"
        data={polygons}
        fill={['coalesce', ['get', 'color'], '#64748b']}
        fillOpacity={0.18}
        stroke={['coalesce', ['get', 'color'], '#94a3b8']}
        strokeWidth={1.5}
      />
      <GeoHover
        layerIds={['zones-fill']}
        raster={raster}
        sampling="bilinear"
        sections={(state) => {
          const sections = [];
          if (state.value != null) {
            sections.push({
              title: 'Raster',
              accentColor: '#38bdf8',
              rows: [
                { label: 'Value', value: state.value, unit: 'index' },
                {
                  label: 'Position',
                  value: `${state.lngLat[1].toFixed(2)}, ${state.lngLat[0].toFixed(2)}`,
                },
              ],
            });
          }
          const zone = state.features[0]?.properties;
          if (zone) {
            sections.push({
              title: String(zone['name'] ?? 'Zone'),
              accentColor: String(zone['color'] ?? '#f59e0b'),
              rows: [{ label: 'Intensity', value: Number(zone['intensity']) }],
            });
          }
          return sections;
        }}
      />
    </DemoMap>
  ),
};

/** Rendering the card body yourself. */
export const CustomCard: Story = {
  args: {},
  render: () => (
    <DemoMap note="`render` replaces the label/value rows while keeping the positioning, flipping and portalling.">
      <RasterLayer
        data={raster}
        colorScale={[...PALETTES.magma]}
        min={0}
        max={100}
        opacity={0.85}
      />
      <GeoHover
        raster={raster}
        sections={(state) => [
          {
            title: 'Reading',
            rows: [{ label: 'Value', value: state.value ?? null }],
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
              {Math.round(Number(sections[0]?.rows[0]?.value ?? 0))}
            </div>
            <div style={{ fontSize: 10, color: 'var(--gcl-fg-muted)', marginTop: 4 }}>
              INTENSITY INDEX
            </div>
          </div>
        )}
      />
    </DemoMap>
  ),
};

/** The hook on its own, for full control over what renders. */
export const HookOnly: Story = {
  args: {},
  render: () => {
    function Readout() {
      const hover = useMapHover({ raster, layerIds: ['sites-point'] });
      return (
        <div
          className="gcl-panel gcl-panel--floating gcl-panel--top-left"
          style={{ minWidth: 190 }}
        >
          <div className="gcl-panel__body demo-readout">
            {hover
              ? `value  ${hover.value?.toFixed(1) ?? '—'}
lng    ${hover.lngLat[0].toFixed(3)}
lat    ${hover.lngLat[1].toFixed(3)}
feats  ${hover.features.length}`
              : 'Move the pointer over the map.'}
          </div>
        </div>
      );
    }

    return (
      <DemoMap note="`useMapHover` returns the raw state — render it however you like, or feed it into your own state.">
        <RasterLayer
          data={raster}
          colorScale={[...PALETTES.viridis]}
          min={0}
          max={100}
          opacity={0.8}
        />
        <VectorLayer id="sites" data={points} pointRadius={4} pointColor="#f472b6" />
        <Readout />
      </DemoMap>
    );
  },
};

/** The card in isolation, positioned by hand. */
export const CardOnly: Story = {
  args: {},
  render: () => {
    const [position, setPosition] = useState({ x: 260, y: 200 });
    return (
      <DemoSurface note="`GeoHoverCard` needs no map at all. Move the pointer inside the box below.">
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
                subtitle: 'Positioned by hand',
                rows: [
                  { label: 'Alpha', value: 42 },
                  { label: 'Beta', value: 3.14159, unit: 'm' },
                  { label: 'Gamma', value: null },
                ],
              },
            ]}
          />
        </div>
      </DemoSurface>
    );
  },
};
