import { forwardRef } from 'react';
import * as RadixSlider from '@radix-ui/react-slider';
import { cx } from './utils';

export interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  /** Fired once when the user releases the thumb. */
  onValueCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
  /** Accessible name. Always supply one for an unlabelled control. */
  'aria-label'?: string;
  className?: string;
}

/**
 * A single-thumb slider.
 *
 * Wraps Radix so keyboard interaction, ARIA wiring and RTL behaviour are
 * correct, while exposing a plain `number` instead of Radix's array API —
 * the library has no use for range selection.
 */
export const Slider = forwardRef<HTMLSpanElement, SliderProps>(function Slider(
  {
    value,
    onValueChange,
    onValueCommit,
    min = 0,
    max = 1,
    step = 0.01,
    disabled,
    orientation = 'horizontal',
    className,
    ...rest
  },
  ref,
) {
  return (
    <RadixSlider.Root
      ref={ref}
      className={cx('gcl-slider', className)}
      value={[value]}
      onValueChange={([next]) => onValueChange(next as number)}
      onValueCommit={
        onValueCommit ? ([next]) => onValueCommit(next as number) : undefined
      }
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      orientation={orientation}
      {...rest}
    >
      <RadixSlider.Track className="gcl-slider__track">
        <RadixSlider.Range className="gcl-slider__range" />
      </RadixSlider.Track>
      <RadixSlider.Thumb className="gcl-slider__thumb" />
    </RadixSlider.Root>
  );
});
