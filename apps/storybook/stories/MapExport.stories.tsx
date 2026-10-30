import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MapExportControl } from '@hridayanp/map-export';
import { MapControlBar, ZoomControl } from '@hridayanp/map-controls';
import { RasterLayer } from '@hridayanp/raster-layer';
import { TimelineControl } from '@hridayanp/timeline-control';
import { Panel } from '@hridayanp/ui';
import { DemoMap } from './demo/DemoMap';
import { PALETTES, makeRaster, makeRasterSequence } from './demo/data';

const FIELD = makeRaster({ seed: 9 });

const meta = {
  title: 'Overlays/Map Export',
  component: MapExportControl,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Export what the map shows: PNG, JPEG or WebP stills, and animated GIFs recorded
frame by frame.

**Installation**

\`\`\`bash
npm install @hridayanp/map-export @hridayanp/map-container maplibre-gl react
import '@hridayanp/ui/styles.css';
\`\`\`

### No preserveDrawingBuffer

WebGL clears its buffer after compositing, which is why map screenshots usually
require \`preserveDrawingBuffer\` — a memory cost for the map's whole life. Here
the export requests one render and copies the canvas inside that render
callback, so any \`MapContainer\` can be exported without opting in.

### What is captured

Only what MapLibre draws. HTML overlays — legends, panels — are not part of the
WebGL canvas; \`decorate\` draws onto the export with the 2D canvas API, and
\`title\` and \`attribution\` are built in. Tiles served without CORS headers taint
the canvas, and the browser then refuses any export; that is reported through
\`onError\`.

### Animated GIF

Give \`animation\` a frame count and a \`setFrame\` callback. The recorder steps
through the frames, waits for the map to go idle after each, and encodes with
the built-in encoder — a fixed 252-colour palette, identical across frames so
the animation never shimmers, with ordered dithering.

### Files or blobs

By default the file downloads; pass \`onExport\` to receive the \`Blob\` instead —
for an upload, a report attachment or a preview.
`,
      },
    },
  },
  argTypes: { animation: { control: false }, decorate: { control: false } },
} satisfies Meta<typeof MapExportControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Stills: Story = {
  args: { filename: 'demo-map', title: 'Demo field · 30 Oct 2026 06Z', attribution: '© OpenStreetMap contributors' },
  render: function Render(args) {
    const [preview, setPreview] = useState<string | null>(null);
    return (
      <DemoMap note="Export PNG or JPEG with a title band and attribution. Here the blob is previewed instead of downloaded.">
        <RasterLayer data={FIELD} colorScale={[...PALETTES.viridis]} opacity={0.85} />
        <MapControlBar>
          <ZoomControl />
          <MapExportControl
            {...args}
            onExport={(blob) => {
              if (preview) URL.revokeObjectURL(preview);
              setPreview(URL.createObjectURL(blob));
            }}
          />
        </MapControlBar>
        {preview && (
          <Panel placement="bottom-left" title="Exported image">
            <img src={preview} alt="Exported map" style={{ display: 'block', width: 220, borderRadius: 4 }} />
          </Panel>
        )}
      </DemoMap>
    );
  },
};

export const AnimatedGif: Story = {
  name: 'Animated GIF',
  args: { filename: 'demo-animation', title: 'Demo sequence' },
  render: function Render(args) {
    const frames = useMemo(() => makeRasterSequence(8), []);
    const [index, setIndex] = useState(0);
    const showFrame = (next: number) =>
      new Promise<void>((resolve) => {
        setIndex(next);
        // Let React commit and the layer upload the frame before capture.
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    return (
      <DemoMap note="Choose “Animated GIF”: the recorder steps the timeline, captures each frame and downloads the encoded GIF.">
        <RasterLayer data={frames[index]!.raster} colorScale={[...PALETTES.magma]} min={0} max={100} opacity={0.85} />
        <MapControlBar>
          <MapExportControl {...args} formats={['png']} animation={{ frameCount: frames.length, setFrame: showFrame, delayMs: 300, scale: 0.6 }} />
        </MapControlBar>
        <TimelineControl frames={frames.map((f) => ({ id: f.id, label: f.label }))} index={index} onIndexChange={setIndex} placement="bottom-center" />
      </DemoMap>
    );
  },
};
