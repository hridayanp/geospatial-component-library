Playback for any sequence of frames — raster animations, vector time series, a
stack of images. It knows there are N frames and one is current; nothing else.

```bash
npm install @hridayanp/timeline-control react
```

Remember the stylesheet: `import '@hridayanp/ui/styles.css'`.

## Usage

```tsx
<MapContainer>
  <RasterLayer data={frames[index].meta.raster} frameKey={frames[index].id} />
  <TimelineControl
    frames={frames}
    index={index}
    onIndexChange={setIndex}
    frameDurationMs={500}
    placement="bottom-center"
  />
</MapContainer>
```

## Frames

```ts
interface TimelineFrame {
  id: string;                            // required — the only required field
  label?: string;
  timestamp?: string | number | Date;
  meta?: unknown;                        // anything; returned untouched
}
```

`meta` is deliberately `unknown`. A URL, a decoded raster, a model run
identifier, a whole payload — the control passes it through without inspecting
it, which is what lets one component drive completely different kinds of
sequence.

```ts
const frames = forecast.map((step) => ({
  id: step.validTime,
  timestamp: step.validTime,
  meta: { raster: step.grid, run: step.modelRun },
}));
```

## What it deliberately does not know

Where frames came from, what they show, whether they are chronological, or
whether the next one is even loaded. Loading state belongs to the layer that is
loading; the timeline just moves an index.

An empty `frames` array renders a disabled control rather than throwing — the
normal state before data arrives.

## Controlled and uncontrolled, per concern

`index` and `playing` are independently controllable:

```tsx
{/* both uncontrolled */}
<TimelineControl frames={frames} defaultIndex={0} />

{/* index owned by the app, playback owned by the control */}
<TimelineControl frames={frames} index={index} onIndexChange={setIndex} />

{/* both owned by the app */}
<TimelineControl
  frames={frames}
  index={index} onIndexChange={setIndex}
  playing={playing} onPlayingChange={setPlaying}
/>
```

A timeline is often driven from two places at once — the control, plus a
keyboard shortcut, a URL parameter or a "jump to latest" button. Splitting the
two lets the host take over exactly as much as it needs.

## Props

| Prop | Default | Notes |
| --- | --- | --- |
| `frames` | — | Empty disables rather than breaks |
| `index` / `defaultIndex` / `onIndexChange` | `0` | |
| `playing` / `defaultPlaying` / `onPlayingChange` | `false` | |
| `frameDurationMs` | `600` | Hold time per frame at speed 1 |
| `speed` / `onSpeedChange` | `1` | Rate multiplier |
| `speeds` | `[0.5, 1, 2, 4]` | Options in the speed menu |
| `loop` | `true` | `false` stops on the last frame |
| `formatLabel` | label → timestamp → id | `(frame, index) => ReactNode` |
| `showPlayback` | `true` | Play/pause |
| `showStepping` | `true` | Previous/next |
| `showSpeed` | `true` | |
| `showTicks` | `true` | Tick marks on the scrubber |
| `showCounter` | `true` | `3 / 24` |
| `title` | — | Header text |
| `footer` | — | Any node under the scrubber |
| `placement` | — | Docks to a map corner; omit to place it yourself |

Every part is individually removable, so a minimal embedded scrubber is
`showPlayback={false} showSpeed={false} showCounter={false}`.

## Playback is a self-correcting timer

Not `setInterval`. Each tick schedules the next one against the **expected**
wall-clock time rather than a fixed delay:

```text
target(n) = start + n * frameDurationMs / speed
delay     = max(0, target(n + 1) - now)
```

A frame that overruns its slot — because a GeoTIFF was still decoding — shortens
the following delay instead of pushing everything later. Over a 24-frame loop
that is the difference between playback that keeps its nominal rate and playback
that visibly drifts.

> **Note:** The timer does not wait for the layer to finish rendering. If your
> frames are slow to decode, prefetch the next one — see the animation section
> of [`raster-layer`](/docs/raster-layer).

## The hook alone

```tsx
import { useTimeline } from '@hridayanp/timeline-control';

const t = useTimeline({ frames, frameDurationMs: 400, loop: true });
// { index, frame, playing, setIndex, next, previous, play, pause, toggle, empty }
```

Everything the control does, with none of its UI. Useful for keyboard-driven
playback, or when the scrubber lives somewhere else in your layout entirely.

```tsx
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === ' ') t.toggle();
    if (e.key === 'ArrowRight') t.next();
    if (e.key === 'ArrowLeft') t.previous();
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [t]);
```

## Time zones

Default labels are formatted in the **viewer's own locale**. A map read across
time zones should not silently present someone else's clock as if it were local.

Force a convention with `formatLabel`:

```tsx
formatLabel={(frame) =>
  new Date(frame.timestamp!).toLocaleString('en-GB', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
  }) + ' UTC'
}
```

## Limitations

- Uniform frame duration. Irregular spacing needs a custom scrubber over
  `useTimeline`.
- No built-in buffering indicator — the control has no way to know what is
  loaded. Render your own in `footer` from the layer's `onLoadingChange`.
