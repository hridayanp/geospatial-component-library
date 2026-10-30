import { useEffect, useState, type CSSProperties } from 'react';
import { haversineDistanceKm } from '@hridayanp/geo-utils';
import { useMap } from '@hridayanp/map-container';
import { cx, placementClass, type PanelPlacement } from '@hridayanp/ui';

/** Distance unit system for the scale bar. */
export type ScaleUnit = 'metric' | 'imperial' | 'nautical';

export interface ScaleBarProps {
  /** Unit system. `'nautical'` suits marine and aviation maps. Default `'metric'`. */
  unit?: ScaleUnit;
  /** Longest the bar may grow, in pixels. Default `120`. */
  maxWidth?: number;
  /** Corner of the map to dock to. Default `'bottom-left'`. */
  placement?: PanelPlacement;
  className?: string;
  style?: CSSProperties;
}

const UNITS: Record<ScaleUnit, { big: [string, number]; small: [string, number] }> = {
  metric: { big: ['km', 1], small: ['m', 1000] },
  imperial: { big: ['mi', 0.621371], small: ['ft', 3280.84] },
  nautical: { big: ['NM', 0.539957], small: ['NM', 0.539957] },
};

/** Round a distance down to 1, 2 or 5 × 10ⁿ, the steps a reader can divide in their head. */
export function roundScaleDistance(value: number): number {
  if (!(value > 0)) return 0;
  const power = 10 ** Math.floor(Math.log10(value));
  const fraction = value / power;
  const step = fraction >= 5 ? 5 : fraction >= 2 ? 2 : 1;
  return step * power;
}

/**
 * A scale bar measured at the centre of the view.
 *
 * Web Mercator stretches distance with latitude, so the bar is recomputed from
 * the geodesic distance across its own width at the map's centre on every
 * move — the scale at the equator and at 60° differs by a factor of two.
 */
export function ScaleBar({
  unit = 'metric',
  maxWidth = 120,
  placement = 'bottom-left',
  className,
  style,
}: ScaleBarProps) {
  const { map } = useMap();
  const [scale, setScale] = useState<{ width: number; label: string } | null>(null);

  useEffect(() => {
    if (!map) return;
    const update = () => {
      const container = map.getContainer();
      const y = container.clientHeight / 2;
      const x = container.clientWidth / 2;
      const left = map.unproject([x - maxWidth / 2, y]);
      const right = map.unproject([x + maxWidth / 2, y]);
      const km = haversineDistanceKm([left.lng, left.lat], [right.lng, right.lat]);
      if (!(km > 0)) return setScale(null);

      const { big, small } = UNITS[unit];
      let [label, factor] = big;
      let distance = km * factor;
      if (distance < 1 && unit !== 'nautical') {
        [label, factor] = small;
        distance = km * factor;
      }
      const rounded = roundScaleDistance(distance);
      setScale({
        width: Math.round((rounded / distance) * maxWidth),
        label: `${rounded.toLocaleString()} ${label}`,
      });
    };
    update();
    map.on('move', update);
    map.on('resize', update);
    return () => {
      map.off('move', update);
      map.off('resize', update);
    };
  }, [map, unit, maxWidth]);

  if (!scale) return null;

  return (
    <div
      className={cx('gcl-scale-bar', placementClass(placement), className)}
      style={style}
      aria-label={`Scale: ${scale.label}`}
      role="img"
    >
      <div className="gcl-scale-bar__line" style={{ width: scale.width }} />
      <span className="gcl-scale-bar__label">{scale.label}</span>
    </div>
  );
}
