import type { SVGProps } from 'react';

/**
 * The handful of glyphs the library's controls need, inlined as SVG.
 *
 * Bundling twelve paths is far cheaper than taking a dependency on an icon
 * library — and it means a consumer never ends up with two icon sets in their
 * bundle just because they installed a map control.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 15, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const PlayIcon = (props: IconProps) => (
  <Icon {...props}>
    <polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none" />
  </Icon>
);

export const PauseIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="6" y="4" width="4" height="16" fill="currentColor" stroke="none" />
    <rect x="14" y="4" width="4" height="16" fill="currentColor" stroke="none" />
  </Icon>
);

export const PreviousIcon = (props: IconProps) => (
  <Icon {...props}>
    <polygon points="19 20 9 12 19 4 19 20" fill="currentColor" stroke="none" />
    <line x1="5" y1="19" x2="5" y2="5" />
  </Icon>
);

export const NextIcon = (props: IconProps) => (
  <Icon {...props}>
    <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" stroke="none" />
    <line x1="19" y1="5" x2="19" y2="19" />
  </Icon>
);

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </Icon>
);

export const MinusIcon = (props: IconProps) => (
  <Icon {...props}>
    <line x1="5" y1="12" x2="19" y2="12" />
  </Icon>
);

export const ExpandIcon = (props: IconProps) => (
  <Icon {...props}>
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </Icon>
);

export const CollapseIcon = (props: IconProps) => (
  <Icon {...props}>
    <polyline points="4 14 10 14 10 20" />
    <polyline points="20 10 14 10 14 4" />
    <line x1="14" y1="10" x2="21" y2="3" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </Icon>
);

export const TargetIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="7" />
    <line x1="12" y1="1" x2="12" y2="4" />
    <line x1="12" y1="20" x2="12" y2="23" />
    <line x1="1" y1="12" x2="4" y2="12" />
    <line x1="20" y1="12" x2="23" y2="12" />
  </Icon>
);

export const LayersIcon = (props: IconProps) => (
  <Icon {...props}>
    <polygon points="12 2 22 8 12 14 2 8 12 2" />
    <polyline points="2 16 12 22 22 16" />
  </Icon>
);

export const OpacityIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3l5.5 6.2a7.4 7.4 0 1 1-11 0z" />
  </Icon>
);

export const ChevronIcon = ({
  direction = 'down',
  ...props
}: IconProps & { direction?: 'up' | 'down' | 'left' | 'right' }) => {
  const rotation = { up: 180, down: 0, left: 90, right: -90 }[direction];
  return (
    <Icon {...props} style={{ transform: `rotate(${rotation}deg)`, ...props.style }}>
      <polyline points="6 9 12 15 18 9" />
    </Icon>
  );
};
