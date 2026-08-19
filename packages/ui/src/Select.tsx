import * as RadixSelect from '@radix-ui/react-select';
import { cx } from './utils';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string = string> {
  value: T;
  onValueChange: (value: T) => void;
  options: Array<SelectOption<T>>;
  /** Accessible name for the trigger. */
  'aria-label'?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * A compact dropdown for small option sets — playback speed, basemap choice,
 * interpolation mode.
 *
 * Content is portalled, so the list escapes the map's overflow clipping.
 */
export function Select<T extends string = string>({
  value,
  onValueChange,
  options,
  disabled,
  className,
  ...rest
}: SelectProps<T>) {
  return (
    <RadixSelect.Root
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      disabled={disabled}
    >
      <RadixSelect.Trigger
        className={cx('gcl-select__trigger', className)}
        {...rest}
      >
        <RadixSelect.Value />
        <RadixSelect.Icon aria-hidden>▾</RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content className="gcl-surface" position="popper" sideOffset={4}>
          <RadixSelect.Viewport>
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                className="gcl-select__item"
              >
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
