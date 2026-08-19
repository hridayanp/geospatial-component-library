import type { ReactNode } from 'react';
import * as RadixPopover from '@radix-ui/react-popover';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import { cx } from './utils';

export interface PopoverProps {
  /** The control that opens the popover. */
  trigger: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  /** Controlled open state. Omit for uncontrolled behaviour. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/**
 * A click-triggered floating surface, portalled to `document.body` so it is
 * never clipped by the map container's overflow or stacking context.
 */
export function Popover({
  trigger,
  children,
  side = 'top',
  align = 'center',
  open,
  onOpenChange,
  className,
}: PopoverProps) {
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cx('gcl-surface', className)}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

export interface TooltipProps {
  label: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delayMs?: number;
}

/**
 * A hover/focus tooltip for icon-only controls.
 *
 * Includes its own `Provider`, so a single control can be dropped anywhere
 * without the host having to wrap its tree.
 */
export function Tooltip({
  label,
  children,
  side = 'top',
  delayMs = 250,
}: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={delayMs}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={6}
            className="gcl-surface gcl-tooltip"
          >
            {label}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
