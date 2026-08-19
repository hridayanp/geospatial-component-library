import { useEffect, useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { WindParticleLayer } from '@hridayanp/wind-particle-layer';
import { DeckOverlay } from '@hridayanp/deck-overlay';
import { GeoLegend } from '@hridayanp/geo-legend';
import { VectorLayer } from '@hridayanp/vector-layer';
import { DemoMap } from './demo/DemoMap';
import { makeWindField, makeWindPoints } from './demo/data';

const field = makeWindField();
const stations = makeWindPoints();

const SPEED_COLORS = ['#bae6fd', '#7dd3fc', '#facc15', '#fb923c', '#ef4444'];

const meta = {
  title: 'Geospatial/Wind Particle Layer',
  component: WindParticleLayer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
GPU-accelerated flow particles, built on deck.gl and WeatherLayers GL.

**Installation**

\`\`\`bash
npm install @hridayanp/wind-particle-layer @hridayanp/map-container \\
  maplibre-gl weatherlayers-gl @deck.gl/core @deck.gl/mapbox @deck.gl/extensions @deck.gl/layers
\`\`\`

**Data formats**

\`data\` accepts three shapes:

- **\`{ kind: 'field', u, v, width, height, bounds }\`** — a velocity grid. The
  canonical form; no resampling needed.
- **\`{ kind: 'points', data, directionConvention }\`** — scattered observations
  carrying speed and direction. The layer rasterises them onto a grid inferred
  from their own spacing, filling gaps with a distance-weighted average so the
  result reads as a continuous flow rather than isolated arrows.
- **\`{ kind: 'image', url, bounds, imageUnscale }\`** — a UV-encoded PNG your
  pipeline already produced.

**How it works**

Velocities are packed into an RGBA texture (red = eastward, green = northward)
and uploaded once. From then on the GPU advects every particle and reconstructs
its speed as \`sqrt(u² + v²)\` to sample the colour ramp. The CPU does nothing
per frame — which is why 5,000 particles animate as cheaply as 500.

**Direction convention**

Meteorological data usually reports where wind comes *from*. That is the
default (\`'from'\`). Pass \`directionConvention: 'towards'\` for data that
reports the direction of travel, or particles will flow backwards.

**Transitions**

When the field changes, the old and new textures are blended on the GPU over
\`transitionMs\`. Particles keep their positions and trails through a timeline
step instead of restarting — which is what makes playback look continuous.

**Performance**

- \`particleCount\` is the dominant cost. 2,000–3,000 reads well at continental
  scale; past ~10,000 the field becomes visual noise before it becomes slow.
- \`maxAge\` multiplies trail geometry; long trails on many particles are the
  second cost.
- Generated textures are capped at 512px on their longest edge.

**Limitations**

- Requires WebGL2. There is no canvas fallback.
- Blending between fields only applies when consecutive grids have identical
  dimensions; otherwise the new field replaces the old outright.
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

/** A velocity grid: the canonical input. */
export const Basic: Story = {
  args: {
    data: field,
    particleCount: 2500,
    speedFactor: 6,
    maxAge: 45,
    width: 1.4,
    opacity: 0.9,
    maxSpeed: 40,
    colors: SPEED_COLORS,
  },
  render: (args) => (
    <DemoMap note="A synthetic vortex plus a background easterly. Every control is a live prop.">
      <WindParticleLayer {...args} />
      <GeoLegend
        title="Speed"
        colorScale={SPEED_COLORS}
        min={0}
        max={40}
        unit="kt"
        ticks={5}
        placement="bottom-right"
      />
    </DemoMap>
  ),
};

/** Scattered station observations, rasterised into a continuous field. */
export const FromScatteredPoints: Story = {
  args: {
    particleCount: 2200,
    speedFactor: 5,
    maxAge: 40,
    colors: SPEED_COLORS,
    maxSpeed: 40,
  },
  render: (args) => (
    <DemoMap note="90 point observations with `wind_speed_kt` and `wind_dir_deg`. The stations themselves are drawn as a vector layer for reference.">
      <WindParticleLayer
        {...args}
        data={{ kind: 'points', data: stations, directionConvention: 'from' }}
      />
      <VectorLayer
        data={stations}
        pointRadius={2.5}
        pointColor="#e2e8f0"
        pointStrokeWidth={0}
        opacity={0.5}
      />
    </DemoMap>
  ),
};

/** The same data read with each direction convention. */
export const DirectionConvention: Story = {
  args: { particleCount: 1500, colors: SPEED_COLORS },
  render: (args) => (
    <div>
      <p className="demo-note">
        Identical observations, opposite readings. If your particles flow the
        wrong way, this is the prop to check first.
      </p>
      <div className="demo-grid">
        {(['from', 'towards'] as const).map((convention) => (
          <DemoMap key={convention} size="short" note={`directionConvention: "${convention}"`}>
            <WindParticleLayer
              {...args}
              id={`wind-${convention}`}
              data={{ kind: 'points', data: stations, directionConvention: convention }}
            />
          </DemoMap>
        ))}
      </div>
    </div>
  ),
};

/** Particle density, from sparse to dense. */
export const ParticleDensity: Story = {
  args: { data: field, colors: SPEED_COLORS, maxSpeed: 40 },
  render: (args) => (
    <div>
      <p className="demo-note">
        Density is a readability choice more than a performance one: past a few
        thousand particles the field turns into a wash.
      </p>
      <div className="demo-grid">
        {[400, 2500, 7000].map((count) => (
          <DemoMap key={count} size="short" note={`${count} particles`}>
            <WindParticleLayer
              {...args}
              id={`wind-density-${count}`}
              particleCount={count}
            />
          </DemoMap>
        ))}
      </div>
    </div>
  ),
};

/** Trail length, set by `maxAge`. */
export const TrailLength: Story = {
  args: { data: field, colors: SPEED_COLORS, particleCount: 1800, maxSpeed: 40 },
  render: (args) => (
    <div className="demo-grid">
      {[10, 45, 100].map((maxAge) => (
        <DemoMap key={maxAge} size="short" note={`maxAge: ${maxAge}`}>
          <WindParticleLayer {...args} id={`wind-age-${maxAge}`} maxAge={maxAge} />
        </DemoMap>
      ))}
    </div>
  ),
};

/** A single flat colour instead of a speed ramp. */
export const SingleColor: Story = {
  args: {
    data: field,
    particleCount: 2000,
    color: [226, 232, 240, 255],
    opacity: 0.8,
  },
  render: (args) => (
    <DemoMap
      size="short"
      note="`color` overrides `colors`. Useful when speed is already encoded by a raster underneath and the particles only need to show direction."
    >
      <WindParticleLayer {...args} />
    </DemoMap>
  ),
};

/** A changing field, cross-faded on the GPU. */
export const AnimatedField: Story = {
  args: { particleCount: 2400, colors: SPEED_COLORS, maxSpeed: 40 },
  render: (args) => {
    const frames = useMemo(
      () =>
        Array.from({ length: 8 }, (_, index) =>
          makeWindField({ phase: index / 8 }),
        ),
      [],
    );
    const [index, setIndex] = useState(0);

    useEffect(() => {
      const timer = setInterval(
        () => setIndex((current) => (current + 1) % frames.length),
        2200,
      );
      return () => clearInterval(timer);
    }, [frames.length]);

    return (
      <DemoMap note="The field advances every 2.2s. Watch the particles carry their trails across the change rather than restarting.">
        <WindParticleLayer {...args} data={frames[index]} transitionMs={1200} />
        <GeoLegend
          title="Speed"
          colorScale={SPEED_COLORS}
          min={0}
          max={40}
          unit="kt"
          placement="bottom-right"
          footer={`Field ${index + 1} of ${frames.length}`}
        />
      </DemoMap>
    );
  },
};

/** Two particle layers sharing one deck.gl overlay. */
export const SharedOverlay: Story = {
  args: {},
  render: () => (
    <DemoMap note="Wrapping deck-based layers in a `<DeckOverlay>` gives them one deck.gl instance, one animation loop and one picking pass between them.">
      <DeckOverlay>
        <WindParticleLayer
          id="wind-low"
          data={makeWindField({ maxSpeed: 20 })}
          particleCount={1200}
          color={[125, 211, 252, 220]}
          width={1}
        />
        <WindParticleLayer
          id="wind-high"
          data={makeWindField({ maxSpeed: 45, phase: 0.4 })}
          particleCount={1200}
          color={[248, 113, 113, 220]}
          width={1.8}
        />
      </DeckOverlay>
    </DemoMap>
  ),
};

/** No data: nothing renders, nothing throws. */
export const EmptyField: Story = {
  args: { data: null },
  render: (args) => (
    <DemoMap size="short" note="`data={null}` is a supported state.">
      <WindParticleLayer {...args} />
    </DemoMap>
  ),
};
