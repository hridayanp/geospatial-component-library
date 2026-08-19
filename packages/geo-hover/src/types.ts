import type { GeoJsonFeature, LngLat } from '@hridayanp/geo-utils';

/** One label/value line in a hover card. */
export interface HoverRow {
  label: string;
  value: string | number | null | undefined;
  /** Suffix appended after the value — `'mm'`, `'kt'`, `'%'`. */
  unit?: string;
}

/** A titled group of rows, typically one per layer under the pointer. */
export interface HoverSection {
  title: string;
  subtitle?: string;
  /**
   * Any CSS colour for the section's dot and title. Using a colour rather than
   * a fixed set of names lets a host match its own palette or the layer's own
   * colour ramp.
   */
  accentColor?: string;
  rows: HoverRow[];
}

/** Where the pointer is, in both screen and geographic space. */
export interface HoverPosition {
  /** Page coordinates, ready to position a fixed-position card. */
  x: number;
  y: number;
  /** Geographic position under the pointer. */
  lngLat: LngLat;
}

/** Everything known about the current hover. */
export interface HoverState extends HoverPosition {
  /** Features under the pointer, topmost first. Empty for a raster-only probe. */
  features: GeoJsonFeature[];
  /** Raster value under the pointer, when a raster was supplied. */
  value?: number | null;
}
