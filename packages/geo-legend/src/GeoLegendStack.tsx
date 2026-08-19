import type { CSSProperties, ReactNode } from 'react';
import { cx, placementClass, type PanelPlacement } from '@hridayanp/ui';

export interface GeoLegendStackProps {
  /** Corner of the map to dock the stack to. Default `'bottom-right'`. */
  placement?: PanelPlacement;
  /** Stack direction. Default `'vertical'`. */
  direction?: 'vertical' | 'horizontal';
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * Stack several legends in one corner of the map.
 *
 * A composed map usually shows more than one thing at once — a raster, a
 * vector overlay, a particle field — and each needs its own key. Docking each
 * legend independently makes them collide; stacking them keeps one tidy
 * column and one place to reason about.
 *
 * The stack itself is transparent to pointer events, so the map stays
 * draggable through the gaps between legends.
 */
export function GeoLegendStack({
  placement = 'bottom-right',
  direction = 'vertical',
  className,
  style,
  children,
}: GeoLegendStackProps) {
  return (
    <div
      className={cx('gcl-legend-stack', placementClass(placement), className)}
      style={{
        flexDirection: direction === 'vertical' ? 'column' : 'row',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
