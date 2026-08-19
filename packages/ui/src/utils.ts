/**
 * Join class names, dropping anything falsy.
 *
 * Deliberately tiny: the library has no Tailwind dependency and no need for
 * class-merging semantics, so a 6-line helper beats pulling in `clsx`.
 */
export function cx(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(' ');
}

/** Corner or edge of the map an overlay panel docks to. */
export type PanelPlacement =
  | 'top-left'
  | 'top-right'
  | 'top-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'bottom-center';

/** Class name for a docked overlay panel placement. */
export function placementClass(placement?: PanelPlacement): string {
  return placement ? `gcl-panel--floating gcl-panel--${placement}` : '';
}
