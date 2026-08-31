import { useEffect, useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { RasterLayer, preloadRasterFrame } from '@hridayanp/raster-layer';
import { GeoLegend } from '@hridayanp/geo-legend';
import { TimelineControl } from '@hridayanp/timeline-control';
import { DemoMap } from './demo/DemoMap';
import { PALETTES } from './demo/data';
import {
  ASSET_FRAME_KEYS,
  CONVECTIVE_VIEW,
  WIND_VIEW,
  loadConvectiveRaster,
  loadWindSpeedRaster,
} from './demo/assets';
import { useAsset } from './demo/useAsset';
import { deriveRasterSequence } from './demo/derive';

const meta = {
  title: 'Geospatial/Raster Layer',
  component: RasterLayer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Renders a single georeferenced raster band on a MapLibre map, applying a
configurable colour ramp and producing flicker-free transitions between frames
of a temporal sequence.

**Installation**

\`\`\`bash
npm install @hridayanp/raster-layer @hridayanp/map-container maplibre-gl react
\`\`\`

### Responsibilities

The component owns colourisation, the MapLibre source and layer lifecycle,
frame caching, and — for \`kind: 'geotiff'\` input — decoding. Retrieval,
authorisation, prefetch scheduling and reprojection to EPSG:4326 remain with the
consuming application.

### Data model

\`data\` accepts three input forms, discriminated structurally:

- **\`RasterData\`** — \`{ data, width, height, bounds, noData?, unit? }\`, where
  \`data\` is any typed array of band values, **row-major with the northern row
  first**, and \`bounds\` is \`[west, south, east, north]\` describing the image
  **edges** rather than the centres of the outer cells.
- **\`{ kind: 'geotiff', source, band?, resolution?, noData? }\`** — a URL or
  \`ArrayBuffer\` decoded in the browser. \`resolution\` defaults to
  \`'overview'\`, which reads the smallest overview level a Cloud-Optimised
  GeoTIFF carries and is the reason scrubbing a COG series is inexpensive.
- **\`{ kind: 'image', url, bounds }\`** — a pre-rendered image, placed as
  supplied. The colour ramp does not apply.

### Rendering model

The layer registers a MapLibre \`image\` source and a \`raster\` style layer.
Band values are colourised on the CPU into an RGBA image before upload; the GPU
then samples that texture during rendering. Interpolation runs on the **raw
values** before the ramp is applied, so the result is a continuous field rather
than a blurred mosaic of per-cell colours.

Two image sources are kept permanently registered and the layer inverts which
one is opaque, waiting two animation frames so React can commit the source and
MapLibre can complete the texture upload. Combined with
\`'raster-fade-duration': 0\` this produces a hard cut between frames rather than
a cross-fade or a remount.

### Data used in these stories

\`assets/raster.tif\` — a 58 × 55 single-band float32 grid at 0.1° resolution in
EPSG:4326, holding convective probability as a percentage. It is fetched and
decoded through \`decodeGeoTIFF\` when the story mounts.

\`assets/wind_particle_raster.tif\` — a 120 × 128 wind-speed grid at 0.25°, used
where a band with genuine NoData coverage is required.

### Performance

- Frames are cached by \`frameKey\` in a bounded LRU; scrubbing back over a
  visited frame is a texture swap rather than a decode.
- \`preloadRasterFrame()\` warms that cache for the next frame while the current
  one is displayed.
- \`smoothFactor\` costs CPU quadratically. Output is capped at 1024 px on the
  longest edge regardless, so a large grid at a high factor cannot produce an
  unbounded canvas.
- Colourisation executes on the main thread. For large grids, colourise in a
  worker with \`@hridayanp/raster-utils\` and supply \`{ kind: 'image' }\`.

### Geospatial considerations

\`bounds\` is interpreted as EPSG:4326 and placed on the map's projection; no
reprojection is performed. One band is rendered at a time — multi-band
composites require one layer per band, or a pre-composed image.
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

/**
 * A decoded band and a colour ramp. Every control in the Controls panel maps
 * directly to a prop on the live layer.
 */
export const Basic: Story = {
  args: {
    colorScale: [...PALETTES.heat],
    opacity: 0.85,
    smoothFactor: 6,
    min: 0,
    max: 50,
  },
  render: (args) => {
    const { value: raster } = useAsset(loadConvectiveRaster);
    return (
      <DemoMap
        {...CONVECTIVE_VIEW}
        note="Convective probability from assets/raster.tif — a 58 × 55 float32 band at 0.1°, decoded in the browser."
      >
        <RasterLayer
          {...args}
          data={raster}
          frameKey={ASSET_FRAME_KEYS.convective}
        />
        <GeoLegend
          title="Convective probability"
          colorScale={[...PALETTES.heat]}
          min={0}
          max={50}
          unit="%"
          ticks={5}
          placement="bottom-right"
        />
      </DemoMap>
    );
  },
};

/**
 * The ramp is configuration, not code. One band, four ramps, one component —
 * which is why per-variable raster components collapse into this one.
 */
export const ColorScales: Story = {
  args: {},
  render: () => {
    const { value: raster } = useAsset(loadConvectiveRaster);
    return (
      <div>
        <p className="demo-note">
          A ramp is an array of colours distributed evenly across the domain, or
          explicit <code className="demo-code">[value, colour]</code> stops when
          the breakpoints carry meaning. The domain is fixed at 0–50% in all
          four so the comparison is between ramps rather than between scalings.
        </p>
        <div className="demo-grid">
          {(['heat', 'viridis', 'magma', 'ocean'] as const).map((name) => (
            <DemoMap key={name} {...CONVECTIVE_VIEW} size="short">
              <RasterLayer
                id={`raster-${name}`}
                data={raster}
                frameKey={ASSET_FRAME_KEYS.convective}
                colorScale={[...PALETTES[name]]}
                min={0}
                max={50}
                opacity={0.9}
              />
              <GeoLegend
                title={name}
                colorScale={[...PALETTES[name]]}
                min={0}
                max={50}
                unit="%"
                placement="bottom-left"
              />
            </DemoMap>
          ))}
        </div>
      </div>
    );
  },
};

/**
 * `min` and `max` fix the value domain the ramp is stretched across. Omitting
 * them normalises each frame against its own range.
 */
export const ValueRange: Story = {
  args: { colorScale: [...PALETTES.viridis] },
  render: (args) => {
    const { value: raster } = useAsset(loadConvectiveRaster);
    const [fixed, setFixed] = useState(true);
    return (
      <div>
        <p className="demo-note">
          A fixed domain keeps colour comparable between frames. Leaving it open
          makes every frame consume the whole ramp, which exaggerates
          low-magnitude frames and invalidates visual comparison across a
          sequence.
        </p>
        <label className="gcl-row" style={{ marginBottom: 10, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={fixed}
            onChange={(event) => setFixed(event.target.checked)}
          />
          Fixed domain 0–50%
        </label>
        <DemoMap {...CONVECTIVE_VIEW} size="short">
          <RasterLayer
            {...args}
            data={raster}
            frameKey={ASSET_FRAME_KEYS.convective}
            {...(fixed ? { min: 0, max: 50 } : {})}
            opacity={0.9}
          />
          <GeoLegend
            title="Convective probability"
            colorScale={[...PALETTES.viridis]}
            min={0}
            max={50}
            unit="%"
            ticks={5}
            placement="bottom-right"
          />
        </DemoMap>
      </div>
    );
  },
};

/**
 * Cells matching the band's NoData sentinel render fully transparent.
 * `smoothEdges` feathers the coverage boundary so the valid-data region
 * dissolves rather than terminating on a cell edge.
 */
export const NoDataAndEdges: Story = {
  args: { colorScale: [...PALETTES.ocean] },
  render: (args) => {
    const { value: raster } = useAsset(loadWindSpeedRaster);
    const [smoothEdges, setSmoothEdges] = useState(true);
    return (
      <div>
        <p className="demo-note">
          <code className="demo-code">assets/wind_particle_raster.tif</code>{' '}
          declares <code className="demo-code">-9999</code> in its{' '}
          <code className="demo-code">GDAL_NODATA</code> tag and carries 253
          absent cells out of 15,360. With{' '}
          <code className="demo-code">smoothEdges</code> the coverage boundary
          dissolves; without it the ragged cell edges read as a rendering
          artefact rather than as a data boundary.
        </p>
        <label className="gcl-row" style={{ marginBottom: 10, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={smoothEdges}
            onChange={(event) => setSmoothEdges(event.target.checked)}
          />
          smoothEdges
        </label>
        <DemoMap {...WIND_VIEW} size="short">
          <RasterLayer
            {...args}
            data={raster}
            frameKey={ASSET_FRAME_KEYS.windSpeed}
            min={0}
            max={30}
            smoothEdges={smoothEdges}
            opacity={0.9}
          />
        </DemoMap>
      </div>
    );
  },
};

/**
 * `smoothFactor` synthesises output pixels per source cell by interpolating the
 * **raw band values** before the ramp is applied.
 */
export const Smoothing: Story = {
  args: { colorScale: [...PALETTES.heat] },
  render: (args) => {
    const { value: raster } = useAsset(loadConvectiveRaster);
    return (
      <div>
        <p className="demo-note">
          The same 58 × 55 band at 0.1°. On the left, one output pixel per source
          cell. On the right, eight — interpolated numerically, then coloured.
          Colourising first and blurring afterwards would produce a soft mosaic
          instead of a gradient, because colour would already have been assigned
          per cell.
        </p>
        <div className="demo-grid">
          {[1, 8].map((factor) => (
            <DemoMap key={factor} {...CONVECTIVE_VIEW} size="short">
              <RasterLayer
                {...args}
                id={`smooth-${factor}`}
                data={raster}
                frameKey={ASSET_FRAME_KEYS.convective}
                min={0}
                max={50}
                smoothFactor={factor}
                opacity={0.95}
              />
            </DemoMap>
          ))}
        </div>
      </div>
    );
  },
};

/**
 * `resampling` selects the GPU sampling mode applied when the uploaded texture
 * is scaled. `'nearest'` preserves hard cell boundaries, which is correct for
 * classified rasters where an interpolated class code is meaningless.
 */
export const Resampling: Story = {
  args: { colorScale: [...PALETTES.diverging] },
  render: (args) => {
    const { value: raster } = useAsset(loadConvectiveRaster);
    return (
      <div className="demo-grid">
        {(['linear', 'nearest'] as const).map((mode) => (
          <DemoMap
            key={mode}
            {...CONVECTIVE_VIEW}
            size="short"
            note={`resampling: "${mode}"`}
          >
            <RasterLayer
              {...args}
              id={`resample-${mode}`}
              data={raster}
              frameKey={ASSET_FRAME_KEYS.convective}
              min={0}
              max={50}
              resampling={mode}
              smoothFactor={1}
            />
          </DemoMap>
        ))}
      </div>
    );
  },
};

/**
 * `data={null}` is a supported state. The layer detaches its source and renders
 * nothing, without unmounting or discarding cached frames.
 */
export const NoData: Story = {
  args: { data: null, colorScale: [...PALETTES.heat] },
  render: (args) => (
    <DemoMap
      {...CONVECTIVE_VIEW}
      size="short"
      note="The pending state of an asynchronous load is the same state as no data: the layer renders nothing and raises nothing."
    >
      <RasterLayer {...args} />
    </DemoMap>
  ),
};

/**
 * Temporal playback. Frames are cached by `frameKey` and the next is preloaded,
 * so every step after the first pass is a texture swap.
 */
export const AnimatedSequence: Story = {
  args: { colorScale: [...PALETTES.heat] },
  render: (args) => {
    const { value: base } = useAsset(loadConvectiveRaster);

    // The sample assets record a single analysis time, so a sequence is derived
    // from the decoded band by advecting a weighting field across it. The
    // rendering path is identical to a real forecast series: N distinct
    // RasterData objects, each with a stable frameKey.
    const frames = useMemo(
      () => (base ? deriveRasterSequence(base, 12) : []),
      [base],
    );
    const [index, setIndex] = useState(0);
    const active = frames[index];

    useEffect(() => {
      const next = frames[(index + 1) % frames.length];
      if (!next) return;
      void preloadRasterFrame(next.meta.raster, {
        colorScale: args.colorScale,
        min: 0,
        max: 50,
        frameKey: next.id,
      });
    }, [index, frames, args.colorScale]);

    return (
      <DemoMap
        {...CONVECTIVE_VIEW}
        note="Frame changes are double-buffered: the new band is written to the inactive image source and the two are swapped after the texture upload completes."
      >
        {active && (
          <RasterLayer
            {...args}
            data={active.meta.raster}
            frameKey={active.id}
            min={0}
            max={50}
            opacity={0.9}
          />
        )}
        <GeoLegend
          title="Convective probability"
          colorScale={[...PALETTES.heat]}
          min={0}
          max={50}
          unit="%"
          ticks={5}
          placement="bottom-right"
          footer={active?.label}
        />
        <TimelineControl
          frames={frames}
          index={index}
          onIndexChange={setIndex}
          frameDurationMs={550}
          placement="bottom-center"
        />
      </DemoMap>
    );
  },
};

/**
 * Independent layers compose on one map: distinct bands, ramps, domains and
 * opacities, ordered by mount order.
 */
export const MultipleRasters: Story = {
  args: {},
  render: () => {
    const { value: convective } = useAsset(loadConvectiveRaster);
    const { value: wind } = useAsset(loadWindSpeedRaster);
    return (
      <DemoMap
        {...WIND_VIEW}
        note="Wind speed across the full 0.25° domain, with convective probability composited above it over its smaller extent."
      >
        <RasterLayer
          id="wind-speed"
          data={wind}
          frameKey={ASSET_FRAME_KEYS.windSpeed}
          colorScale={[...PALETTES.ocean]}
          min={0}
          max={30}
          opacity={0.7}
        />
        <RasterLayer
          id="convective"
          data={convective}
          frameKey={ASSET_FRAME_KEYS.convective}
          colorScale={['#00000000', '#f9731688', '#dc2626']}
          min={0}
          max={50}
          opacity={0.75}
        />
        <GeoLegend
          title="Wind speed"
          colorScale={[...PALETTES.ocean]}
          min={0}
          max={30}
          unit="kt"
          placement="bottom-right"
        />
      </DemoMap>
    );
  },
};

/**
 * `kind: 'geotiff'` decodes a GeoTIFF or Cloud-Optimised GeoTIFF in the
 * browser. Both stories on this page use it; this one passes the descriptor
 * directly rather than pre-decoding.
 */
export const GeoTIFFSource: Story = {
  args: { colorScale: [...PALETTES.viridis] },
  render: (args) => (
    <div>
      <p className="demo-note">
        The component performs the decode. The application determines how the
        resource was authorised — a signed URL, a proxied path, or an{' '}
        <code className="demo-code">ArrayBuffer</code> it fetched itself.
        Credential lifecycle, refresh and retry policy remain outside the layer.
      </p>
      <pre className="demo-surface demo-readout">{`<RasterLayer
  data={{ kind: 'geotiff', source: '/assets/raster.tif', resolution: 'overview' }}
  frameKey="asset:raster.tif"
  colorScale={palette}
  min={0}
  max={50}
/>`}</pre>
      <DemoMap {...CONVECTIVE_VIEW} size="short">
        <RasterLayer
          {...args}
          data={{
            kind: 'geotiff',
            source: new URL('assets/raster.tif', document.baseURI).toString(),
            resolution: 'overview',
          }}
          frameKey="geotiff-story:raster.tif"
          min={0}
          max={50}
          opacity={0.9}
        />
      </DemoMap>
      <p className="demo-note" style={{ marginTop: 8 }}>
        <code className="demo-code">resolution: &apos;overview&apos;</code> reads
        the smallest overview level present. This file carries a single image, so
        it decodes in full; on a pyramided COG the same setting transfers only
        the overview&apos;s byte ranges.
      </p>
    </div>
  ),
};
