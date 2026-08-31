import { useEffect, useMemo, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  buildColorLut,
  colorScaleToCss,
  computeRasterStats,
  drawColorizedRaster,
  rasterToImageData,
  sampleColorScale,
  sampleRaster,
  type RasterData,
} from '@hridayanp/raster-utils';
import { DemoSurface } from './demo/DemoMap';
import { PALETTES } from './demo/data';
import { loadConvectiveRaster, loadWindSpeedRaster } from './demo/assets';
import { useAsset } from './demo/useAsset';

/**
 * A placeholder band, rendered while the sample datasets resolve. Every helper
 * in this package is synchronous and requires a `RasterData`, so the stories
 * need a value of that shape rather than a nullable one.
 */
const PENDING: RasterData = {
  data: new Float32Array(1),
  width: 1,
  height: 1,
  bounds: [0, 0, 1, 1],
  noData: Number.NaN,
};

const meta = {
  title: 'Utilities/Raster Utilities',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
The computational layer beneath raster rendering: band statistics, colour-ramp
resolution, colourisation, value sampling and GeoTIFF decoding. No React and no
map dependency.

**Installation**

\`\`\`bash
npm install @hridayanp/raster-utils
npm install geotiff   # optional peer — required only for decodeGeoTIFF
\`\`\`

### Integration boundaries

Every export is a pure function over typed arrays, so the package executes in a
web worker, is testable without a browser, and is reusable by a renderer
unrelated to this library. Keeping it outside the React packages makes moving
colourisation off the main thread a small, local change rather than a rewrite.

### Data model

\`\`\`ts
interface RasterData {
  data: RasterArray;   // row-major, northern row first
  width: number;
  height: number;
  bounds: Bounds;      // [west, south, east, north], image EDGES
  noData?: number | null;
  unit?: string;
}
\`\`\`

Two conventions govern every function: values are row-major with the northern
row first, matching image space and GeoTIFF row ordering; and \`bounds\`
describes the image edges rather than the centres of the outer cells. Cells
matching \`noData\`, and any \`NaN\`, are excluded from statistics and rendered
transparent.

### Colourisation

Model grids are coarse relative to display resolution. Rendering one output
pixel per source cell and blurring the result still reads as a soft mosaic,
because colour was assigned before the blur was applied.

\`rasterToImageData\` therefore bilinearly interpolates the **raw band values**
between neighbouring cells first, and maps only the interpolated value through
the ramp — via a precomputed 256-entry lookup table, since evaluating a colour
library once per pixel is the largest single cost in the render path. 256 steps
sit below the perceptual discrimination threshold for a continuous ramp.

Alpha receives the same treatment: \`alphaFade\` applies a \`smoothstep\` ramp
across a normalised band rather than a hard cutoff, and \`smoothEdges\` feathers
the coverage boundary so the valid-data region dissolves instead of displaying
its own rectangular extent. The feather can only reduce alpha, so it cannot make
transparent NoData regions partially opaque.

### GeoTIFF and Cloud-Optimised GeoTIFF

\`decodeGeoTIFF(source, options)\` accepts a URL or an \`ArrayBuffer\`. With a
URL, \`geotiff\` issues HTTP range requests, so a Cloud-Optimised GeoTIFF
transfers only the bytes constituting the requested overview level. Defaulting
to \`resolution: 'overview'\` is the largest single lever when scrubbing a
temporal sequence.

Extents are derived from the file's \`ModelTiepoint\` and \`ModelPixelScale\`
tags. **No reprojection is performed** — a file in a projected CRS yields an
extent in that CRS's units, which will not register against a WGS84 map. The
component performs the decode; the application determines how the resource was
authorised.
        `,
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function RasterCanvas({
  data,
  smoothFactor,
  smoothEdges,
  colorScale,
  alphaFade,
  width = 320,
}: {
  data: RasterData;
  smoothFactor: number;
  smoothEdges: boolean;
  colorScale: string[];
  alphaFade: [number, number] | null;
  width?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const colorized = rasterToImageData(data, {
      colorScale,
      smoothFactor,
      smoothEdges,
      alphaFade,
      maxDimension: 512,
    });
    drawColorizedRaster(colorized, canvas);
  }, [data, smoothFactor, smoothEdges, colorScale, alphaFade]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width,
        maxWidth: '100%',
        imageRendering: smoothFactor === 1 ? 'pixelated' : 'auto',
        borderRadius: 6,
        border: '1px solid var(--gcl-border)',
        background:
          'repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%) 50% / 16px 16px',
      }}
    />
  );
}

/** Colourisation, with every option in `ColorizeOptions` exposed. */
export const ColorizePlayground: Story = {
  render: () => {
    const { value: convective } = useAsset(loadConvectiveRaster);
    const { value: wind } = useAsset(loadWindSpeedRaster);
    const raster = convective ?? PENDING;
    const gappy = wind ?? PENDING;
    const [smoothFactor, setSmoothFactor] = useState(6);
    const [smoothEdges, setSmoothEdges] = useState(false);
    const [palette, setPalette] = useState<keyof typeof PALETTES>('heat');
    const [fade, setFade] = useState(true);

    return (
      <DemoSurface note="rasterToImageData writing RGBA pixels onto a canvas, with no map and no layer component involved. The chequerboard shows through where alpha resolves to zero.">
        <div className="gcl-row" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
          <label style={{ fontSize: 12 }}>
            smoothFactor {smoothFactor}
            <input
              type="range"
              min={1}
              max={10}
              value={smoothFactor}
              onChange={(event) => setSmoothFactor(Number(event.target.value))}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            <input
              type="checkbox"
              checked={smoothEdges}
              onChange={(event) => setSmoothEdges(event.target.checked)}
            />
            smoothEdges
          </label>
          <label style={{ fontSize: 12 }}>
            <input
              type="checkbox"
              checked={fade}
              onChange={(event) => setFade(event.target.checked)}
            />
            alphaFade
          </label>
          <label style={{ fontSize: 12 }}>
            palette{' '}
            <select
              value={palette}
              onChange={(event) =>
                setPalette(event.target.value as keyof typeof PALETTES)
              }
            >
              {Object.keys(PALETTES).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="demo-grid">
          <div>
            <p className="demo-note">Complete coverage</p>
            <RasterCanvas
              data={raster}
              smoothFactor={smoothFactor}
              smoothEdges={smoothEdges}
              colorScale={[...PALETTES[palette]]}
              alphaFade={fade ? [0.03, 0.09] : null}
            />
          </div>
          <div>
            <p className="demo-note">
              wind_particle_raster.tif — 253 NoData cells of 15,360
            </p>
            <RasterCanvas
              data={gappy}
              smoothFactor={smoothFactor}
              smoothEdges={smoothEdges}
              colorScale={[...PALETTES[palette]]}
              alphaFade={fade ? [0.03, 0.09] : null}
            />
          </div>
        </div>
      </DemoSurface>
    );
  },
};

/** Band statistics over the valid cells. */
export const Statistics: Story = {
  render: () => {
    const { value: convective } = useAsset(loadConvectiveRaster);
    const { value: wind } = useAsset(loadWindSpeedRaster);
    const raster = convective ?? PENDING;
    const gappy = wind ?? PENDING;
    const full = computeRasterStats(raster.data, raster.noData);
    const holed = computeRasterStats(gappy.data, gappy.noData);
    return (
      <DemoSurface note="NoData cells and NaN are excluded from every statistic. A fully empty band resolves to a 0–1 domain rather than [Infinity, -Infinity], so downstream normalisation stays finite instead of producing NaN pixels.">
        <div className="demo-readout">
          {`raster.tif                min ${full.min.toFixed(2)}  max ${full.max.toFixed(2)}  mean ${full.mean?.toFixed(2)}  valid ${full.validCount}/${full.totalCount}
wind_particle_raster.tif  min ${holed.min.toFixed(2)}  max ${holed.max.toFixed(2)}  mean ${holed.mean?.toFixed(2)}  valid ${holed.validCount}/${holed.totalCount}`}
        </div>
      </DemoSurface>
    );
  },
};

/** Ramp resolution: CSS gradients, byte lookup tables and even sampling. */
export const ColorScales: Story = {
  render: () => {
    const swatches = useMemo(() => sampleColorScale([...PALETTES.heat], 9), []);
    const lut = useMemo(() => buildColorLut([...PALETTES.heat], 8), []);
    return (
      <DemoSurface note="One ColorScaleInput resolves to a CSS gradient for a legend, a 256-entry byte lookup table for per-pixel colourisation, and evenly spaced swatches for classified symbology.">
        <div className="gcl-stack">
          {(Object.keys(PALETTES) as Array<keyof typeof PALETTES>).map((name) => (
            <div key={name} className="gcl-row">
              <span style={{ width: 84, fontSize: 11 }}>{name}</span>
              <div
                style={{
                  flex: 1,
                  height: 14,
                  borderRadius: 3,
                  background: colorScaleToCss([...PALETTES[name]]),
                  border: '1px solid var(--gcl-border)',
                }}
              />
            </div>
          ))}
        </div>

        <p className="demo-note" style={{ marginTop: 16 }}>
          <code className="demo-code">sampleColorScale(heat, 9)</code>
        </p>
        <div className="gcl-row">
          {swatches.map((color) => (
            <span
              key={color}
              title={color}
              style={{
                width: 26,
                height: 26,
                borderRadius: 4,
                background: color,
                border: '1px solid var(--gcl-border)',
              }}
            />
          ))}
        </div>

        <p className="demo-note" style={{ marginTop: 16 }}>
          <code className="demo-code">buildColorLut(heat, 8)</code> — the flat RGB
          array used per pixel
        </p>
        <div className="demo-readout">[{Array.from(lut).join(', ')}]</div>
      </DemoSurface>
    );
  },
};

/** Sampling band values at geographic coordinates. */
export const Sampling: Story = {
  render: () => {
    const { value: convective } = useAsset(loadConvectiveRaster);
    const raster = convective ?? PENDING;
    // Three positions inside the band's extent, and one outside it.
    const positions: Array<[number, number]> = [
      [87.2, 22.3],
      [85.5, 24.1],
      [89.4, 20.4],
      [200, 200],
    ];
    return (
      <DemoSurface note="`nearest` returns a value that exists in the source grid, which is correct for classified data; `bilinear` interpolates the four surrounding cells and matches what the smoothed rendering displays. Positions outside the extent and cells holding NoData return null rather than raising.">
        <div className="demo-readout">
          {positions
            .map(([lng, lat]) => {
              const nearest = sampleRaster(raster, [lng, lat], 'nearest');
              const bilinear = sampleRaster(raster, [lng, lat], 'bilinear');
              return `[${String(lng).padEnd(5)}, ${String(lat).padEnd(5)}]  nearest ${
                nearest.value?.toFixed(2) ?? 'null'
              }  bilinear ${bilinear.value?.toFixed(2) ?? 'null'}`;
            })
            .join('\n')}
        </div>
      </DemoSurface>
    );
  },
};
