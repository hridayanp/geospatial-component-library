import type { Meta, StoryObj } from '@storybook/react-vite';
import { GeoLegend, GeoLegendStack } from '@hridayanp/geo-legend';
import { RasterLayer } from '@hridayanp/raster-layer';
import { DemoMap, DemoSurface } from './demo/DemoMap';
import { PALETTES, makeRaster } from './demo/data';

const meta = {
  title: 'Overlays/Geo Legend',
  component: GeoLegend,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
A legend for arbitrary geospatial data.

**Installation**

\`\`\`bash
npm install @hridayanp/geo-legend react
import '@hridayanp/ui/styles.css';
\`\`\`

**Data format**

\`colorScale\` takes bare colours (spread evenly across the range) or explicit
\`[value, colour]\` stops when the breakpoints carry meaning — a rainfall scale
with class boundaries at 1, 5, 20 and 60 mm, for instance.

For a categorical legend, pass \`classes\` instead: an array of
\`{ color, label }\`, which replaces the ramp entirely.

**Nothing domain-specific**

A legend is a ramp, a range, a unit and a title. All four are props, so the
same component labels rainfall, probability and land cover without knowing what
any of them are.

**Works without a map**

\`GeoLegend\` renders anywhere. Use \`placement\` to dock it inside a
\`<MapContainer>\`, or omit it and lay the legend out yourself — in a sidebar, a
print layout, a report.
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

/** A continuous ramp with a title, unit and ticks. */
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
    <DemoSurface note="Rendered standalone — no map required.">
      <div style={{ maxWidth: 260 }}>
        <GeoLegend {...args} />
      </div>
    </DemoSurface>
  ),
};

/** Discrete mode draws flat bands rather than a gradient. */
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
    <DemoSurface note="Flat bands read as classes; a gradient reads as a continuum. The distinction changes how someone interprets the map.">
      <div style={{ maxWidth: 260 }}>
        <GeoLegend {...args} />
      </div>
    </DemoSurface>
  ),
};

/** Explicit classes, for categorical data. */
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
    <DemoSurface note="`classes` replaces the ramp with a swatch list. Labels are free-form nodes, so they can carry counts, icons or links.">
      <div style={{ maxWidth: 240 }}>
        <GeoLegend {...args} />
      </div>
    </DemoSurface>
  ),
};

/** Numeric class bounds, labelled automatically. */
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
    <DemoSurface note="With `from`/`to` and no label, the bounds are formatted for you at a precision chosen from the range.">
      <div style={{ maxWidth: 240 }}>
        <GeoLegend {...args} />
      </div>
    </DemoSurface>
  ),
};

/** Vertical orientation, for a narrow gutter. */
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

/** Custom value formatting. */
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
    <DemoSurface note="`formatValue` overrides the default precision — for units, locales, or non-numeric labels.">
      <div style={{ maxWidth: 260 }}>
        <GeoLegend {...args} />
      </div>
    </DemoSurface>
  ),
};

/** Collapsible, with a footer line. */
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
    <DemoSurface note="A footer is the right place for the thing a legend is most often asked for after the scale itself: what time it is showing.">
      <div style={{ maxWidth: 260 }}>
        <GeoLegend {...args} />
      </div>
    </DemoSurface>
  ),
};

/** Docked to a map corner. */
export const OnAMap: Story = {
  args: {
    title: 'Intensity',
    colorScale: [...PALETTES.heat],
    min: 0,
    max: 100,
    unit: 'index',
    ticks: 5,
    placement: 'bottom-right',
  },
  render: (args) => (
    <DemoMap note="`placement` docks the legend to a corner of the enclosing map.">
      <RasterLayer
        data={makeRaster()}
        colorScale={[...PALETTES.heat]}
        min={0}
        max={100}
        opacity={0.85}
      />
      <GeoLegend {...args} />
    </DemoMap>
  ),
};

/** Several legends stacked in one corner. */
export const Stacked: Story = {
  args: {},
  render: () => (
    <DemoMap note="A composed map needs a key per layer. `GeoLegendStack` keeps them in one tidy column instead of fighting for the same corner.">
      <RasterLayer
        data={makeRaster()}
        colorScale={[...PALETTES.ocean]}
        min={0}
        max={100}
        opacity={0.8}
      />
      <GeoLegendStack placement="bottom-right">
        <GeoLegend
          title="Rainfall"
          colorScale={[...PALETTES.ocean]}
          min={0}
          max={120}
          unit="mm"
        />
        <GeoLegend
          title="Wind"
          colorScale={['#bae6fd', '#facc15', '#ef4444']}
          min={0}
          max={40}
          unit="kt"
        />
        <GeoLegend
          title="Alerts"
          classes={[
            { color: '#f59e0b', label: 'Watch' },
            { color: '#ef4444', label: 'Warning' },
          ]}
        />
      </GeoLegendStack>
    </DemoMap>
  ),
};
