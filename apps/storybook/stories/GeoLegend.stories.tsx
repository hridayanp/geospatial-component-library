import type { Meta, StoryObj } from '@storybook/react-vite';
import { GeoLegend, GeoLegendStack } from '@hridayanp/geo-legend';
import { RasterLayer } from '@hridayanp/raster-layer';
import { DemoMap, DemoSurface } from './demo/DemoMap';
import { PALETTES } from './demo/data';
import {
  ASSET_FRAME_KEYS,
  CONVECTIVE_VIEW,
  loadConvectiveRaster,
} from './demo/assets';
import { useAsset } from './demo/useAsset';

const meta = {
  title: 'Overlays/Geo Legend',
  component: GeoLegend,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Renders the symbology key for a map layer: a continuous colour ramp with a
labelled value domain, or a classified swatch list for categorical data.

**Installation**

\`\`\`bash
npm install @hridayanp/geo-legend react
import '@hridayanp/ui/styles.css';
\`\`\`

### Responsibilities

The component owns ramp resolution, gradient construction, tick placement and
value formatting, together with placement, collapsing and stacking. Keeping the
ramp consistent with the layer's \`colorScale\`, and the meaning of the domain
and unit, remain with the consuming application.

Cartographic convention treats the legend as part of the map's meaning rather
than its decoration: a colour ramp without a domain and a unit is
uninterpretable. Ramp, domain, unit and title are therefore all props, so the
same component keys precipitation accumulation, probability of exceedance and
land cover without knowing what any of them are.

### Data model

\`colorScale\` is a \`LegendColorScale\` — an array of bare colours distributed
evenly across the domain, or explicit \`[value, colour]\` stops when the
breakpoints carry meaning. This is the same stop syntax \`RasterLayer\` and
\`@hridayanp/raster-utils\` accept, so one palette constant can drive both the
rendering and its key.

For a categorical key, \`classes\` takes an array of
\`{ color, label, from?, to? }\` and replaces the ramp entirely. Labels are React
nodes, so they can carry counts, badges or links; with numeric \`from\`/\`to\` and
no explicit label, the bounds are formatted automatically.

### Rendering model

\`mode\` selects between two cartographic representations. \`'continuous'\` draws
a gradient bar; \`'discrete'\` draws flat bands. The distinction is semantic
rather than decorative — flat bands communicate classification, a gradient
communicates a continuum — and should match how the underlying data was
produced. The same distinction exists on the rendering side as
\`ColorScale.mode\` in \`@hridayanp/raster-utils\`; the two should agree.

The default \`formatValue\` derives precision from the **domain** rather than
from the individual value, so a 0–1 probability scale receives two decimal
places where a 0–1000 pressure scale receives none.

### Integration boundaries

\`GeoLegend\` renders anywhere — inside a \`MapContainer\` via \`placement\`, or
as an ordinary block element in a sidebar, a print layout or a report. Only
\`placement\` presumes a positioned ancestor.

The package deliberately does not depend on \`@hridayanp/raster-utils\`: a legend
requires a CSS gradient and an ordered swatch list, not a colour-science library
and a GeoTIFF decoder, and carries its own ramp resolver instead.

\`GeoLegendStack\` docks several legends to one corner and keeps the container
transparent to pointer events, so map panning stays available between them.
        `,
      },
    },
  },
  argTypes: {
    mode: { control: 'inline-radio', options: ['continuous', 'discrete'] },
    orientation: { control: 'inline-radio', options: ['horizontal', 'vertical'] },
    ticks: { control: { type: 'range', min: 2, max: 9, step: 1 } },
    min: { control: 'number' },
    max: { control: 'number' },
    unit: { control: 'text' },
    title: { control: 'text' },
    collapsible: { control: 'boolean' },
    placement: {
      control: 'select',
      options: [
        undefined,
        'top-left',
        'top-right',
        'top-center',
        'bottom-left',
        'bottom-right',
        'bottom-center',
      ],
    },
  },
} satisfies Meta<typeof GeoLegend>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A continuous ramp with a title, a value domain, a unit and ticks. */
export const Continuous: Story = {
  args: {
    title: 'Accumulated rainfall',
    colorScale: [...PALETTES.ocean],
    min: 0,
    max: 120,
    unit: 'mm',
    ticks: 5,
  },
  render: (args) => (
    <DemoSurface note="Rendered standalone. Only `placement` presumes a positioned ancestor, so a legend is usable in a sidebar, a report or a print layout.">
      <div style={{ maxWidth: 260 }}>
        <GeoLegend {...args} />
      </div>
    </DemoSurface>
  ),
};

/** `mode="discrete"` draws flat bands in place of a gradient. */
export const Discrete: Story = {
  args: {
    title: 'Probability',
    mode: 'discrete',
    colorScale: ['#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8', '#1e3a8a'],
    min: 0,
    max: 100,
    unit: '%',
    ticks: 6,
  },
  render: (args) => (
    <DemoSurface note="The distinction is semantic: flat bands communicate classification, a gradient communicates a continuum. It should match how the underlying data was produced, and agree with the raster layer's own ColorScale.mode.">
      <div style={{ maxWidth: 260 }}>
        <GeoLegend {...args} />
      </div>
    </DemoSurface>
  ),
};

/** `classes` replaces the ramp entirely, for categorical symbology. */
export const Classes: Story = {
  args: {
    title: 'Land cover',
    classes: [
      { color: '#166534', label: 'Forest' },
      { color: '#65a30d', label: 'Grassland' },
      { color: '#a16207', label: 'Cropland' },
      { color: '#78716c', label: 'Built-up' },
      { color: '#0284c7', label: 'Water' },
    ],
  },
  render: (args) => (
    <DemoSurface note="An ordered swatch list rather than a ramp. Labels are React nodes, so they can carry feature counts, status badges or links.">
      <div style={{ maxWidth: 240 }}>
        <GeoLegend {...args} />
      </div>
    </DemoSurface>
  ),
};

/** Numeric class bounds, formatted automatically. */
export const ClassBounds: Story = {
  args: {
    title: 'Rainfall class',
    classes: [
      { color: '#dbeafe', from: 0, to: 1, label: '' },
      { color: '#93c5fd', from: 1, to: 5, label: '' },
      { color: '#3b82f6', from: 5, to: 20, label: '' },
      { color: '#1d4ed8', from: 20, to: 60, label: '' },
      { color: '#1e3a8a', from: 60, to: 200, label: '' },
    ],
    min: 0,
    max: 200,
    unit: 'mm',
  },
  render: (args) => (
    <DemoSurface note="With numeric `from`/`to` and no explicit label, the bounds are formatted at a precision derived from the domain.">
      <div style={{ maxWidth: 240 }}>
        <GeoLegend {...args} />
      </div>
    </DemoSurface>
  ),
};

/** `orientation="vertical"` renders the ramp as a narrow gutter. */
export const Vertical: Story = {
  args: {
    title: 'Elevation',
    colorScale: [...PALETTES.viridis],
    min: 0,
    max: 3500,
    unit: 'm',
    orientation: 'vertical',
    ticks: 5,
  },
  render: (args) => (
    <DemoSurface>
      <div style={{ maxWidth: 140 }}>
        <GeoLegend {...args} />
      </div>
    </DemoSurface>
  ),
};

/** `formatValue` overrides the domain-derived default precision. */
export const CustomFormatting: Story = {
  args: {
    title: 'Pressure',
    colorScale: [...PALETTES.diverging],
    min: 980,
    max: 1040,
    unit: 'hPa',
    ticks: 4,
    formatValue: (value: number) => `${value.toFixed(0)}`,
  },
  render: (args) => (
    <DemoSurface note="Appropriate for locale-specific number formatting, non-linear domains, or tick labels that are not numeric at all.">
      <div style={{ maxWidth: 260 }}>
        <GeoLegend {...args} />
      </div>
    </DemoSurface>
  ),
};

/** A collapsible legend with a footer line. */
export const CollapsibleWithFooter: Story = {
  args: {
    title: 'Intensity',
    colorScale: [...PALETTES.heat],
    min: 0,
    max: 100,
    collapsible: true,
    footer: '01 Jan 2026 06:00 UTC',
  },
  render: (args) => (
    <DemoSurface note="The footer carries the metadata a legend is most often asked for after the scale itself — valid time, model run, or data source.">
      <div style={{ maxWidth: 260 }}>
        <GeoLegend {...args} />
      </div>
    </DemoSurface>
  ),
};

/** `placement` docks the legend to a corner of the enclosing map. */
export const OnAMap: Story = {
  args: {
    title: 'Convective probability',
    colorScale: [...PALETTES.heat],
    min: 0,
    max: 50,
    unit: '%',
    ticks: 5,
    placement: 'bottom-right',
  },
  render: (args) => {
    const { value: raster } = useAsset(loadConvectiveRaster);
    return (
    <DemoMap {...CONVECTIVE_VIEW} note="Accepted values are top-left, top-center, top-right, bottom-left, bottom-center and bottom-right. Omitting the prop renders the legend as an ordinary block element.">
      <RasterLayer
        data={raster}
        frameKey={ASSET_FRAME_KEYS.convective}
        colorScale={[...PALETTES.heat]}
        min={0}
        max={50}
        opacity={0.85}
      />
      <GeoLegend {...args} />
    </DemoMap>
    );
  },
};

/** `GeoLegendStack` docks several legends to one corner. */
export const Stacked: Story = {
  args: {},
  render: () => {
    const { value: raster } = useAsset(loadConvectiveRaster);
    return (
    <DemoMap {...CONVECTIVE_VIEW} note="A composed map requires one key per layer. Docking each legend independently would place them at the same coordinates; the stack also stays transparent to pointer events, so map panning remains available between them.">
      <RasterLayer
        data={raster}
        frameKey={ASSET_FRAME_KEYS.convective}
        colorScale={[...PALETTES.ocean]}
        min={0}
        max={50}
        opacity={0.8}
      />
      <GeoLegendStack placement="bottom-right">
        <GeoLegend
          title="Convective probability"
          colorScale={[...PALETTES.ocean]}
          min={0}
          max={50}
          unit="%"
        />
        <GeoLegend
          title="Gust"
          colorScale={['#bae6fd', '#facc15', '#ef4444']}
          min={0}
          max={25}
          unit="kt"
        />
        <GeoLegend
          title="Advisories"
          classes={[
            { color: '#f59e0b', label: 'Watch' },
            { color: '#ef4444', label: 'Warning' },
          ]}
        />
      </GeoLegendStack>
    </DemoMap>
    );
  },
};
