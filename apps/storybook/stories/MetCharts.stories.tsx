import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  CrossSectionChart,
  Hodograph,
  Meteogram,
  ProfileChart,
  ScatterChart,
  SkewTChart,
  Sparkline,
  WindCompass,
  WindRose,
  profileAlongPath,
} from '@hridayanp/met-charts';
import type { LngLat } from '@hridayanp/geo-utils';
import { VectorLayer } from '@hridayanp/vector-layer';
import { RasterLayer } from '@hridayanp/raster-layer';
import { MapMarker } from '@hridayanp/map-markers';
import { DemoMap, DemoSurface } from './demo/DemoMap';
import { PALETTES, makeRaster } from './demo/data';
import {
  makeCrossSection,
  makeMeteogram,
  makeSounding,
  makeVerificationPairs,
  makeWindSamples,
} from './demo/met';

const SOUNDING = makeSounding();
const WIND = makeWindSamples();
const METEOGRAM = makeMeteogram();
const PAIRS = makeVerificationPairs();
const SECTION = makeCrossSection();
const FIELD = makeRaster({ seed: 7, width: 120, height: 104 });
const LINE: LngLat[] = [
  [88.6, 23.0],
  [91.8, 25.4],
  [95.4, 27.8],
];

const meta = {
  title: 'Analysis/Meteorological Charts',
  component: SkewTChart,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Meteorological charts as dependency-free SVG: Skew-T log-P, hodograph, wind
rose, meteogram, along-line profile, vertical cross-section, forecast
verification scatter, sparkline and wind compass.

**Installation**

\`\`\`bash
npm install @hridayanp/met-charts react
import '@hridayanp/ui/styles.css';
\`\`\`

### One shell

Every chart is built on \`ChartFrame\` from \`geo-charts\`: the same heading, legend
and keyboard-reachable **table view** carrying every plotted value, so nothing is
available only by hovering or by telling colours apart.

### Thermodynamics

\`SkewTChart\` lifts the lowest level and reports LCL, LFC, EL, CAPE and CIN.
The functions behind it — \`saturationVaporPressure\`, \`moistAdiabat\`,
\`liftingCondensationLevel\`, \`analyzeParcel\` — use Bolton (1980) and a
pseudo-adiabatic lapse rate integrated with RK2, matching MetPy's defaults to
within a few tenths of a degree. CAPE uses temperature, not virtual
temperature: the textbook definition, a few per cent low.

### Time

\`Meteogram\` formats every time in UTC (\`Wed 16 12Z\`). Forecasts are issued in
UTC, and a local-time axis is a quiet source of off-by-hours misreadings.

### Data in, never fetched

\`profileAlongPath\` samples any \`RasterData\` along a drawn line at great-circle
spacing; \`windRoseBins\` and \`verificationStats\` compute the rose and the
scores. Each is a pure function usable without the chart.
`,
      },
    },
  },
  argTypes: { levels: { control: false } },
} satisfies Meta<typeof SkewTChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SkewT: Story = {
  name: 'Skew-T log-P',
  args: { levels: SOUNDING, title: 'Sounding · 30 Oct 2026 00Z', showParcel: true, showReferenceLines: true, showWindBarbs: true },
  render: (args) => (
    <DemoSurface note="Temperature and dewpoint over dry adiabats, moist adiabats and mixing-ratio lines; the dashed path is the surface parcel.">
      <div style={{ maxWidth: 640 }}>
        <SkewTChart {...args} />
      </div>
    </DemoSurface>
  ),
};

export const HodographStory: Story = {
  name: 'Hodograph',
  args: { levels: SOUNDING },
  render: () => (
    <DemoSurface note="The same profile as a hodograph: veering with height, coloured from the surface up.">
      <Hodograph
        title="Hodograph"
        levels={SOUNDING.filter((l) => l.pressure >= 200).map((l) => ({
          speed: l.windSpeed ?? 0,
          direction: l.windDirection ?? 0,
          level: l.height ?? 0,
          ...(l.pressure % 200 === 0 || l.pressure === 850 ? { label: `${l.pressure}` } : {}),
        }))}
      />
    </DemoSurface>
  ),
};

export const WindRoseStory: Story = {
  name: 'Wind rose',
  args: { levels: SOUNDING },
  render: () => (
    <DemoSurface note="2,000 hourly observations with a prevailing south-westerly. Calms are reported in the subtitle, not spread across petals.">
      <WindRose title="Wind rose · October" samples={WIND} speedBins={[0, 5, 10, 15, 20, 25]} />
    </DemoSurface>
  ),
};

export const MeteogramStory: Story = {
  name: 'Meteogram',
  args: { levels: SOUNDING },
  render: () => (
    <DemoSurface note="72 hours at one point, on a shared UTC axis with one crosshair across every panel.">
      <Meteogram
        title="Point forecast · 26.14°N 91.74°E"
        times={METEOGRAM.times}
        marker={METEOGRAM.times[18]}
        panels={[
          {
            id: 'temp',
            label: 'Temperature',
            unit: '°C',
            series: [
              { id: 't2m', label: 'Air temperature', values: METEOGRAM.temperature, color: '#e34948' },
              { id: 'td', label: 'Dewpoint', values: METEOGRAM.dewpoint, color: '#1baf7a' },
            ],
          },
          { id: 'rain', label: 'Rain', unit: 'mm', height: 80, series: [{ id: 'tp', label: 'Hourly rain', values: METEOGRAM.rain, type: 'bar', color: '#2a78d6' }] },
          { id: 'mslp', label: 'MSLP', unit: 'hPa', height: 80, series: [{ id: 'mslp', label: 'Pressure', values: METEOGRAM.pressure, color: '#4a3aa7' }] },
        ]}
        wind={{ speed: METEOGRAM.windSpeed, direction: METEOGRAM.windDirection, every: 3 }}
      />
    </DemoSurface>
  ),
};

export const Profile: Story = {
  name: 'Profile along a line',
  args: { levels: SOUNDING },
  render: function Render() {
    const samples = useMemo(() => profileAlongPath(FIELD, LINE, { samples: 240 }), []);
    const [hover, setHover] = useState<number | null>(null);
    const line = useMemo(
      () => ({ type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: LINE }, properties: {} }),
      [],
    );
    return (
      <div>
        <DemoMap size="short" note="Hover the chart: the marker follows the sample on the map.">
          <RasterLayer data={FIELD} colorScale={[...PALETTES.ocean]} opacity={0.8} />
          <VectorLayer data={line} stroke="#facc15" strokeWidth={2.5} />
          {hover != null && samples[hover] && <MapMarker lngLat={samples[hover]!.lngLat} />}
        </DemoMap>
        <DemoSurface>
          <ProfileChart title="Value along the line" samples={samples} yLabel="Value" onHoverSample={setHover} />
        </DemoSurface>
      </div>
    );
  },
};

export const CrossSection: Story = {
  name: 'Vertical cross-section',
  args: { levels: SOUNDING },
  render: () => (
    <DemoSurface note="Relative humidity through a moist column, on distance against log-pressure.">
      <CrossSectionChart
        title="Relative humidity"
        unit="%"
        distancesKm={SECTION.distancesKm}
        levels={SECTION.levels}
        values={SECTION.values}
        colorScale={['#f7fbff', '#c6dbef', '#6baed6', '#2171b5', '#08306b']}
        min={0}
        max={100}
      />
    </DemoSurface>
  ),
};

export const Verification: Story = {
  name: 'Forecast verification',
  args: { levels: SOUNDING },
  render: () => (
    <DemoSurface note="Points above the 1:1 line were over-forecast. The fitted slope below one shows a forecast too timid at the extremes.">
      <ScatterChart title="2 m temperature · day 1" unit="°C" points={PAIRS} />
    </DemoSurface>
  ),
};

export const Small: Story = {
  name: 'Sparkline and wind compass',
  args: { levels: SOUNDING },
  render: () => (
    <DemoSurface note="Word-sized forms for tables, stat tiles and popups.">
      <div className="demo-grid">
        <div>
          <div className="demo-note">Temperature, 72 h</div>
          <Sparkline values={METEOGRAM.temperature} width={160} height={36} color="#e34948" fill label="Temperature over 72 hours, diurnal cycle" />
        </div>
        <div>
          <div className="demo-note">Rain, 72 h</div>
          <Sparkline values={METEOGRAM.rain} width={160} height={36} color="#2a78d6" label="Hourly rain over 72 hours, afternoon showers" />
        </div>
        <div className="gcl-row" style={{ gap: 16 }}>
          <WindCompass direction={225} speed={18} />
          <WindCompass direction={90} speed={6} size={56} />
          <WindCompass direction={null} speed={0} size={56} />
        </div>
      </div>
    </DemoSurface>
  ),
};
