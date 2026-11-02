import type { ReactNode, SVGProps } from 'react';

/**
 * Tool glyphs for the draw toolbar, inlined for the same reason as the icons in
 * `@hridayanp/ui`: a dozen paths cost less than an icon-library dependency.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 15, children, ...rest }: IconProps & { children: ReactNode }) {
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

export const PointToolIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 21s-6-5.6-6-11a6 6 0 1 1 12 0c0 5.4-6 11-6 11z" />
    <circle cx="12" cy="10" r="2" />
  </Icon>
);

export const LineToolIcon = (props: IconProps) => (
  <Icon {...props}>
    <polyline points="4 18 10 10 14 14 20 6" />
    <circle cx="4" cy="18" r="1.5" fill="currentColor" />
    <circle cx="20" cy="6" r="1.5" fill="currentColor" />
  </Icon>
);

export const PolygonToolIcon = (props: IconProps) => (
  <Icon {...props}>
    <polygon points="12 3 21 9.5 17.5 20 6.5 20 3 9.5" />
  </Icon>
);

export const RectangleToolIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="4" y="6" width="16" height="12" rx="1" />
  </Icon>
);

export const CircleToolIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8" />
    <line x1="12" y1="12" x2="20" y2="12" />
  </Icon>
);

export const FreehandToolIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 16c2-6 5-9 7-6s2 6 5 4 3-6 4-8" />
  </Icon>
);

export const SelectToolIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 3l12 8-5 1.5L9.5 18z" />
  </Icon>
);

export const TrashIcon = (props: IconProps) => (
  <Icon {...props}>
    <polyline points="4 7 20 7" />
    <path d="M9 7V4h6v3" />
    <path d="M6 7l1 13h10l1-13" />
  </Icon>
);

export const ClearIcon = (props: IconProps) => (
  <Icon {...props}>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </Icon>
);
