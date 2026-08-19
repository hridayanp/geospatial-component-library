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
} from '@hridayanp/raster-utils';
import { DemoSurface } from './demo/DemoMap';
import { PALETTES, makeRaster } from './demo/data';

const raster = makeRaster();
const gappy = makeRaster({ noDataFraction: 0.3, seed: 23 });

const meta = {
  title: 'Utilities/Raster Utilities',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
The computational half of raster rendering, with no React and no map anywhere
in it.

**Installation**

\`\`\`bash
npm install @hridayanp/raster-utils
npm install geotiff   # optional — only for decodeGeoTIFF
\`\`\`

**Why it is a separate package**

Everything here is a plain function over plain data. That means it runs in a
web worker, unit-tests without a browser, and can be reused by a renderer that
has nothing to do with this library. Keeping it out of the React packages is
what makes offloading colourisation to a worker a five-line change rather than
a rewrite.

**The colourisation algorithm**

Model grids are coarse. Drawing one pixel per cell and blurring the *coloured*
result still reads as patchy blocks, because the colour was locked in before
the blur ran. So \`rasterToImageData\` interpolates the **raw numeric values**
between neighbouring cells first, and only then maps the smoothly varying
result through the ramp — via a precomputed 256-entry LUT, because calling a
colour library once per megapixel is the single biggest cost in the path.

Alpha gets the same treatment: a smooth ramp near the bottom of the range
instead of a hard cutoff, and a partial-coverage fade at the edge of the valid
region so the raster dissolves rather than showing a rectangle.

**GeoTIFF and COG**

\`decodeGeoTIFF(source)\` takes a URL or an \`ArrayBuffer\`. With a URL it uses
HTTP range requests, so a Cloud-Optimised GeoTIFF only transfers the overview
you asked for. The library decodes; your application decides how the URL was
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
  data: typeof raster;
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

/** Colourisation, with every knob exposed. */
export const ColorizePlayground: Story = {
  render: () => {
    const [smoothFactor, setSmoothFactor] = useState(6);
    const [smoothEdges, setSmoothEdges] = useState(false);
    const [palette, setPalette] = useState<keyof typeof PALETTES>('heat');
    const [fade, setFade] = useState(true);

    return (
      <DemoSurface note="No map, no React components — just rasterToImageData writing pixels onto a canvas. The chequerboard shows through where alpha is zero.">
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
            <p className="demo-note">With NoData gaps</p>
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

/** Statistics, skipping NoData. */
export const Statistics: Story = {
  render: () => {
    const full = computeRasterStats(raster.data, raster.noData);
    const holed = computeRasterStats(gappy.data, gappy.noData);
    return (
      <DemoSurface note="NoData cells and NaN are excluded from every statistic. A fully-empty band falls back to a 0–1 range rather than returning Infinity, so downstream normalisation stays finite.">
        <div className="demo-readout">
          {`complete   min ${full.min.toFixed(2)}  max ${full.max.toFixed(2)}  mean ${full.mean?.toFixed(2)}  valid ${full.validCount}/${full.totalCount}
with gaps  min ${holed.min.toFixed(2)}  max ${holed.max.toFixed(2)}  mean ${holed.mean?.toFixed(2)}  valid ${holed.validCount}/${holed.totalCount}`}
        </div>
      </DemoSurface>
    );
  },
};

/** Colour ramps: CSS gradients, LUTs and even sampling. */
export const ColorScales: Story = {
  render: () => {
    const swatches = useMemo(() => sampleColorScale([...PALETTES.heat], 9), []);
    const lut = useMemo(() => buildColorLut([...PALETTES.heat], 8), []);
    return (
      <DemoSurface note="A ramp resolves to a CSS gradient for legends, a byte LUT for per-pixel colouring, and evenly spaced swatches for classed styling.">
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

/** Reading values at coordinates. */
export const Sampling: Story = {
  render: () => {
    const positions: Array<[number, number]> = [
      [92, 25.5],
      [90, 24],
      [94.5, 27.5],
      [200, 200],
    ];
    return (
      <DemoSurface note="`nearest` returns a value that genuinely exists in the source; `bilinear` matches what the smoothed rendering shows. Off-grid positions return null rather than throwing — hovering off the edge of the data is normal.">
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
