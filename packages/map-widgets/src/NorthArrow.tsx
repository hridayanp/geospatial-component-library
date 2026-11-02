import { useEffect, useState } from 'react';
import { useMap } from '@hridayanp/map-container';
import { Button, Tooltip, cx } from '@hridayanp/ui';

export interface NorthArrowProps {
  /**
   * Keep the arrow visible when the map already points north. Default
   * `false`: the control appears only once the map is rotated, when it is
   * needed.
   */
  alwaysVisible?: boolean;
  /** Also reset pitch to 0 on click. Default `true`. */
  resetPitch?: boolean;
  className?: string;
}

/**
 * A compass needle that turns with the map; click to face north again.
 *
 * Meant to sit inside a `MapControlBar` from `@hridayanp/map-controls`
 * alongside the other buttons.
 */
export function NorthArrow({
  alwaysVisible = false,
  resetPitch = true,
  className,
}: NorthArrowProps) {
  const { map } = useMap();
  const [bearing, setBearing] = useState(0);
  const [pitch, setPitch] = useState(0);

  useEffect(() => {
    if (!map) return;
    const update = () => {
      setBearing(map.getBearing());
      setPitch(map.getPitch());
    };
    update();
    map.on('rotate', update);
    map.on('pitch', update);
    return () => {
      map.off('rotate', update);
      map.off('pitch', update);
    };
  }, [map]);

  const rotated = Math.abs(bearing) > 0.5 || (resetPitch && pitch > 0.5);
  if (!alwaysVisible && !rotated) return null;

  return (
    <div className={cx('gcl-controls__group', className)}>
      <Tooltip label="Reset north" side="left">
        <Button
          aria-label={`Reset bearing to north (currently ${Math.round(((bearing % 360) + 360) % 360)}°)`}
          onClick={() =>
            map?.easeTo({ bearing: 0, ...(resetPitch ? { pitch: 0 } : {}), duration: 300 })
          }
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            aria-hidden="true"
            style={{ transform: `rotate(${-bearing}deg)`, transition: 'transform 80ms linear' }}
          >
            <polygon points="12 2 16 12 12 10.5 8 12" fill="var(--gcl-danger, #ef4444)" />
            <polygon points="12 22 8 12 12 13.5 16 12" fill="currentColor" opacity="0.6" />
          </svg>
        </Button>
      </Tooltip>
    </div>
  );
}
