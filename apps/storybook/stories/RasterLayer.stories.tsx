import { useEffect, useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { RasterLayer, preloadRasterFrame } from '@hridayanp/raster-layer';
import { GeoLegend } from '@hridayanp/geo-legend';
import { TimelineControl } from '@hridayanp/timeline-control';
import { DemoMap } from './demo/DemoMap';
import {
  DEMO_BOUNDS,
  PALETTES,
  makeRaster,
  makeRasterSequence,
} from './demo/data';

const raster = makeRaster();
const gappyRaster = makeRaster({ noDataFraction: 0.35, seed: 19 });
const coarseRaster = makeRaster({ width: 24, height: 20, blobs: 3, seed: 31 });

const meta = {
  title: 'Geospatial/Raster Layer',
  component: RasterLayer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
One generic raster layer, driven entirely by props.

**Installation**

\`\`\`bash
npm install @hridayanp/raster-layer @hridayanp/map-container maplibre-gl react
\`\`\`

**Data formats**

\`data\` accepts three shapes:

- a **\`RasterData\`** — \`{ data, width, height, bounds, noData? }\`, where
  \`data\` is any typed array of band values, row-major, northern row first;
- **\`{ kind: 'geotiff', source }\`** — a URL or \`ArrayBuffer\` to decode in the
  browser. Reads the smallest overview by default, which is what makes
  scrubbing a Cloud-Optimised GeoTIFF series fast;
- **\`{ kind: 'image', url, bounds }\`** — an image you already coloured
  elsewhere.

**Why this replaces a family of components**

Per-variable raster layers differ only in their data and their colour ramp.
Both are props here, so there is nothing left to specialise — one component
covers temperature, rainfall, probability, pressure and everything else.

**Performance**

- Frames are decoded once and cached by \`frameKey\`; scrubbing back over a
  visited frame is a texture swap.
- \`preloadRasterFrame()\` warms that cache for the next frame while the current
  one is on screen.
- \`smoothFactor\` costs CPU quadratically — 6 is a good default, and the output
  is capped at 1024px on its longest edge regardless.
- Updates are double-buffered, so stepping through frames never flashes.

**Limitations**

- Colourisation runs on the main thread. For very large grids, colourise in a
  worker with \`@hridayanp/raster-utils\` and pass \`{ kind: 'image' }\`.
- One band at a time. Multi-band composites need their own layer each, or a
  pre-composed image.
        `,
      },
    },
  },
  argTypes: {
    opacity: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    smoothFactor: { control: { type: 'range', min: 1, max: 12, step: 1 } },
    smoothEdges: { control: 'boolean' },
    visible: { control: 'boolean' },
    resampling: { control: 'inline-radio', options: ['linear', 'nearest'] },
    min: { control: 'number' },
    max: { control: 'number' },
    colorScale: { control: 'object' },
    data: { control: false },
  },
} satisfies Meta<typeof RasterLayer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A raster grid plus a colour ramp. Nothing else is required. */
export const Basic: Story = {
  args: {
    data: raster,
    colorScale: [...PALETTES.heat],
    opacity: 0.85,
    smoothFactor: 6,
  },
  render: (args) => (
    <DemoMap note="Every control in the Controls panel is a live prop.">
      <RasterLayer {...args} />
    </DemoMap>
  ),
};

/** The same field under four ramps — the ramp is data, not code. */
export const ColorScales: Story = {
  args: { data: raster },
  render: () => (
    <div>
      <p className="demo-note">
        Identical data, four ramps. A ramp is an array of colours, or explicit
        <code className="demo-code">[value, colour]</code> stops when the
        breakpoints carry meaning.
      </p>
      <div className="demo-grid">
        {(['heat', 'viridis', 'magma', 'ocean'] as const).map((name) => (
          <DemoMap key={name} size="short">
            <RasterLayer
              id={`raster-${name}`}
              data={raster}
              colorScale={[...PALETTES[name]]}
              opacity={0.9}
            />
            <GeoLegend
              title={name}
              colorScale={[...PALETTES[name]]}
              min={0}
              max={100}
              placement="bottom-left"
            />
          </DemoMap>
        ))}
      </div>
    </div>
  ),
};

/**
 * Without an explicit `min`/`max` each frame self-scales to its own range —
 * fine for a single view, misleading across an animation.
 */
export const ValueRange: Story = {
  args: { data: raster, colorScale: [...PALETTES.viridis] },
  render: (args) => {
    const [fixed, setFixed] = useState(true);
    return (
      <div>
        <p className="demo-note">
          Fixing the range keeps colours comparable between frames. Leaving it
          open makes each frame use the whole ramp, which exaggerates quiet
          frames.
        </p>
        <label className="gcl-row" style={{ marginBottom: 10, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={fixed}
            onChange={(event) => setFixed(event.target.checked)}
          />
          Fixed range 0–100
        </label>
        <DemoMap size="short">
          <RasterLayer
            {...args}
            {...(fixed ? { min: 0, max: 100 } : {})}
            opacity={0.9}
          />
          <GeoLegend
            title="Value"
            colorScale={[...PALETTES.viridis]}
            min={0}
            max={100}
            ticks={5}
            placement="bottom-right"
          />
        </DemoMap>
      </div>
    );
  },
};

/** NoData cells render transparent, and their edges feather rather than box. */
export const NoDataAndEdges: Story = {
  args: { data: gappyRaster, colorScale: [...PALETTES.ocean] },
  render: (args) => {
    const [smoothEdges, setSmoothEdges] = useState(true);
    return (
      <div>
        <p className="demo-note">
          The gaps are genuine NoData (<code className="demo-code">-9999</code>).
          With <code className="demo-code">smoothEdges</code> the coverage
          boundary dissolves; without it, the ragged cell edges are visible.
        </p>
        <label className="gcl-row" style={{ marginBottom: 10, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={smoothEdges}
            onChange={(event) => setSmoothEdges(event.target.checked)}
          />
          smoothEdges
        </label>
        <DemoMap size="short">
          <RasterLayer {...args} smoothEdges={smoothEdges} opacity={0.9} />
        </DemoMap>
      </div>
    );
  },
};

/**
 * `smoothFactor` interpolates the *raw values* before colouring, which is why
 * the result is a continuous field rather than a blurred mosaic.
 */
export const Smoothing: Story = {
  args: { data: coarseRaster, colorScale: [...PALETTES.heat] },
  render: (args) => (
    <div>
      <p className="demo-note">
        A deliberately coarse 24×20 grid. On the left, one output pixel per
        source cell. On the right, eight — interpolated numerically, then
        coloured.
      </p>
      <div className="demo-grid">
        {[1, 8].map((factor) => (
          <DemoMap key={factor} size="short">
            <RasterLayer
              {...args}
              id={`smooth-${factor}`}
              smoothFactor={factor}
              opacity={0.95}
            />
          </DemoMap>
        ))}
      </div>
    </div>
  ),
};

/** `nearest` resampling preserves hard cell boundaries for classed data. */
export const Resampling: Story = {
  args: { data: coarseRaster, colorScale: [...PALETTES.diverging] },
  render: (args) => (
    <div className="demo-grid">
      {(['linear', 'nearest'] as const).map((mode) => (
        <DemoMap
          key={mode}
          size="short"
          note={`resampling: "${mode}"`}
        >
          <RasterLayer
            {...args}
            id={`resample-${mode}`}
            resampling={mode}
            smoothFactor={1}
          />
        </DemoMap>
      ))}
    </div>
  ),
};

/** An empty raster renders nothing and throws nothing. */
export const NoData: Story = {
  args: { data: null, colorScale: [...PALETTES.heat] },
  render: (args) => (
    <DemoMap
      size="short"
      note="`data={null}` is a supported state, not an error — a layer with nothing to show should simply show nothing."
    >
      <RasterLayer {...args} />
    </DemoMap>
  ),
};

/**
 * Animated playback: frames are cached by key and the next one is preloaded,
 * so stepping is instant after the first pass.
 */
export const AnimatedSequence: Story = {
  args: { colorScale: [...PALETTES.heat] },
  render: (args) => {
    const frames = useMemo(() => makeRasterSequence(12), []);
    const [index, setIndex] = useState(0);
    const active = frames[index];

    // The host owns retrieval, so the host owns prefetching. Warming the next
    // frame while this one is on screen turns the next step into a swap.
    useEffect(() => {
      const next = frames[(index + 1) % frames.length];
      if (!next) return;
      void preloadRasterFrame(next.raster, {
        colorScale: args.colorScale,
        min: 0,
        max: 100,
        frameKey: next.id,
      });
    }, [index, frames, args.colorScale]);

    return (
      <DemoMap note="Press play. Frame changes are double-buffered, so there is no flash between them.">
        {active && (
          <RasterLayer
            {...args}
            data={active.raster}
            frameKey={active.id}
            min={0}
            max={100}
            opacity={0.9}
          />
        )}
        <GeoLegend
          title="Intensity"
          colorScale={[...PALETTES.heat]}
          min={0}
          max={100}
          unit="index"
          ticks={5}
          placement="bottom-right"
          footer={active?.timestamp.slice(0, 16).replace('T', ' ') + ' UTC'}
        />
        <TimelineControl
          frames={frames}
          index={index}
          onIndexChange={setIndex}
          frameDurationMs={550}
          placement="bottom-center"
          showSpeed={false}
        />
      </DemoMap>
    );
  },
};

/** Two independent rasters, composed and blended. */
export const MultipleRasters: Story = {
  args: {},
  render: () => (
    <DemoMap note="Layers are independent: different data, different ramps, different opacities, one map.">
      <RasterLayer
        id="base"
        data={makeRaster({ seed: 3, blobs: 3 })}
        colorScale={[...PALETTES.ocean]}
        min={0}
        max={100}
        opacity={0.75}
      />
      <RasterLayer
        id="overlay"
        data={makeRaster({ seed: 77, blobs: 2 })}
        colorScale={['#00000000', '#f9731688', '#dc2626']}
        min={0}
        max={100}
        opacity={0.6}
      />
      <GeoLegend
        title="Base"
        colorScale={[...PALETTES.ocean]}
        min={0}
        max={100}
        placement="bottom-right"
      />
    </DemoMap>
  ),
};

/** A GeoTIFF or COG, decoded in the browser. */
export const GeoTIFFSource: Story = {
  args: { colorScale: [...PALETTES.viridis] },
  render: (args) => (
    <div>
      <p className="demo-note">
        Pass a URL your application has already authorised, or an{' '}
        <code className="demo-code">ArrayBuffer</code> you fetched yourself. The
        library decodes; it never decides how you authenticate.
      </p>
      <pre className="demo-surface demo-readout">{`<RasterLayer
  data={{ kind: 'geotiff', source: signedUrl, resolution: 'overview' }}
  colorScale={palette}
  min={0}
  max={100}
/>`}</pre>
      <DemoMap
        size="short"
        note="Shown here with an equivalent in-memory grid, since the docs site has no server."
      >
        <RasterLayer
          {...args}
          data={makeRaster({ seed: 91 })}
          min={0}
          max={100}
          opacity={0.9}
        />
      </DemoMap>
      <p className="demo-note" style={{ marginTop: 8 }}>
        Domain: {DEMO_BOUNDS.join(', ')}
      </p>
    </div>
  ),
};
