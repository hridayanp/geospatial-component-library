import { forwardRef, type CSSProperties, type ReactNode } from 'react';
import { cx, placementClass, type PanelPlacement } from './utils';

export interface PanelProps {
  /** Heading shown in the panel's header bar. Omit for a bare panel. */
  title?: ReactNode;
  /** Secondary line under the title. */
  subtitle?: ReactNode;
  /** Content placed at the right of the header — usually controls. */
  actions?: ReactNode;
  /**
   * Dock the panel to a corner of the map. Omit to lay it out yourself; the
   * panel then behaves as a normal block element.
   */
  placement?: PanelPlacement;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * The floating card that every map overlay in the library sits in.
 *
 * Overlays are rendered inside a `pointer-events: none` layer above the canvas
 * so the map stays draggable through the gaps between them; `Panel` opts its
 * own subtree back into pointer events.
 */
export const Panel = forwardRef<HTMLDivElement, PanelProps>(function Panel(
  { title, subtitle, actions, placement, className, style, children },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx('gcl-panel', placementClass(placement), className)}
      style={style}
    >
      {(title || actions || subtitle) && (
        <div className="gcl-panel__header">
          <div>
            {title && <h3 className="gcl-panel__title">{title}</h3>}
            {subtitle && <p className="gcl-panel__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="gcl-row">{actions}</div>}
        </div>
      )}
      <div className="gcl-panel__body">{children}</div>
    </div>
  );
});
