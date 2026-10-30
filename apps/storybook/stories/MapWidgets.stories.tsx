import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  COLOR_RAMPS,
  ColorRampPicker,
  CoordinateReadout,
  LocationSearch,
  MapLoadingOverlay,
  MiniMap,
  NorthArrow,
  ScaleBar,
  type LocationResult,
} from '@hridayanp/map-widgets';
import { MapControlBar, ZoomControl } from '@hridayanp/map-controls';
import { RasterLayer } from '@hridayanp/raster-layer';
import { GeoLegend } from '@hridayanp/geo-legend';
import { Button, Panel } from '@hridayanp/ui';
import { DemoMap } from './demo/DemoMap';
import { makeRaster } from './demo/data';

const FIELD = makeRaster({ seed: 5 });

/** An offline gazetteer standing in for the host's geocoder. */
const PLACES: LocationResult[] = [
  { id: 'gau', label: 'Guwahati', description: 'Assam, India', lngLat: [91.7362, 26.1445] },
  { id: 'shl', label: 'Shillong', description: 'Meghalaya, India', lngLat: [91.8933, 25.5788] },
  { id: 'dha', label: 'Dhaka', description: 'Bangladesh', lngLat: [90.4125, 23.8103] },
  { id: 'imp', label: 'Imphal', description: 'Manipur, India', lngLat: [93.9368, 24.817] },
  { id: 'agt', label: 'Agartala', description: 'Tripura, India', lngLat: [91.2868, 23.8315] },
  { id: 'koh', label: 'Kohima', description: 'Nagaland, India', lngLat: [94.1086, 25.6751] },
  { id: 'aiz', label: 'Aizawl', description: 'Mizoram, India', lngLat: [92.7176, 23.7271] },
  { id: 'sil', label: 'Silchar', description: 'Assam, India', lngLat: [92.7789, 24.8333] },
  { id: 'dib', label: 'Dibrugarh', description: 'Assam, India', lngLat: [94.9119, 27.4728] },
  { id: 'thi', label: 'Thimphu', description: 'Bhutan', lngLat: [89.6386, 27.4728] },
];

const searchPlaces = async (query: string, signal: AbortSignal): Promise<LocationResult[]> => {
  // Simulated latency, so the debounce and the spinner are visible.
  await new Promise((resolve) => setTimeout(resolve, 250));
  if (signal.aborted) return [];
  const q = query.toLowerCase();
  return PLACES.filter((p) => p.label.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
};

const meta = {
  title: 'Overlays/Map Widgets',
  component: ScaleBar,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
The furniture around a map: scale bar, cursor coordinates, north arrow, overview
inset, place search, colour-ramp picker and a loading indicator.

**Installation**

\`\`\`bash
npm install @hridayanp/map-widgets @hridayanp/map-container maplibre-gl react
import '@hridayanp/ui/styles.css';
\`\`\`

### Components

\`ScaleBar\` measures geodesic distance across its own width at the centre of the
view on every move — Web Mercator's scale at 60° is half that at the equator —
and rounds to 1–2–5 steps in metric, imperial or nautical units.

\`CoordinateReadout\` shows the position under the pointer, latitude first, in
decimal, DMS or degrees-decimal-minutes; it falls back to the map centre when
the pointer leaves, and updates at most once per frame.

\`NorthArrow\` turns with the map and resets bearing (and pitch) on click; by
default it appears only once the map is rotated.

\`MiniMap\` is a second, non-interactive map following the main one at a zoom
offset with the viewport outlined; clicking it recentres the main map.

\`LocationSearch\` owns the interaction — debounce, cancellation of stale
requests, keyboard navigation, the ARIA combobox pattern — and none of the
data: \`onSearch\` is the host's geocoder. Typed coordinates are recognised
without a search.

\`ColorRampPicker\` offers perceptually ordered scientific ramps and emits the
colours themselves, ready for any \`colorScale\` prop.

\`MapLoadingOverlay\` follows the map's own loading state, or a \`loading\` prop,
after a short delay so fast loads never flash.

### Scope

Layer pickers stay out of this package, as they do in \`map-controls\`: which
layers exist and how they group is the application's information architecture,
not a property of a map.
`,
      },
    },
  },
} satisfies Meta<typeof ScaleBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Furniture: Story = {
  name: 'Scale, coordinates and north arrow',
  args: { unit: 'metric' },
  render: (args) => (
    <DemoMap bearing={-25} note="Rotated 25°, so the north arrow is visible; click it to face north again.">
      <ScaleBar {...args} />
      <CoordinateReadout showZoom />
      <MapControlBar>
        <ZoomControl />
        <NorthArrow />
      </MapControlBar>
    </DemoMap>
  ),
};

export const NauticalScale: Story = {
  args: { unit: 'nautical', maxWidth: 160 },
  render: (args) => (
    <DemoMap zoom={7} note="Nautical miles for marine and aviation products; the readout in degrees and decimal minutes.">
      <ScaleBar {...args} />
      <CoordinateReadout format="ddm" />
    </DemoMap>
  ),
};

export const Overview: Story = {
  name: 'MiniMap',
  render: () => (
    <DemoMap zoom={8} note="The inset outlines the main view; click it to jump.">
      <MiniMap zoomOffset={4} placement="bottom-right" />
    </DemoMap>
  ),
};

export const Search: Story = {
  name: 'LocationSearch',
  render: function Render() {
    const [picked, setPicked] = useState<LocationResult | null>(null);
    return (
      <DemoMap note="Search an offline gazetteer, or type a coordinate such as 26.14N 91.74E.">
        <LocationSearch onSearch={searchPlaces} onSelect={setPicked} />
        {picked && (
          <Panel placement="bottom-left" title="Selected">
            <div className="demo-readout">{`${picked.label}\n${picked.lngLat[1].toFixed(4)}, ${picked.lngLat[0].toFixed(4)}`}</div>
          </Panel>
        )}
      </DemoMap>
    );
  },
};

export const RampPicker: Story = {
  name: 'ColorRampPicker',
  render: function Render() {
    const [ramp, setRamp] = useState('viridis');
    const [colors, setColors] = useState<string[]>([...COLOR_RAMPS[0]!.colors]);
    const [reversed, setReversed] = useState(false);
    return (
      <DemoMap note="The picker emits colours; the raster and its legend take them unchanged.">
        <RasterLayer data={FIELD} colorScale={colors} opacity={0.85} />
        <Panel placement="top-left" title="Colour ramp">
          <ColorRampPicker
            value={ramp}
            reversed={reversed}
            onReversedChange={setReversed}
            onChange={(id, next) => {
              setRamp(id);
              setColors(next);
            }}
          />
        </Panel>
        <GeoLegend title="Value" colorScale={colors} min={0} max={100} placement="bottom-right" />
      </DemoMap>
    );
  },
};

export const Loading: Story = {
  name: 'MapLoadingOverlay',
  render: function Render() {
    const [loading, setLoading] = useState(true);
    return (
      <DemoMap note="Controlled here; omit `loading` to follow the map's own tile loading.">
        <MapLoadingOverlay loading={loading} label="Loading forecast…" />
        <Panel placement="bottom-left">
          <Button variant="outline" size="sm" onClick={() => setLoading((v) => !v)}>
            {loading ? 'Finish loading' : 'Start loading'}
          </Button>
        </Panel>
      </DemoMap>
    );
  },
};
