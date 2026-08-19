import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cx } from './utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual weight. `icon` renders a square 28px control. */
  variant?: 'ghost' | 'solid' | 'outline' | 'icon';
  size?: 'sm' | 'md';
  /** Render in an "on" state, e.g. for a toggle. */
  active?: boolean;
  /**
   * Render as the single child element instead of a `<button>`, forwarding all
   * props to it. Use when the control must be an anchor or a Radix trigger.
   */
  asChild?: boolean;
}

/**
 * The library's only button. Every visual control — zoom, play, fullscreen,
 * palette toggles — is this component with a different variant, which is what
 * keeps eleven packages looking like one product.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', size = 'md', active, asChild, className, type, ...rest },
  ref,
) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      ref={ref}
      // Buttons inside a form would otherwise submit it.
      type={asChild ? undefined : (type ?? 'button')}
      className={cx(
        'gcl-button',
        `gcl-button--${variant}`,
        size === 'sm' && 'gcl-button--sm',
        active && 'gcl-button--active',
        className,
      )}
      data-state={active ? 'on' : 'off'}
      {...rest}
    />
  );
});
