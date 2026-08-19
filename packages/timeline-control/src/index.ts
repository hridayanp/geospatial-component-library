/**
 * `@hridayanp/timeline-control`
 *
 * Playback for any sequence of frames — raster animations, vector time series,
 * pre-rendered images. It knows how many frames there are and which is
 * current, and nothing else.
 *
 * Remember to import the stylesheet once: `import '@hridayanp/ui/styles.css'`.
 */

export { TimelineControl } from './TimelineControl';
export type { TimelineControlProps } from './TimelineControl';

export { defaultFrameLabel, useTimeline } from './useTimeline';
export type {
  TimelineApi,
  TimelineFrame,
  UseTimelineOptions,
} from './useTimeline';
