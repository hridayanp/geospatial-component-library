## Purpose

`TimelineControl` sequences an ordered set of frames and drives playback across
them — a raster forecast animation, a vector time series, a stack of
pre-rendered images.

Its model is deliberately minimal: there are *N* frames and one is current. It
holds no knowledge of what the frames contain, where they originated, or whether
they are chronological, which is what allows one component to drive
substantively different kinds of sequence.

```bash
npm install @hridayanp/timeline-control react
```

```ts
import '@hridayanp/ui/styles.css';
```

## Responsibilities

| Concern | Owner |
| --- | --- |
| Active index and playback state | `TimelineControl`, controlled or uncontrolled |
| Advance scheduling and drift correction | `TimelineControl` |
| Scrubber, stepping, speed and counter presentation | `TimelineControl` |
| Frame acquisition, decoding and prefetch | Host application |
| Interpretation of frame content | Host application |

```tsx
<MapContainer center={[92, 25.5]} zoom={6}>
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

## Data model

```ts
interface TimelineFrame {
  id: string;                            // stable identity; the only required field
  label?: string;                        // text shown while active
  timestamp?: string | number | Date;    // machine-readable instant
  meta?: unknown;                        // carried through untouched
}
```

`meta` is typed `unknown` deliberately. A URL, a decoded raster, a model-run
identifier or an entire payload may be attached; the control passes it through
without inspection, which is what decouples the component from the data it
sequences.

```ts
const frames = forecast.map((step) => ({
  id: step.validTime,
  timestamp: step.validTime,
  meta: { raster: step.grid, run: step.modelRun },
}));
```

An empty `frames` array renders a disabled control rather than raising — the
normal state before data resolves.

## State ownership

`index` and `playing` are independently controllable, each with an uncontrolled
default:

```tsx
{/* both uncontrolled */}
<TimelineControl frames={frames} defaultIndex={0} />

{/* index owned by the application, playback owned by the control */}
<TimelineControl frames={frames} index={index} onIndexChange={setIndex} />

{/* both owned by the application */}
<TimelineControl
  frames={frames}
  index={index}   onIndexChange={setIndex}
  playing={playing} onPlayingChange={setPlaying}
/>
```

A temporal sequence is frequently driven from more than one origin — the
control, plus a keyboard shortcut, a URL parameter or a "jump to latest" action.
Separating the two allows the host to assume exactly as much ownership as it
requires.

`onIndexChange` receives `(index, frame)`, so the active frame is available
without a second lookup.

## Configuration

| Prop | Type | Default | Behaviour |
| --- | --- | --- | --- |
| `frames` | `TimelineFrame[]` | — | Empty disables the control |
| `index` / `defaultIndex` | `number` | `0` | Controlled / uncontrolled active index |
| `onIndexChange` | `(index, frame) => void` | — | |
| `playing` / `defaultPlaying` | `boolean` | `false` | Controlled / uncontrolled playback |
| `onPlayingChange` | `(playing: boolean) => void` | — | |
| `frameDurationMs` | `number` | `600` | Hold time per frame at speed 1 |
| `speed` | `number` | `1` | Playback rate multiplier |
| `onSpeedChange` | `(speed: number) => void` | — | Fired by the speed selector |
| `loop` | `boolean` | `true` | `false` halts on the final frame |
| `title` | `ReactNode` | — | Panel heading |
| `formatLabel` | `(frame, index) => ReactNode` | label → timestamp → id | Active-frame label |
| `showPlayback` | `boolean` | `true` | Play/pause control |
| `showStepping` | `boolean` | `true` | Previous/next controls |
| `showSpeed` | `boolean` | `false` | Speed selector |
| `showTicks` | `boolean` | `true` | Tick marks beneath the scrubber |
| `showCounter` | `boolean` | `true` | `3 / 24` frame counter |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | |
| `placement` | `PanelPlacement` | — | Docks to a map corner; omit to position externally |
| `disabled` | `boolean` | `false` | |
| `className` / `style` | | — | Applied to the panel |
| `children` | `ReactNode` | — | Additional content below the controls |

Each region is individually removable, so a minimal embedded scrubber is
`showPlayback={false} showStepping={false} showCounter={false}`.

## Advance scheduling

Playback uses a **self-correcting timer**, not `setInterval`. Each tick
schedules the next against the expected wall-clock time rather than a fixed
delay:

```text
target(n) = start + n * frameDurationMs / speed
delay     = max(0, target(n + 1) - now)
```

A frame that overruns its interval — because a GeoTIFF was still decoding —
shortens the subsequent delay rather than displacing every later frame. Across a
24-frame loop this is the difference between playback that holds its nominal
rate and playback that visibly drifts.

> **Note:** The scheduler does not await layer rendering. When frames are slow
> to decode, prefetch the next one — see
> [`raster-layer`](/docs/raster-layer#temporal-sequences).

## The timeline hook

```tsx
import { useTimeline, defaultFrameLabel } from '@hridayanp/timeline-control';

const timeline = useTimeline({ frames, frameDurationMs: 400, loop: true });
```

`TimelineApi` exposes `{ index, frame, playing, setIndex, next, previous, play,
pause, toggle, empty }` — the full behaviour of the control with none of its
interface. Appropriate for keyboard-driven playback, or when the scrubber
belongs elsewhere in the application layout.

```tsx
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === ' ') timeline.toggle();
    if (e.key === 'ArrowRight') timeline.next();
    if (e.key === 'ArrowLeft') timeline.previous();
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [timeline]);
```

## Temporal considerations

Default labels are formatted in the **viewer's own locale and time zone**. A map
read across time zones should not present another region's clock without
qualification, so an explicit convention is usually warranted:

```tsx
formatLabel={(frame) =>
  new Date(frame!.timestamp!).toLocaleString('en-GB', {
    timeZone: 'UTC',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  }) + ' UTC'
}
```

Meteorological and remote-sensing products are conventionally published in UTC;
labelling a forecast valid time in local time without a suffix is a common
source of operational misreading.

## Integration boundaries

- Frame intervals are uniform. Irregularly spaced observations require a custom
  scrubber built on `useTimeline`.
- The control exposes no buffering indicator, because it has no knowledge of
  what is loaded. Render one in `children`, driven by the layer's
  `onLoadingChange`.
- Frame ordering is the host's responsibility; the control does not sort.
