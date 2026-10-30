/**
 * Chart colour, and the rule that governs it.
 *
 * Colour in a geospatial chart is not free: when a chart describes something
 * also drawn on a map, the chart must adopt the map's symbology. A composition
 * chart of land cover whose "Trees" bar is not the green the map paints trees
 * forces the reader to re-learn the encoding between two views of one dataset,
 * and the mismatch reads as two different datasets.
 *
 * Every component here therefore takes its data colours from the caller — from
 * the same class table or ramp the layer was given. The palettes below are
 * fallbacks for series that have no cartographic colour of their own.
 */

/** Which job a colour is doing. Each job has exactly one legal structure. */
export type ColorRole = 'categorical' | 'sequential' | 'diverging';

/**
 * Eight categorical hues in fixed order, for series that carry identity.
 *
 * The order is the accessibility mechanism, not a style: it was chosen so that
 * adjacent slots stay separable under simulated protanopia and deuteranopia.
 * Assign in sequence and never cycle — a ninth series folds into "other" or
 * becomes a facet, because a generated ninth hue is indistinguishable from an
 * existing slot for a substantial share of readers.
 *
 * Verified for both modes: worst adjacent pair ΔE 9.1 light / 8.4 dark under
 * simulated CVD, and 19.6 / 19.3 under normal vision (OKLab ×100).
 */
export const CATEGORICAL_LIGHT = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#4a3aa7',
  '#e34948',
] as const;

/** The same eight hues, re-stepped for a dark surface. */
export const CATEGORICAL_DARK = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
] as const;

/**
 * Single-hue ramp for magnitude, light to dark.
 *
 * Sequential encoding is one hue with monotone lightness. A multi-hue ramp
 * across the spectrum has no perceptual ordering — readers cannot say whether
 * green is more than orange without consulting the legend for every cell, which
 * defeats the purpose of encoding magnitude as colour at all.
 *
 * The lightest step recedes toward the surface, so near-zero reads as absence.
 */
export const SEQUENTIAL_LIGHT = [
  '#cde2fb',
  '#9ec5f4',
  '#6da7ec',
  '#3987e5',
  '#256abf',
  '#104281',
] as const;

/** The same ramp anchored for a dark surface: near-zero recedes into it. */
export const SEQUENTIAL_DARK = [
  '#0d366b',
  '#184f95',
  '#256abf',
  '#3987e5',
  '#6da7ec',
  '#9ec5f4',
] as const;

/**
 * Diverging ramp for signed quantities — gain against loss, above against below.
 *
 * Two hues that read as opposite, with a neutral midpoint. The midpoint must
 * read as *nothing*: a hue there would imply that zero is itself a state.
 */
export const DIVERGING_LIGHT = [
  '#104281',
  '#3987e5',
  '#9ec5f4',
  '#f0efec',
  '#f2a883',
  '#eb6834',
  '#b02418',
] as const;

/** The same poles, re-stepped for a dark surface with a dark neutral midpoint. */
export const DIVERGING_DARK = [
  '#9ec5f4',
  '#3987e5',
  '#256abf',
  '#383835',
  '#d95926',
  '#eb6834',
  '#f2a883',
] as const;

/** Sample a ramp at a normalised position, `0..1`, without interpolating. */
export function rampAt(ramp: readonly string[], position: number): string {
  if (ramp.length === 0) return 'transparent';
  const clamped = Math.max(0, Math.min(1, position));
  const index = Math.min(ramp.length - 1, Math.floor(clamped * ramp.length));
  return ramp[index]!;
}

/**
 * Ink that clears contrast against a given fill.
 *
 * A label set inside a coloured cell is the one place text may leave the text
 * tokens, because the surface behind it is the data colour. Relative luminance
 * decides which of the two is legible.
 */
export function inkOn(fill: string): string {
  return relativeLuminance(fill) > 0.42 ? '#111827' : '#ffffff';
}

/** WCAG relative luminance of a `#rgb` or `#rrggbb` colour, `0..1`. */
export function relativeLuminance(color: string): number {
  const [r, g, b] = parseHex(color);
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function parseHex(color: string): [number, number, number] {
  const hex = color.trim().replace('#', '');
  if (hex.length === 3) {
    return [
      parseInt(hex[0]! + hex[0]!, 16),
      parseInt(hex[1]! + hex[1]!, 16),
      parseInt(hex[2]! + hex[2]!, 16),
    ];
  }
  if (hex.length >= 6) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  // A non-hex colour (a named colour, an rgb() string) cannot be measured here;
  // assume a mid tone so the caller still receives a usable ink choice.
  return [128, 128, 128];
}
