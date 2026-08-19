import { useMemo, type CSSProperties, type ReactNode } from 'react';
import {
  Button,
  NextIcon,
  Panel,
  PauseIcon,
  PlayIcon,
  PreviousIcon,
  Select,
  Slider,
  cx,
  type PanelPlacement,
} from '@hridayanp/ui';
import {
  defaultFrameLabel,
  useTimeline,
  type TimelineFrame,
  type UseTimelineOptions,
} from './useTimeline';

const SPEED_OPTIONS = [
  { value: '0.5', label: '0.5×' },
  { value: '1', label: '1×' },
  { value: '2', label: '2×' },
  { value: '4', label: '4×' },
];

export interface TimelineControlProps extends UseTimelineOptions {
  /** Heading for the control's panel. */
  title?: ReactNode;
  /** Label for the active frame. Defaults to label → timestamp → id. */
  formatLabel?: (frame: TimelineFrame | undefined, index: number) => ReactNode;
  /** Show the play/pause button. Default `true`. */
  showPlayback?: boolean;
  /** Show previous/next buttons. Default `true`. */
  showStepping?: boolean;
  /** Show the speed selector. Default `false`. */
  showSpeed?: boolean;
  /** Called when the user picks a different speed. */
  onSpeedChange?: (speed: number) => void;
  /** Draw a tick under the scrubber for each frame. Default `true`. */
  showTicks?: boolean;
  /** Show the `3 / 24` frame counter. Default `true`. */
  showCounter?: boolean;
  orientation?: 'horizontal' | 'vertical';
  /** Dock to a corner of the map. Omit to position it yourself. */
  placement?: PanelPlacement;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Extra content below the controls. */
  children?: ReactNode;
}

/**
 * Playback control for any sequence of frames.
 *
 * It knows nothing about where frames come from or what they show — only that
 * there are N of them and one is current. That is what lets the same control
 * drive a raster animation, a vector time series, or a set of pre-rendered
 * images.
 *
 * @example
 * ```tsx
 * <TimelineControl
 *   frames={frames}
 *   index={index}
 *   onIndexChange={setIndex}
 *   showSpeed
 *   placement="bottom-center"
 * />
 * ```
 */
export function TimelineControl({
  title,
  formatLabel,
  showPlayback = true,
  showStepping = true,
  showSpeed = false,
  onSpeedChange,
  showTicks = true,
  showCounter = true,
  orientation = 'horizontal',
  placement,
  disabled,
  className,
  style,
  children,
  ...timelineOptions
}: TimelineControlProps) {
  const timeline = useTimeline(timelineOptions);
  const { frames, speed = 1 } = timelineOptions;
  const count = frames.length;

  const label = useMemo(
    () =>
      formatLabel
        ? formatLabel(timeline.frame, timeline.index)
        : defaultFrameLabel(timeline.frame),
    [formatLabel, timeline.frame, timeline.index],
  );

  const isDisabled = disabled || timeline.empty;

  return (
    <Panel
      {...(title ? { title } : {})}
      {...(placement ? { placement } : {})}
      className={cx('gcl-timeline', `gcl-timeline--${orientation}`, className)}
      {...(style ? { style } : {})}
    >
      <div className="gcl-timeline__row">
        {showStepping && (
          <Button
            variant="icon"
            aria-label="Previous frame"
            disabled={isDisabled}
            onClick={timeline.previous}
          >
            <PreviousIcon />
          </Button>
        )}

        {showPlayback && (
          <Button
            variant="icon"
            aria-label={timeline.playing ? 'Pause' : 'Play'}
            aria-pressed={timeline.playing}
            disabled={isDisabled || count <= 1}
            onClick={timeline.toggle}
          >
            {timeline.playing ? <PauseIcon /> : <PlayIcon />}
          </Button>
        )}

        {showStepping && (
          <Button
            variant="icon"
            aria-label="Next frame"
            disabled={isDisabled}
            onClick={timeline.next}
          >
            <NextIcon />
          </Button>
        )}

        <div className="gcl-timeline__scrubber">
          <Slider
            aria-label="Timeline position"
            value={timeline.index}
            min={0}
            // A single-frame timeline would give the slider a zero-width range,
            // which Radix rejects.
            max={Math.max(1, count - 1)}
            step={1}
            disabled={isDisabled}
            onValueChange={timeline.setIndex}
          />
          {showTicks && count > 1 && count <= 96 && (
            <div className="gcl-timeline__ticks" aria-hidden>
              {frames.map((frame, tickIndex) => (
                <span
                  key={frame.id}
                  className={cx(
                    'gcl-timeline__tick',
                    tickIndex === timeline.index && 'gcl-timeline__tick--active',
                  )}
                  style={{ left: `${(tickIndex / (count - 1)) * 100}%` }}
                />
              ))}
            </div>
          )}
        </div>

        <span className="gcl-timeline__label">{label}</span>

        {showCounter && (
          <span className="gcl-timeline__count">
            {count === 0 ? '0 / 0' : `${timeline.index + 1} / ${count}`}
          </span>
        )}

        {showSpeed && (
          <Select
            aria-label="Playback speed"
            value={String(speed)}
            options={SPEED_OPTIONS}
            disabled={isDisabled}
            onValueChange={(value) => onSpeedChange?.(Number(value))}
          />
        )}
      </div>
      {children}
    </Panel>
  );
}
