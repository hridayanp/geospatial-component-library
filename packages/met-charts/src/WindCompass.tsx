import { degreesToCompass } from '@hridayanp/geo-utils';

export interface WindCompassProps {
  /** Direction the wind blows from, degrees. `null` for calm or missing. */
  direction: number | null;
  /** Speed printed in the centre. */
  speed?: number | null;
  /** Unit printed after the speed. Default `'kt'`. */
  unit?: string;
  /**
   * `'from'` (the default) points the needle at the wind's source, as a
   * station plot does; `'to'` points it downwind, as a drift arrow does.
   */
  pointTo?: 'from' | 'to';
  /** Diameter in pixels. Default `72`. */
  size?: number;
  className?: string;
}

/**
 * A small compass dial with a needle for wind direction and the speed in the
 * centre — for station cards, popups and dashboards.
 */
export function WindCompass({
  direction,
  speed,
  unit = 'kt',
  pointTo = 'from',
  size = 72,
  className,
}: WindCompassProps) {
  const c = 50;
  const angle = direction == null ? null : pointTo === 'to' ? (direction + 180) % 360 : direction;
  const label =
    direction == null
      ? `Calm${speed != null ? `, ${speed} ${unit}` : ''}`
      : `Wind from ${degreesToCompass(direction)} (${Math.round(direction)}°)${speed != null ? ` at ${Math.round(speed)} ${unit}` : ''}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={label}
      className={['gcl-wind-compass', className].filter(Boolean).join(' ')}
    >
      <circle cx={c} cy={c} r={44} className="gcl-wind-compass__dial" />
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i * 22.5 * Math.PI) / 180;
        const long = i % 4 === 0;
        return (
          <line
            key={i}
            x1={c + Math.sin(a) * (long ? 36 : 40)}
            y1={c - Math.cos(a) * (long ? 36 : 40)}
            x2={c + Math.sin(a) * 44}
            y2={c - Math.cos(a) * 44}
            className="gcl-wind-compass__tick"
          />
        );
      })}
      {(['N', 'E', 'S', 'W'] as const).map((letter, i) => {
        const a = (i * 90 * Math.PI) / 180;
        return (
          <text key={letter} x={c + Math.sin(a) * 28} y={c - Math.cos(a) * 28} dy="0.35em" textAnchor="middle" className="gcl-wind-compass__letter">
            {letter}
          </text>
        );
      })}
      {angle != null && (
        <g transform={`rotate(${angle} ${c} ${c})`}>
          <polygon points={`${c},8 ${c - 6},22 ${c + 6},22`} className="gcl-wind-compass__needle" />
          <line x1={c} y1={20} x2={c} y2={34} className="gcl-wind-compass__shaft" />
        </g>
      )}
      {speed != null && (
        <text x={c} y={c} dy="0.35em" textAnchor="middle" className="gcl-wind-compass__speed">
          {Math.round(speed)}
        </text>
      )}
    </svg>
  );
}
