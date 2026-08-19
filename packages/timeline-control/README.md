# @hridayanp/timeline-control

Playback for any sequence of frames.

## Installation

```bash
npm install @hridayanp/timeline-control react
```



This package renders UI, so import the stylesheet once anywhere in your app:

```ts
import '@hridayanp/ui/styles.css';
```

Every colour, radius and font is a CSS custom property — override the variables
to retheme, and set `data-gcl-theme="light"` or `"dark"` on any ancestor to
switch modes.


## Usage

```tsx
<TimelineControl
  frames={frames}
  index={index}
  onIndexChange={setIndex}
  frameDurationMs={500}
  placement="bottom-center"
/>
```

## Data format

```ts
interface TimelineFrame {
  id: string;                              // required
  label?: string;
  timestamp?: string | number | Date;
  meta?: unknown;                          // anything you need back
}
```

Only `id` is required. Anything else — a URL, a raster, a model run — goes in
`meta` and comes back untouched in `onIndexChange`.

## What it knows

That there are N frames and one is current. Not where they came from, not what
they show, not whether they are even chronological. That is what lets the same
control drive a raster animation, a vector time series and a set of images.

## Controlled and uncontrolled

Both `index` and `playing` work either way, independently. A timeline is
frequently driven from two places at once — the control, plus a keyboard
shortcut or a URL — so the host can own as much of the state as it needs.

## Props

| Prop | Default | Notes |
| --- | --- | --- |
| `frames` | — | Empty disables the control rather than breaking |
| `index` / `defaultIndex` / `onIndexChange` | `0` | |
| `playing` / `defaultPlaying` / `onPlayingChange` | `false` | |
| `frameDurationMs` | `600` | Hold time at speed 1 |
| `speed` / `onSpeedChange` | `1` | Playback rate multiplier |
| `loop` | `true` | |
| `formatLabel` | label → timestamp → id | |
| `showPlayback` / `showStepping` / `showSpeed` / `showTicks` / `showCounter` | | Each part is individually removable |
| `placement` | — | Docks to a map corner |

## Playback timing

The advance loop is a **self-correcting timer**, not `setInterval`. A frame that
overruns its slot does not accumulate drift, so playback keeps its nominal rate
even when decoding is slow.

## The hook alone

```tsx
import { useTimeline } from '@hridayanp/timeline-control';

const timeline = useTimeline({ frames, frameDurationMs: 400 });
// { index, frame, playing, setIndex, next, previous, play, pause, toggle, empty }
```

## Time zones

Default labels are formatted in the **viewer's own locale**. A map read across
time zones should not silently show someone else's clock; pass `formatLabel` to
force UTC or any other convention.

## Documentation

Interactive examples for every prop live in the workspace Storybook:

```bash
npm run storybook
```

## License

MIT
