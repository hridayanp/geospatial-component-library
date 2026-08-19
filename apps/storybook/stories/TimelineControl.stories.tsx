import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TimelineControl, useTimeline } from '@hridayanp/timeline-control';
import { RasterLayer } from '@hridayanp/raster-layer';
import { DemoMap, DemoSurface } from './demo/DemoMap';
import { PALETTES, makeRasterSequence } from './demo/data';

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
Playback for any sequence of frames.

**Installation**

\`\`\`bash
npm install @hridayanp/timeline-control react
import '@hridayanp/ui/styles.css';
\`\`\`

**Data format**

\`frames\` is an array of \`{ id, label?, timestamp?, meta? }\`. Only \`id\` is
required. Anything else you need to carry — a URL, a raster, a model run — goes
in \`meta\` and comes back untouched in \`onIndexChange\`.

**What it knows**

That there are N frames and one is current. Not where they came from, not what
they show, not whether they are even chronological. That is what lets the same
control drive a raster animation, a vector time series and a set of images.

**Controlled and uncontrolled**

Both \`index\` and \`playing\` work either way, independently. A timeline is often
driven from two places at once — the control, plus a keyboard shortcut or a URL
— so the host can own as much of the state as it needs.

**Playback timing**

The advance loop is a self-correcting timer, not \`setInterval\`. A frame that
overruns its slot does not accumulate drift, so playback keeps its nominal rate
even when decoding is slow.
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

/** Uncontrolled: the component owns both index and playback. */
export const Basic: Story = {
  args: { frames, frameDurationMs: 500, loop: true },
  render: (args) => (
    <DemoSurface note="Rendered standalone. Timestamps are formatted in the viewer's own locale — a map read across time zones should not silently show someone else's clock.">
      <TimelineControl {...args} />
    </DemoSurface>
  ),
};

/** Controlled, with the active frame shown alongside. */
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

/** With the speed selector enabled. */
export const PlaybackSpeed: Story = {
  args: { frames, showSpeed: true, frameDurationMs: 600 },
  render: (args) => {
    const [speed, setSpeed] = useState(1);
    return (
      <DemoSurface note="`speed` multiplies the frame duration. The control reports changes; the host decides what to do with them.">
        <TimelineControl {...args} speed={speed} onSpeedChange={setSpeed} />
      </DemoSurface>
    );
  },
};

/** A minimal scrubber: no buttons, no counter. */
export const ScrubberOnly: Story = {
  args: {
    frames,
    showPlayback: false,
    showStepping: false,
    showCounter: false,
    showTicks: false,
  },
  render: (args) => (
    <DemoSurface note="Every part of the control is individually removable, for embedding in a tighter layout.">
      <TimelineControl {...args} />
    </DemoSurface>
  ),
};

/** Custom frame labels. */
export const CustomLabels: Story = {
  args: { frames },
  render: (args) => (
    <DemoSurface note="`formatLabel` receives the frame and its index, and can return any node.">
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

/** An empty timeline disables itself rather than breaking. */
export const EmptyFrames: Story = {
  args: { frames: [] },
  render: (args) => (
    <DemoSurface note="Zero frames is a normal state while data is loading.">
      <TimelineControl {...args} />
    </DemoSurface>
  ),
};

/** Driving a raster animation on a map. */
export const DrivingARaster: Story = {
  args: { frames: [] },
  render: () => {
    const sequence = useMemo(() => makeRasterSequence(16), []);
    const [index, setIndex] = useState(0);
    const active = sequence[index];

    return (
      <DemoMap note="The timeline owns the index; the raster layer owns the rendering. Neither knows about the other.">
        {active && (
          <RasterLayer
            data={active.raster}
            frameKey={active.id}
            colorScale={[...PALETTES.heat]}
            min={0}
            max={100}
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

/** The hook alone, for a completely custom control. */
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
      <DemoSurface note="`useTimeline` gives you the state machine without any of the chrome.">
        <CustomTimeline />
      </DemoSurface>
    );
  },
};
