import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  bearingBetween,
  boundsCenter,
  boundsToZoom,
  circlePositions,
  degreesToCompass,
  destinationPoint,
  formatDegrees,
  geoJsonBounds,
  geometryAnchor,
  haversineDistanceKm,
  padBounds,
  parseDirection,
  speedDirectionToUV,
  unionBounds,
  uvToSpeedDirection,
} from '@hridayanp/geo-utils';
import { VectorLayer } from '@hridayanp/vector-layer';
import { DemoMap, DemoSurface } from './demo/DemoMap';
import { DEMO_BOUNDS, makePolygons } from './demo/data';

const meta = {
  title: 'Utilities/Geo Utilities',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Dependency-free geospatial maths.

**Installation**

\`\`\`bash
npm install @hridayanp/geo-utils
\`\`\`

**Zero dependencies, on purpose**

Nothing here imports React, MapLibre, Turf or anything else — so it is equally
usable in a worker, on a server, or in a host that is not React at all. It is
also the only package every other one depends on, which is exactly why it has
to stay this light.

**What it covers**

- **Bounds** — \`[west, south, east, north]\` throughout, matching MapLibre,
  deck.gl and GeoJSON's own \`bbox\`, so a box can be handed to any of them
  without conversion.
- **Geodesy** — great-circle distance and bearing, projection along a bearing,
  compass parsing, and the speed/direction ↔ u/v conversions that flow
  rendering needs.
- **GeoJSON** — coordinate traversal, bounds, anchors, and the small helpers
  that keep messy real-world property names out of render code.
        `,
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Bounding-box maths. */
export const Bounds: Story = {
  render: () => {
    const padded = padBounds(DEMO_BOUNDS, 0.15);
    const other: [number, number, number, number] = [94, 27, 99, 31];
    return (
      <DemoSurface note="One ordering — [west, south, east, north] — used everywhere, so a box never needs converting between libraries.">
        <div className="demo-readout">
          {`domain        [${DEMO_BOUNDS.join(', ')}]
centre        [${boundsCenter(DEMO_BOUNDS).map((n) => n.toFixed(2)).join(', ')}]
padded 15%    [${padded.map((n) => n.toFixed(2)).join(', ')}]
union         [${unionBounds(DEMO_BOUNDS, other).join(', ')}]
zoom @1200px  ${boundsToZoom(DEMO_BOUNDS, 1200, 700).toFixed(2)}`}
        </div>
      </DemoSurface>
    );
  },
};

/** Distance, bearing and projection along a great circle. */
export const Geodesy: Story = {
  render: () => {
    const from: [number, number] = [90, 24];
    const to: [number, number] = [95, 28];
    const projected = destinationPoint(from, 45, 250);
    return (
      <DemoSurface>
        <div className="demo-readout">
          {`from                 [${from.join(', ')}]
to                   [${to.join(', ')}]
distance             ${haversineDistanceKm(from, to).toFixed(1)} km
bearing              ${bearingBetween(from, to).toFixed(1)}° (${degreesToCompass(bearingBetween(from, to))})
formatted            ${formatDegrees(bearingBetween(from, to))}
250 km on bearing 45 [${projected.map((n) => n.toFixed(3)).join(', ')}]`}
        </div>
      </DemoSurface>
    );
  },
};

/** Compass parsing, in every spelling real feeds use. */
export const CompassParsing: Story = {
  render: () => {
    const inputs = [
      'SSW',
      'South-Southwest',
      'SOUTHSOUTHWEST',
      'NNE',
      '  ne  ',
      '247.5',
      '410',
      'EEN',
      'not a direction',
    ];
    return (
      <DemoSurface note="The same quantity arrives spelled a dozen ways. Handling that in one place keeps it out of every render path that touches a direction.">
        <div className="demo-readout">
          {inputs
            .map((input) => {
              const parsed = parseDirection(input);
              return `${JSON.stringify(input).padEnd(22)} → ${
                parsed == null ? 'null' : `${parsed}° (${degreesToCompass(parsed)})`
              }`;
            })
            .join('\n')}
        </div>
      </DemoSurface>
    );
  },
};

/** Speed and direction ↔ u/v components. */
export const VectorComponents: Story = {
  render: () => {
    const cases: Array<[number, number, 'from' | 'towards']> = [
      [20, 0, 'from'],
      [20, 0, 'towards'],
      [20, 90, 'from'],
      [35, 225, 'from'],
    ];
    return (
      <DemoSurface note="Meteorological data reports where wind comes FROM. Getting this backwards is the most common reason a particle field flows the wrong way.">
        <div className="demo-readout">
          {cases
            .map(([speed, direction, convention]) => {
              const { u, v } = speedDirectionToUV(speed, direction, convention);
              const back = uvToSpeedDirection(u, v, convention);
              return `${String(speed).padStart(3)} kt @ ${String(direction).padStart(3)}° (${convention.padEnd(7)}) → u ${u.toFixed(2).padStart(7)}  v ${v.toFixed(2).padStart(7)}  → back ${back.speed.toFixed(1)} kt @ ${back.direction.toFixed(0)}°`;
            })
            .join('\n')}
        </div>
      </DemoSurface>
    );
  },
};

/** GeoJSON traversal, bounds and anchors. */
export const GeoJsonHelpers: Story = {
  render: () => {
    const polygons = makePolygons();
    const bounds = geoJsonBounds(polygons);
    const anchors = polygons.features.map((feature) => ({
      name: String(feature.properties?.['name']),
      anchor: geometryAnchor(feature.geometry),
    }));
    return (
      <DemoSurface note="Coordinate traversal is a generator, so walking a large collection allocates nothing beyond the current position.">
        <div className="demo-readout">
          {`bounds  [${bounds?.map((n) => n.toFixed(2)).join(', ')}]

${anchors
  .map(
    ({ name, anchor }) =>
      `${name.padEnd(10)} anchor [${anchor?.map((n) => n.toFixed(2)).join(', ')}]`,
  )
  .join('\n')}`}
        </div>
      </DemoSurface>
    );
  },
};

/** `circlePositions` builds a range ring without a geometry library. */
export const RangeRings: Story = {
  render: () => {
    const centre: [number, number] = [92, 25.5];
    const rings = [100, 200, 300].map((radius) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [circlePositions(centre, radius, 96)],
      },
      properties: { radius },
    }));

    return (
      <DemoMap note="Three great-circle rings at 100, 200 and 300 km. Built from `circlePositions` alone — no Turf, no buffer operation.">
        <VectorLayer
          data={{ type: 'FeatureCollection', features: rings }}
          fill={false}
          stroke="#38bdf8"
          strokeWidth={1.25}
          strokeDasharray={[3, 2]}
        />
        <VectorLayer
          id="centre"
          data={{
            type: 'Feature',
            geometry: { type: 'Point', coordinates: centre },
            properties: {},
          }}
          pointRadius={5}
          pointColor="#f472b6"
        />
      </DemoMap>
    );
  },
};
