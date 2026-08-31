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
import { makePolygons } from './demo/data';
import { CONVECTIVE_BOUNDS, WIND_BOUNDS } from './demo/assets';

const meta = {
  title: 'Utilities/Geo Utilities',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
The geospatial primitives shared across the library: extent algebra, geodesy,
compass-bearing parsing and GeoJSON traversal.

**Installation**

\`\`\`bash
npm install @hridayanp/geo-utils
\`\`\`

### Position in the dependency graph

The package has no runtime dependencies and no peer dependencies, and nothing in
it references React, MapLibre or a geometry library. It is the one package every
other \`@hridayanp/*\` package depends on, which is precisely why its weight is
constrained: a dependency added here is added to all twelve at once.

The absence of peers also makes it usable outside a browser — in a Node service,
a web worker, or a host that is not React — so coordinate conventions can be
shared between a client renderer and a server-side pipeline without duplication.

### Coordinate conventions

These conventions are fixed here so that no other package re-decides them.

| Convention | Value |
| --- | --- |
| Coordinate reference system | Geographic WGS84 (EPSG:4326) |
| Coordinate order | \`[longitude, latitude]\`, per GeoJSON |
| Extent order | \`[west, south, east, north]\` |
| Extent semantics | Image or geometry edges, not outer cell centres |
| Raster row order | Northern row first |
| Direction convention | \`'from'\` (meteorological) by default |
| Distance unit | Kilometres |
| Angular unit | Degrees at the API surface, radians internally |
| Mercator latitude limit | \`MERCATOR_MAX_LATITUDE\` = 85.051129° |

The extent ordering matches MapLibre, deck.gl and the GeoJSON \`bbox\` member, so
a box can be passed to any of them without conversion.

### Coverage

- **Extents** — centre, dimensions, union, intersection, padding, containment,
  viewport fitting, and the four-corner form MapLibre \`image\` sources require.
  Winding order is significant there: an incorrect order flips or mirrors the
  placed raster, which is why it exists as a named function.
- **Geodesy** — great-circle distance and initial bearing on a sphere of radius
  \`EARTH_RADIUS_KM\` (6371.0088 km, the IUGG mean radius), projection along a
  bearing, range rings walked as great circles, compass parsing, and the
  speed/direction ↔ u/v conversions flow rendering requires.
- **GeoJSON** — normalisation to a FeatureCollection, generator-based coordinate
  traversal, extent computation, representative anchors, and property resolution
  from an alias list.

Haversine distances are accurate to roughly 0.5% against an ellipsoidal
geodesic: appropriate for range rings, proximity filtering and labelling, and
not appropriate for survey-grade measurement.
        `,
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Extent algebra. */
export const Bounds: Story = {
  render: () => {
    const padded = padBounds(CONVECTIVE_BOUNDS, 0.15);
    const other = WIND_BOUNDS;
    return (
      <DemoSurface note="One ordering — [west, south, east, north] in EPSG:4326 — used throughout, so an extent passes to MapLibre, deck.gl or a GeoJSON bbox without conversion and without ambiguity about which order a function expects.">
        <div className="demo-readout">
          {`raster.tif       [${CONVECTIVE_BOUNDS.map((n) => n.toFixed(3)).join(', ')}]
wind datasets    [${other.map((n) => n.toFixed(3)).join(', ')}]
centre           [${boundsCenter(CONVECTIVE_BOUNDS).map((n) => n.toFixed(3)).join(', ')}]
padded 15%       [${padded.map((n) => n.toFixed(3)).join(', ')}]
union            [${unionBounds(CONVECTIVE_BOUNDS, other).map((n) => n.toFixed(3)).join(', ')}]
zoom @1200x700   ${boundsToZoom(CONVECTIVE_BOUNDS, 1200, 700).toFixed(2)}`}
        </div>
      </DemoSurface>
    );
  },
};

/** Great-circle distance, initial bearing and projection along a bearing. */
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

/** Compass-bearing parsing across the spellings operational feeds emit. */
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
      <DemoSurface note="The same quantity arrives in numeric, abbreviated and expanded forms across feeds. Resolving it in one function keeps string normalisation out of every render path that handles a bearing; unparseable input returns null rather than a default.">
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

/** Resolving speed and bearing into eastward and northward components. */
export const VectorComponents: Story = {
  render: () => {
    const cases: Array<[number, number, 'from' | 'towards']> = [
      [20, 0, 'from'],
      [20, 0, 'towards'],
      [20, 90, 'from'],
      [35, 225, 'from'],
    ];
    return (
      <DemoSurface note="Meteorological data reports the bearing a flow originates from; oceanographic and drift data conventionally report the bearing of travel. Inverting this is the most frequent cause of a flow field animating against the expected direction.">
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

/** GeoJSON normalisation, traversal, extents and anchors. */
export const GeoJsonHelpers: Story = {
  render: () => {
    const polygons = makePolygons();
    const bounds = geoJsonBounds(polygons);
    const anchors = polygons.features.map((feature) => ({
      name: String(feature.properties?.['name']),
      anchor: geometryAnchor(feature.geometry),
    }));
    return (
      <DemoSurface note="iterateCoordinates is a generator, so computing an extent over a large collection allocates nothing beyond the current position rather than flattening every coordinate into an intermediate array.">
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

/** `circlePositions` constructs a geodesic range ring. */
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
      <DemoMap note="Rings at 100, 200 and 300 km. The positions are walked along great-circle bearings rather than constructed as a planar circle, so the ring stays geodesically correct at high latitude instead of distorting.">
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
