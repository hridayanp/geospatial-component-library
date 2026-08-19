/**
 * `@hridayanp/ui`
 *
 * The shared surface every visual package in the library is built from:
 * a floating panel, a button, a slider, a popover, a select, a dialog, a small
 * icon set — and the single stylesheet that themes all of them.
 *
 * Import the stylesheet once in your application:
 *
 * ```ts
 * import '@hridayanp/ui/styles.css';
 * ```
 *
 * Every colour, radius and font is a CSS custom property, so retheming means
 * overriding variables rather than fighting specificity.
 */

export { Button } from './Button';
export type { ButtonProps } from './Button';

export { Panel } from './Panel';
export type { PanelProps } from './Panel';

export { Slider } from './Slider';
export type { SliderProps } from './Slider';

export { Popover, Tooltip } from './Popover';
export type { PopoverProps, TooltipProps } from './Popover';

export { Select } from './Select';
export type { SelectOption, SelectProps } from './Select';

export { Dialog } from './Dialog';
export type { DialogProps } from './Dialog';

export {
  ChevronIcon,
  CollapseIcon,
  ExpandIcon,
  LayersIcon,
  MinusIcon,
  NextIcon,
  OpacityIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  PreviousIcon,
  TargetIcon,
} from './Icons';

export { cx, placementClass } from './utils';
export type { PanelPlacement } from './utils';
