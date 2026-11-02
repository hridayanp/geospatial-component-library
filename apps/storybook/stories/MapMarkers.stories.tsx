import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MapMarker, MapPopup, PointPicker } from '@hridayanp/map-markers';
import type { LngLat } from '@hridayanp/geo-utils';
import { Panel } from '@hridayanp/ui';
import { DemoMap } from './demo/DemoMap';
import { makePoints } from './demo/data';

const SITES = makePoints(10, 3).features.map((feature) => ({
  id: String(feature.id),
  name: String(feature.properties?.['name']),
  value: Number(feature.properties?.['speed']),
  lngLat: (feature.geometry as { coordinates: number[] }).coordinates as LngLat,
}));

const tone = (value: number) => (value >= 35 ? '#ef4444' : value >= 20 ? '#f59e0b' : '#22c55e');

const meta = {
  title: 'Interaction/Map Markers',
  component: MapMarker,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
DOM markers and popups whose content is React, and a click-to-pick point
selector built from them.

**Installation**

\`\`\`bash
npm install @hridayanp/map-markers @hridayanp/map-container maplibre-gl react react-dom
import '@hridayanp/ui/styles.css';
\`\`\`

### Markers or a vector layer?

A marker is a DOM node repositioned every frame; a \`VectorLayer\` point is drawn
on the GPU. Use markers for a handful of things the reader interacts with one at
a time — a selected station, an alert, a waypoint — and \`VectorLayer\` for
hundreds of points.

### Content

Children render through a portal into the element MapLibre positions, so they
keep React context, state and handlers. Omit children for the default pin.
Markers with \`onClick\` become keyboard-focusable buttons with the given
\`label\`.

### Popups

\`MapPopup\` is controlled: render it to open, unmount it to close, and unmount
it from \`onClose\` when the user dismisses it. It is styled with the library
tokens in both themes.

### Picking a point

\`PointPicker\` turns a click into a coordinate, optionally snapped to a model
grid and rounded to a precision, and lets the reader drag the marker to adjust —
the first step of every point-forecast, meteogram or sounding flow.
`,
      },
    },
  },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof MapMarker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultPin: Story = {
  args: { lngLat: [92, 25.5], label: 'Demo point' },
  render: (args) => (
    <DemoMap note="With no children, the default pin in the accent colour.">
      <MapMarker {...args} />
    </DemoMap>
  ),
};

export const CustomContent: Story = {
  name: 'React content and popups',
  args: { lngLat: [92, 25.5] },
  render: function Render() {
    const [selected, setSelected] = useState<(typeof SITES)[number] | null>(null);
    return (
      <DemoMap note="Value chips as markers; click one for a popup with React content.">
        {SITES.map((site) => (
          <MapMarker key={site.id} lngLat={site.lngLat} label={`${site.name}, ${site.value} kt`} onClick={() => setSelected(site)}>
            <span
              style={{
                display: 'inline-block',
                padding: '2px 6px',
                borderRadius: 999,
                font: '600 11px var(--gcl-font)',
                color: '#0b1220',
                background: tone(site.value),
                boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
              }}
            >
              {site.value} kt
            </span>
          </MapMarker>
        ))}
        {selected && (
          <MapPopup lngLat={selected.lngLat} onClose={() => setSelected(null)} offset={14}>
            <strong>{selected.name}</strong>
            <div style={{ marginTop: 4, color: 'var(--gcl-fg-muted)' }}>Gust {selected.value} kt</div>
          </MapPopup>
        )}
      </DemoMap>
    );
  },
};

export const Draggable: Story = {
  args: { lngLat: [92, 25.5], draggable: true, label: 'Drag me' },
  render: function Render(args) {
    const [position, setPosition] = useState<LngLat>(args.lngLat);
    return (
      <DemoMap note="Drag the pin; the new position arrives through onDragEnd.">
        <MapMarker {...args} lngLat={position} onDragEnd={setPosition} />
        <Panel placement="top-left" title="Position">
          <div className="demo-readout">{`${position[1].toFixed(4)}, ${position[0].toFixed(4)}`}</div>
        </Panel>
      </DemoMap>
    );
  },
};

export const PickAPoint: Story = {
  name: 'PointPicker',
  args: { lngLat: [92, 25.5] },
  render: function Render() {
    const [point, setPoint] = useState<LngLat | null>(null);
    return (
      <DemoMap note="Click to pick; picks snap to the centres of a 0.25° grid (x.125, x.375, …). Drag to adjust.">
        <PointPicker value={point} onChange={setPoint} snap={0.25} gridOrigin={0.125} />
        <Panel placement="top-left" title="Picked point">
          <div className="demo-readout">{point ? `${point[1]}, ${point[0]}` : 'Click the map'}</div>
        </Panel>
      </DemoMap>
    );
  },
};
