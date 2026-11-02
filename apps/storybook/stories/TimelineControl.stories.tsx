import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TimelineControl, useTimeline } from '@hridayanp/timeline-control';
import { RasterLayer } from '@hridayanp/raster-layer';
import { DemoMap, DemoSurface } from './demo/DemoMap';
import { PALETTES } from './demo/data';
import { CONVECTIVE_VIEW, loadConvectiveRaster } from './demo/assets';
import { useAsset } from './demo/useAsset';
import { deriveRasterSequence } from './demo/derive';

const frames = Array.from({ length: 24 }, (_, index) => {
  const timestamp = new Date(
    Date.UTC(2026, 0, 1, 0, 0, 0) + index * 60 * 60 * 1000,
  ).toISOString();
  return { id: timestamp, timestamp };
});

const meta = {
  title: 'Overlays/Timeline Control',
  component: TimelineControl,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Sequences an ordered set of frames and drives playback across them — a raster
forecast animation, a vector time series, or a stack of pre-rendered images.

**Installation**

\`\`\`bash
npm install @hridayanp/timeline-control react
import '@hridayanp/ui/styles.css';
\`\`\`

### Responsibilities

The component owns the active index, playback state, advance scheduling and the
scrubber, stepping, speed and counter presentation. Frame acquisition, decoding
and prefetch remain with the consuming application, as does the interpretation
of frame content.

Its model is deliberately minimal: there are *N* frames and one is current. It
holds no knowledge of what the frames contain, where they originated, or whether
they are chronological — which is what allows one component to drive
substantively different kinds of sequence.

### Data model

\`frames\` is an array of \`{ id, label?, timestamp?, meta? }\`. Only \`id\` is
required, and it establishes the frame's identity.

\`meta\` is typed \`unknown\` deliberately: a URL, a decoded raster, a model-run
identifier or an entire payload may be attached, and the control passes it
through without inspection. \`onIndexChange\` receives \`(index, frame)\`, so the
active frame is available without a second lookup.

An empty \`frames\` array renders a disabled control rather than raising — the
normal state before data resolves.

### Interaction model

\`index\` and \`playing\` are independently controllable, each with an
uncontrolled default. A temporal sequence is frequently driven from more than
one origin — the control, plus a keyboard shortcut, a URL parameter or a
"jump to latest" action — so separating the two lets the host assume exactly as
much ownership as it requires.

### Advance scheduling

Playback uses a self-correcting timer rather than \`setInterval\`. Each tick
schedules the next against the expected wall-clock time:

\`\`\`text
target(n) = start + n * frameDurationMs / speed
delay     = max(0, target(n + 1) - now)
\`\`\`

A frame that overruns its interval — because a GeoTIFF was still decoding —
shortens the subsequent delay rather than displacing every later frame. The
scheduler does not await layer rendering, so slow frames should be prefetched
with \`preloadRasterFrame\`.

### Temporal considerations

Default labels are formatted in the viewer's own locale and time zone.
Meteorological and remote-sensing products are conventionally published in UTC,
and labelling a valid time in local time without a suffix is a common source of
operational misreading — supply \`formatLabel\` to fix the convention explicitly.

### The hook

\`useTimeline\` exposes the same behaviour with none of the interface:
\`{ index, frame, playing, setIndex, next, previous, play, pause, toggle, empty }\`.
        `,
      },
    },
  },
  argTypes: {
    frameDurationMs: { control: { type: 'range', min: 100, max: 2000, step: 50 } },
    speed: { control: { type: 'range', min: 0.25, max: 4, step: 0.25 } },
    loop: { control: 'boolean' },
    showPlayback: { control: 'boolean' },
    showStepping: { control: 'boolean' },
    showSpeed: { control: 'boolean' },
    showTicks: { control: 'boolean' },
    showCounter: { control: 'boolean' },
    disabled: { control: 'boolean' },
    orientation: { control: 'inline-radio', options: ['horizontal', 'vertical'] },
    frames: { control: false },
  },
} satisfies Meta<typeof TimelineControl>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Uncontrolled: the component owns both the index and playback state. */
export const Basic: Story = {
  args: { frames, frameDurationMs: 500, loop: true },
  render: (args) => (
    <DemoSurface note="Rendered standalone. Default labels are formatted in the viewer's own locale and time zone; supply formatLabel to fix a convention such as UTC explicitly.">
      <TimelineControl {...args} />
    </DemoSurface>
  ),
};

/** Controlled: the application owns the index and receives every change. */
export const Controlled: Story = {
  args: { frames },
  render: (args) => {
    const [index, setIndex] = useState(6);
    return (
      <DemoSurface>
        <TimelineControl {...args} index={index} onIndexChange={setIndex} />
        <div className="demo-readout" style={{ marginTop: 12 }}>
          {`index  ${index}
frame  ${frames[index]?.id ?? '—'}`}
        </div>
      </DemoSurface>
    );
  },
};

/** `showSpeed` enables the playback-rate selector. */
export const PlaybackSpeed: Story = {
  args: { frames, showSpeed: true, frameDurationMs: 600 },
  render: (args) => {
    const [speed, setSpeed] = useState(1);
    return (
      <DemoSurface note="`speed` divides the effective frame duration. The control reports a change through onSpeedChange; the application decides whether to adopt it.">
        <TimelineControl {...args} speed={speed} onSpeedChange={setSpeed} />
      </DemoSurface>
    );
  },
};

/** A minimal scrubber, with playback, stepping and the counter removed. */
export const ScrubberOnly: Story = {
  args: {
    frames,
    showPlayback: false,
    showStepping: false,
    showCounter: false,
    showTicks: false,
  },
  render: (args) => (
    <DemoSurface note="Each region is individually removable, so the control can be embedded in a constrained layout without a custom implementation.">
      <TimelineControl {...args} />
    </DemoSurface>
  ),
};

/** `formatLabel` controls the active-frame label. */
export const CustomLabels: Story = {
  args: { frames },
  render: (args) => (
    <DemoSurface note="Receives the frame and its index, and returns any React node — a formatted valid time, a lead-time offset, or a composed element.">
      <TimelineControl
        {...args}
        formatLabel={(frame, index) => (
          <span>
            <strong>T+{index}h</strong>{' '}
            <span style={{ color: 'var(--gcl-fg-muted)' }}>
              {frame?.timestamp?.toString().slice(11, 16)}
            </span>
          </span>
        )}
      />
    </DemoSurface>
  ),
};

/** An empty `frames` array renders a disabled control rather than raising. */
export const EmptyFrames: Story = {
  args: { frames: [] },
  render: (args) => (
    <DemoSurface note="This is the normal state before data resolves, and requires no placeholder from the application.">
      <TimelineControl {...args} />
    </DemoSurface>
  ),
};

/** Driving a raster sequence on a map. */
export const DrivingARaster: Story = {
  args: { frames: [] },
  render: () => {
    const { value: base } = useAsset(loadConvectiveRaster);
    const sequence = useMemo(
      () => (base ? deriveRasterSequence(base, 16) : []),
      [base],
    );
    const [index, setIndex] = useState(0);
    const active = sequence[index];

    return (
      <DemoMap {...CONVECTIVE_VIEW} note="The timeline owns the index and the layer owns the rendering; the application connects them. Supplying frameKey is what makes a revisited frame a texture swap rather than a re-decode.">
        {active && (
          <RasterLayer
            data={active.meta.raster}
            frameKey={active.id}
            colorScale={[...PALETTES.heat]}
            min={0}
            max={50}
            opacity={0.88}
          />
        )}
        <TimelineControl
          frames={sequence}
          index={index}
          onIndexChange={setIndex}
          frameDurationMs={450}
          placement="bottom-center"
        />
      </DemoMap>
    );
  },
};

/** `useTimeline` exposes the state machine without the interface. */
export const HookOnly: Story = {
  args: { frames: [] },
  render: () => {
    function CustomTimeline() {
      const timeline = useTimeline({ frames, frameDurationMs: 400 });
      return (
        <div className="gcl-row">
          <button className="gcl-button gcl-button--outline" onClick={timeline.toggle}>
            {timeline.playing ? 'Pause' : 'Play'}
          </button>
          <button className="gcl-button gcl-button--outline" onClick={timeline.previous}>
            Prev
          </button>
          <button className="gcl-button gcl-button--outline" onClick={timeline.next}>
            Next
          </button>
          <span className="demo-readout">
            {timeline.index + 1} / {frames.length} — {timeline.frame?.id.slice(11, 16)}
          </span>
        </div>
      );
    }

    return (
      <DemoSurface note="Appropriate for keyboard-driven playback, or when the scrubber belongs elsewhere in the application layout.">
        <CustomTimeline />
      </DemoSurface>
    );
  },
};
