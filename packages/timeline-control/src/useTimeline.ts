import { useCallback, useEffect, useRef, useState } from 'react';

/** One step in a timeline. Only `id` is required. */
export interface TimelineFrame {
  /** Stable identity — a timestamp, a file name, an index. */
  id: string;
  /** Text shown while this frame is active. Falls back to `id`. */
  label?: string;
  /** Machine-readable instant, when the frame represents a point in time. */
  timestamp?: string | number | Date;
  /** Anything the host wants to carry alongside the frame. */
  meta?: unknown;
}

export interface UseTimelineOptions {
  frames: TimelineFrame[];
  /** Controlled index. Omit for uncontrolled behaviour. */
  index?: number;
  /** Starting index when uncontrolled. Default `0`. */
  defaultIndex?: number;
  onIndexChange?: (index: number, frame: TimelineFrame | undefined) => void;

  /** Controlled playback state. Omit for uncontrolled behaviour. */
  playing?: boolean;
  defaultPlaying?: boolean;
  onPlayingChange?: (playing: boolean) => void;

  /** Milliseconds each frame is held at speed `1`. Default `600`. */
  frameDurationMs?: number;
  /** Playback rate multiplier. Default `1`. */
  speed?: number;
  /** Restart from the beginning after the last frame. Default `true`. */
  loop?: boolean;
}

export interface TimelineApi {
  index: number;
  frame: TimelineFrame | undefined;
  playing: boolean;
  setIndex: (index: number) => void;
  next: () => void;
  previous: () => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** `true` when there are no frames to play. */
  empty: boolean;
}

/**
 * Playback state for a sequence of frames.
 *
 * Supports controlled and uncontrolled use for both the index and the playing
 * flag, so a host can own as much or as little of the state as it wants —
 * which matters because a timeline is frequently driven from two places at
 * once (the control itself, and a keyboard shortcut or URL somewhere else).
 *
 * The advance loop is a self-correcting timer rather than `setInterval`, so a
 * frame that takes longer than its slot does not accumulate drift.
 */
export function useTimeline({
  frames,
  index: controlledIndex,
  defaultIndex = 0,
  onIndexChange,
  playing: controlledPlaying,
  defaultPlaying = false,
  onPlayingChange,
  frameDurationMs = 600,
  speed = 1,
  loop = true,
}: UseTimelineOptions): TimelineApi {
  const [internalIndex, setInternalIndex] = useState(defaultIndex);
  const [internalPlaying, setInternalPlaying] = useState(defaultPlaying);

  const isIndexControlled = controlledIndex != null;
  const isPlayingControlled = controlledPlaying != null;

  const count = frames.length;
  const rawIndex = isIndexControlled ? controlledIndex : internalIndex;
  const index = count === 0 ? 0 : Math.min(Math.max(0, rawIndex), count - 1);
  const playing = isPlayingControlled ? controlledPlaying : internalPlaying;

  const callbacks = useRef({ onIndexChange, onPlayingChange });
  callbacks.current = { onIndexChange, onPlayingChange };

  const setIndex = useCallback(
    (next: number) => {
      if (count === 0) return;
      const clamped = Math.min(Math.max(0, next), count - 1);
      if (!isIndexControlled) setInternalIndex(clamped);
      callbacks.current.onIndexChange?.(clamped, frames[clamped]);
    },
    [count, frames, isIndexControlled],
  );

  const setPlaying = useCallback(
    (next: boolean) => {
      if (!isPlayingControlled) setInternalPlaying(next);
      callbacks.current.onPlayingChange?.(next);
    },
    [isPlayingControlled],
  );

  const next = useCallback(() => {
    if (count === 0) return;
    const candidate = index + 1;
    if (candidate >= count) {
      if (!loop) {
        setPlaying(false);
        return;
      }
      setIndex(0);
      return;
    }
    setIndex(candidate);
  }, [count, index, loop, setIndex, setPlaying]);

  const previous = useCallback(() => {
    if (count === 0) return;
    setIndex(index - 1 < 0 ? (loop ? count - 1 : 0) : index - 1);
  }, [count, index, loop, setIndex]);

  /* ---------------------------------------------------------------- */
  /* Advance loop                                                      */
  /* ---------------------------------------------------------------- */
  const nextRef = useRef(next);
  nextRef.current = next;

  useEffect(() => {
    if (!playing || count <= 1) return;
    const interval = Math.max(16, frameDurationMs / Math.max(0.05, speed));

    let timer: ReturnType<typeof setTimeout>;
    let expected = performance.now() + interval;

    const tick = () => {
      nextRef.current();
      // Correct for how long the previous frame actually took, so playback
      // keeps its nominal rate instead of slipping under load.
      const drift = performance.now() - expected;
      expected += interval;
      timer = setTimeout(tick, Math.max(0, interval - drift));
    };

    timer = setTimeout(tick, interval);
    return () => clearTimeout(timer);
  }, [playing, count, frameDurationMs, speed]);

  return {
    index,
    frame: frames[index],
    playing,
    setIndex,
    next,
    previous,
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    toggle: () => setPlaying(!playing),
    empty: count === 0,
  };
}

/**
 * Default frame label: the explicit label, then a formatted timestamp, then
 * the id.
 *
 * Times are rendered in the viewer's own locale rather than a fixed format —
 * a map read across time zones should not silently show someone else's clock.
 */
export function defaultFrameLabel(frame: TimelineFrame | undefined): string {
  if (!frame) return '—';
  if (frame.label) return frame.label;
  if (frame.timestamp != null) {
    const date = new Date(frame.timestamp);
    if (!Number.isNaN(date.valueOf())) {
      return date.toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }
  return frame.id;
}
