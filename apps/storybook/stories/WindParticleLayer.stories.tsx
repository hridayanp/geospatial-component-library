import { useEffect, useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { WindParticleLayer } from '@hridayanp/wind-particle-layer';
import { DeckOverlay } from '@hridayanp/deck-overlay';
import { GeoLegend } from '@hridayanp/geo-legend';
import { RasterLayer } from '@hridayanp/raster-layer';
import { DemoMap } from './demo/DemoMap';
import {
  ASSET_FRAME_KEYS,
  WIND_VIEW,
  loadWindField,
  loadWindObservations,
  loadWindSpeedRaster,
} from './demo/assets';
import { useAsset } from './demo/useAsset';
import { deriveWindFields } from './demo/derive';

const SPEED_COLORS = ['#bae6fd', '#7dd3fc', '#facc15', '#fb923c', '#ef4444'];
const MAX_SPEED = 36;

/** Cache identity for the rasterised point field; see `WindPoints.frameKey`. */
const OBSERVATION_FRAME_KEY = 'asset:wind_particle_vector.geojson';

const meta = {
  title: 'Geospatial/Wind Particle Layer',
  component: WindParticleLayer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Visualises a two-dimensional vector field as GPU-advected flow particles.
Rendering is performed by WeatherLayers GL through deck.gl, composited into the
MapLibre render pass.

**Installation**

\`\`\`bash
npm install @hridayanp/wind-particle-layer @hridayanp/map-container \\
  maplibre-gl weatherlayers-gl @deck.gl/core @deck.gl/mapbox @deck.gl/extensions @deck.gl/layers
\`\`\`

### Responsibilities

The component owns field normalisation, UV texture encoding, rasterisation of
scattered observations, and deck.gl layer construction. Field retrieval,
temporal alignment, unit conversion and the direction convention of the source
data remain with the consuming application — the last of these is declared
through props rather than inferred.

### Data model

Three input forms converge on one representation, a UV-encoded RGBA texture:

- **\`{ kind: 'field', u, v, width, height, bounds, noData? }\`** — a velocity
  grid. \`u\` is the eastward component and \`v\` the northward one, row-major
  with the northern row first. This is the canonical form and encodes directly,
  with no resampling.
- **\`{ kind: 'points', data, speedProperty?, directionProperty?, directionConvention?, frameKey? }\`**
  — scattered observations carrying speed and bearing. The layer rasterises them
  onto a grid whose resolution is inferred from the observations' own spacing.
- **\`{ kind: 'image', url, bounds, imageUnscale? }\`** — a UV-encoded image
  produced by an upstream pipeline.

### Rendering model

Velocities are packed into an RGBA texture and uploaded once:

\`\`\`text
R = (u + maxSpeed) / (2 * maxSpeed) * 255    eastward component
G = (v + maxSpeed) / (2 * maxSpeed) * 255    northward component
B = 0
A = 255 where data exists, 0 elsewhere
\`\`\`

From that point the GPU advects every particle and reconstructs speed as
\`sqrt(u² + v²)\` to sample the colour ramp. No per-frame CPU work occurs, which
is why 5,000 particles cost approximately what 500 cost.

Alpha must be exactly \`255\`. WeatherLayers treats any lower value as absent
data and renders no particles there — the usual cause of an unexplained gap when
a texture is encoded by an external pipeline.

### Rasterising scattered observations

Grid resolution is derived from the median gap between sorted unique
coordinates, so the texture matches the real resolution of the observations.
Gaps are filled with a distance-weighted neighbour average across four passes,
orthogonal neighbours weighted \`1\` and diagonals \`1/√2\`; nearest-neighbour
copying instead leaves a visible seam where two filled regions meet. Generated
textures are capped at 512 px on the longest edge.

### Direction convention

Meteorological data reports the bearing a flow originates **from**, which is the
default. Ocean current and drift data conventionally report the bearing of
travel — \`directionConvention: 'towards'\`. An inverted field is almost always
this prop.

### Temporal transitions

When the field changes, the previous and current textures are blended on the GPU
over \`transitionMs\`, so particles retain their positions and trails through a
timeline step. Blending applies only when consecutive grids have identical
dimensions; otherwise the new field replaces the previous one outright.

### Data used in these stories

\`assets/wind_particle_vector.geojson\` — 15,107 Point observations in
EPSG:4326 over 67.875, 5.875, 97.875, 37.875, carrying \`wind_speed_kt\`
(0.1–35.4), \`wind_dir_deg\` and \`wind_dir_deg_compass\`. Bearings follow the
meteorological convention.

\`assets/wind_particle_raster.tif\` — the corresponding 120 × 128 wind-speed
band at 0.25°, rendered beneath the particles where a magnitude field is useful.

The velocity grid used by the \`kind: 'field'\` stories is derived from those
observations by resolving speed and bearing into eastward and northward
components with \`speedDirectionToUV\` and binning onto the source lattice.

### Performance

\`particleCount\` dominates: 2,000–3,000 reads well at continental scale, and
beyond roughly 10,000 the field saturates visually before it becomes slow.
\`maxAge\` multiplies trail geometry and is the second cost.

### Geospatial considerations

WebGL2 is required; there is no software fallback. \`bounds\` is EPSG:4326 and
describes the grid's outer edges — no reprojection is performed. 8-bit UV
encoding gives a quantisation step of \`2 × maxSpeed / 255\`, so \`maxSpeed\`
should be set close to the data's actual range. Particles are clipped to
±85.05° latitude, the Web Mercator limit.
        `,
      },
    },
  },
  argTypes: {
    particleCount: { control: { type: 'range', min: 100, max: 8000, step: 100 } },
    speedFactor: { control: { type: 'range', min: 0.5, max: 20, step: 0.5 } },
    maxAge: { control: { type: 'range', min: 5, max: 120, step: 5 } },
    width: { control: { type: 'range', min: 0.5, max: 6, step: 0.1 } },
    opacity: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    maxSpeed: { control: { type: 'range', min: 5, max: 120, step: 5 } },
    transitionMs: { control: { type: 'range', min: 0, max: 3000, step: 100 } },
    imageSmoothing: { control: { type: 'range', min: 0, max: 3, step: 0.1 } },
    visible: { control: 'boolean' },
    // An [r, g, b, a] tuple, not a CSS colour string.
    color: { control: 'object' },
    colors: { control: 'object' },
    data: { control: false },
  },
} satisfies Meta<typeof WindParticleLayer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A velocity grid — the canonical input form. */
export const Basic: Story = {
  args: {
    particleCount: 2500,
    speedFactor: 6,
    maxAge: 45,
    width: 1.4,
    opacity: 0.9,
    maxSpeed: MAX_SPEED,
    colors: SPEED_COLORS,
  },
  render: (args) => {
    const { value: field } = useAsset(loadWindField);
    return (
      <DemoMap
        {...WIND_VIEW}
        note="A 120 × 128 u/v grid at 0.25°, derived from the sample observations. Every control below is a live prop."
      >
        <WindParticleLayer {...args} data={field} />
        <GeoLegend
          title="Wind speed"
          colorScale={SPEED_COLORS}
          min={0}
          max={MAX_SPEED}
          unit="kt"
          ticks={5}
          placement="bottom-right"
        />
      </DemoMap>
    );
  },
};

/**
 * Scattered observations supplied directly. The layer rasterises them onto a
 * grid inferred from their own spacing, producing the same field the
 * `kind: 'field'` story constructs explicitly.
 */
export const FromScatteredPoints: Story = {
  args: {
    particleCount: 2200,
    speedFactor: 5,
    maxAge: 40,
    colors: SPEED_COLORS,
    maxSpeed: MAX_SPEED,
  },
  render: (args) => {
    const { value: observations } = useAsset(loadWindObservations);
    const { value: speed } = useAsset(loadWindSpeedRaster);
    const data = useMemo(
      () =>
        observations
          ? ({
              kind: 'points',
              data: observations,
              speedProperty: 'wind_speed_kt',
              directionProperty: 'wind_dir_deg',
              directionConvention: 'from',
              frameKey: OBSERVATION_FRAME_KEY,
            } as const)
          : null,
      [observations],
    );

    return (
      <DemoMap
        {...WIND_VIEW}
        note="15,107 observations with wind_speed_kt and wind_dir_deg, over the corresponding wind-speed band. frameKey prevents the field being rebuilt when the object identity changes."
      >
        <RasterLayer
          data={speed}
          frameKey={ASSET_FRAME_KEYS.windSpeed}
          colorScale={['#0b2545', '#134074', '#8da9c4']}
          min={0}
          max={30}
          opacity={0.55}
        />
        <WindParticleLayer {...args} data={data} />
        <GeoLegend
          title="Wind speed"
          colorScale={SPEED_COLORS}
          min={0}
          max={MAX_SPEED}
          unit="kt"
          placement="bottom-right"
        />
      </DemoMap>
    );
  },
};

/**
 * The same observations read under each convention. `'from'` is the
 * meteorological default and matches how the sample file records bearings.
 */
export const DirectionConvention: Story = {
  args: { particleCount: 1500, colors: SPEED_COLORS, maxSpeed: MAX_SPEED },
  render: (args) => {
    const { value: observations } = useAsset(loadWindObservations);
    return (
      <div>
        <p className="demo-note">
          Identical observations, opposite interpretations. A field animating
          against the expected flow is almost always this prop rather than an
          error in the data.
        </p>
        <div className="demo-grid">
          {(['from', 'towards'] as const).map((convention) => (
            <DemoMap
              key={convention}
              {...WIND_VIEW}
              size="short"
              note={`directionConvention: "${convention}"`}
            >
              <WindParticleLayer
                {...args}
                id={`wind-${convention}`}
                data={
                  observations
                    ? {
                        kind: 'points',
                        data: observations,
                        speedProperty: 'wind_speed_kt',
                        directionProperty: 'wind_dir_deg',
                        directionConvention: convention,
                        frameKey: `${OBSERVATION_FRAME_KEY}:${convention}`,
                      }
                    : null
                }
              />
            </DemoMap>
          ))}
        </div>
      </div>
    );
  },
};

/**
 * `particleCount` is the dominant rendering cost and the primary readability
 * control.
 */
export const ParticleDensity: Story = {
  args: { colors: SPEED_COLORS, maxSpeed: MAX_SPEED },
  render: (args) => {
    const { value: field } = useAsset(loadWindField);
    return (
      <div>
        <p className="demo-note">
          Density is a legibility decision before it is a performance one: past a
          few thousand particles the field saturates and individual trajectories
          stop being readable.
        </p>
        <div className="demo-grid">
          {[400, 2500, 7000].map((count) => (
            <DemoMap key={count} {...WIND_VIEW} size="short" note={`${count} particles`}>
              <WindParticleLayer
                {...args}
                id={`wind-density-${count}`}
                data={field}
                particleCount={count}
              />
            </DemoMap>
          ))}
        </div>
      </div>
    );
  },
};

/** `maxAge` sets trail length in frames, and multiplies trail geometry. */
export const TrailLength: Story = {
  args: { colors: SPEED_COLORS, particleCount: 1800, maxSpeed: MAX_SPEED },
  render: (args) => {
    const { value: field } = useAsset(loadWindField);
    return (
      <div className="demo-grid">
        {[10, 45, 100].map((maxAge) => (
          <DemoMap key={maxAge} {...WIND_VIEW} size="short" note={`maxAge: ${maxAge}`}>
            <WindParticleLayer
              {...args}
              id={`wind-age-${maxAge}`}
              data={field}
              maxAge={maxAge}
            />
          </DemoMap>
        ))}
      </div>
    );
  },
};

/**
 * `color` takes a single `[r, g, b, a]` tuple and overrides `colors`.
 * Appropriate when magnitude is already encoded by a raster beneath and the
 * particles need only convey direction.
 */
export const SingleColor: Story = {
  args: {
    particleCount: 2000,
    color: [226, 232, 240, 255],
    opacity: 0.85,
    maxSpeed: MAX_SPEED,
  },
  render: (args) => {
    const { value: field } = useAsset(loadWindField);
    const { value: speed } = useAsset(loadWindSpeedRaster);
    return (
      <DemoMap
        {...WIND_VIEW}
        size="short"
        note="Speed is carried by the raster band; the particles carry direction and relative rate."
      >
        <RasterLayer
          data={speed}
          frameKey={ASSET_FRAME_KEYS.windSpeed}
          colorScale={['#0b2545', '#1d4ed8', '#f97316']}
          min={0}
          max={30}
          opacity={0.7}
        />
        <WindParticleLayer {...args} data={field} />
      </DemoMap>
    );
  },
};

/**
 * A changing field, cross-faded on the GPU. Particles carry their trails
 * through the transition rather than restarting.
 */
export const AnimatedField: Story = {
  args: { particleCount: 2400, colors: SPEED_COLORS, maxSpeed: MAX_SPEED },
  render: (args) => {
    const { value: base } = useAsset(loadWindField);

    // The sample observations record a single analysis time, so successive
    // fields are derived by rotating and scaling the decoded components. Grid
    // dimensions are preserved, which is what permits the GPU cross-fade.
    const frames = useMemo(() => (base ? deriveWindFields(base, 8) : []), [base]);
    const [index, setIndex] = useState(0);

    useEffect(() => {
      if (frames.length === 0) return;
      const timer = setInterval(
        () => setIndex((current) => (current + 1) % frames.length),
        2200,
      );
      return () => clearInterval(timer);
    }, [frames.length]);

    return (
      <DemoMap
        {...WIND_VIEW}
        note="The field advances every 2.2 s with transitionMs={1200}. Blending applies because consecutive grids share dimensions."
      >
        <WindParticleLayer
          {...args}
          data={frames[index] ?? null}
          transitionMs={1200}
        />
        <GeoLegend
          title="Wind speed"
          colorScale={SPEED_COLORS}
          min={0}
          max={MAX_SPEED}
          unit="kt"
          placement="bottom-right"
          footer={
            frames.length > 0 ? `Field ${index + 1} of ${frames.length}` : undefined
          }
        />
      </DemoMap>
    );
  },
};

/**
 * Two particle layers sharing one deck.gl instance. Without the wrapper each
 * would provision its own overlay, animation loop and picking pass.
 */
export const SharedOverlay: Story = {
  args: {},
  render: () => {
    const { value: base } = useAsset(loadWindField);
    const layers = useMemo(() => (base ? deriveWindFields(base, 2) : []), [base]);
    return (
      <DemoMap
        {...WIND_VIEW}
        note="One MapboxOverlay, two ParticleLayers. Layer ids must be unique within the shared instance."
      >
        <DeckOverlay>
          <WindParticleLayer
            id="wind-low"
            data={layers[0] ?? null}
            particleCount={1200}
            color={[125, 211, 252, 220]}
            width={1}
            maxSpeed={MAX_SPEED}
          />
          <WindParticleLayer
            id="wind-high"
            data={layers[1] ?? null}
            particleCount={1200}
            color={[248, 113, 113, 220]}
            width={1.8}
            maxSpeed={MAX_SPEED}
          />
        </DeckOverlay>
      </DemoMap>
    );
  },
};

/** `data={null}` is a supported state, including during an asynchronous load. */
export const EmptyField: Story = {
  args: { data: null },
  render: (args) => (
    <DemoMap {...WIND_VIEW} size="short" note="The layer renders nothing and raises nothing.">
      <WindParticleLayer {...args} />
    </DemoMap>
  ),
};
