import type { ReactNode } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { cx } from './utils';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/**
 * A modal surface, used sparingly — the only genuinely reusable case in a map
 * library is a settings or palette editor that is too large for a popover.
 *
 * `title` is required because Radix (correctly) refuses to render an
 * unlabelled dialog to assistive technology.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.55)',
            zIndex: 'var(--gcl-z-popover)' as unknown as number,
          }}
        />
        <RadixDialog.Content
          className={cx('gcl-surface', className)}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            minWidth: 280,
            maxWidth: 'min(90vw, 520px)',
            padding: 16,
          }}
        >
          <RadixDialog.Title className="gcl-panel__title">
            {title}
          </RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="gcl-panel__subtitle">
              {description}
            </RadixDialog.Description>
          ) : (
            <RadixDialog.Description className="gcl-visually-hidden">
              {title}
            </RadixDialog.Description>
          )}
          <div style={{ marginTop: 12 }}>{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
