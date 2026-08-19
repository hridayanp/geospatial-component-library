import type { ReactNode } from 'react';
import type { RasterData } from '@hridayanp/raster-utils';
import { GeoHoverCard } from './GeoHoverCard';
import { useMapHover } from './hooks';
import type { HoverSection, HoverState } from './types';

export interface GeoHoverProps {
  /** Layers to pick features from. Omit for a raster-only probe. */
  layerIds?: string[];
  /** Raster to read a value from at the pointer. */
  raster?: RasterData | null;
  /** `'nearest'` (default) or `'bilinear'` value sampling. */
  sampling?: 'nearest' | 'bilinear';
  /** Turn hovering off without unmounting. Default `true`. */
  enabled?: boolean;
  /**
   * Turn the raw hover state into card sections.
   *
   * This is where domain knowledge belongs — which properties matter, what to
   * call them, what units they are in. Returning an empty array suppresses the
   * card for that hover.
   */
  sections?: (state: HoverState) => HoverSection[];
  /** Render the card body yourself instead of the default rows. */
  render?: (sections: HoverSection[], state: HoverState) => ReactNode;
  /** Fired on every hover change, including `null` when leaving. */
  onHoverChange?: (state: HoverState | null) => void;
  /** Title used by the default `sections` builder. Default `'Value'`. */
  title?: string;
  /** Unit appended to the probed raster value by the default builder. */
  unit?: string;
  className?: string;
}

/**
 * A drop-in hover readout: pick, probe, and render a tooltip.
 *
 * The default section builder shows the coordinate and, when a raster is
 * supplied, its value — deliberately generic. Pass `sections` to describe your
 * own data; that function is the one place the library expects domain
 * knowledge, and it lives in your application rather than in the package.
 *
 * @example
 * ```tsx
 * <GeoHover
 *   layerIds={['stations-point']}
 *   raster={raster}
 *   unit="mm"
 *   sections={(state) => [
 *     {
 *       title: 'Station',
 *       accentColor: '#38bdf8',
 *       rows: Object.entries(state.features[0]?.properties ?? {}).map(
 *         ([label, value]) => ({ label, value: String(value) }),
 *       ),
 *     },
 *   ]}
 * />
 * ```
 */
export function GeoHover({
  layerIds,
  raster,
  sampling = 'nearest',
  enabled = true,
  sections,
  render,
  onHoverChange,
  title = 'Value',
  unit,
  className,
}: GeoHoverProps) {
  const state = useMapHover({
    ...(layerIds ? { layerIds } : {}),
    raster: raster ?? null,
    sampling,
    enabled,
  });

  onHoverChange?.(state);

  if (!state) return null;

  const built = sections
    ? sections(state)
    : defaultSections(state, title, unit);

  if (built.length === 0) return null;

  return (
    <GeoHoverCard
      x={state.x}
      y={state.y}
      sections={built}
      {...(render ? { render: (s: HoverSection[]) => render(s, state) } : {})}
      {...(className ? { className } : {})}
    />
  );
}

function defaultSections(
  state: HoverState,
  title: string,
  unit?: string,
): HoverSection[] {
  const rows: HoverSection['rows'] = [];

  if (state.value != null && !Number.isNaN(state.value)) {
    rows.push({ label: title, value: state.value, ...(unit ? { unit } : {}) });
  }

  const properties = state.features[0]?.properties;
  if (properties) {
    for (const [key, value] of Object.entries(properties)) {
      if (value == null || typeof value === 'object') continue;
      rows.push({ label: key, value: value as string | number });
      // A raw property dump is a starting point, not a design — cap it so an
      // unexpected 40-property feature does not fill the screen.
      if (rows.length >= 8) break;
    }
  }

  rows.push({
    label: 'Position',
    value: `${state.lngLat[1].toFixed(3)}, ${state.lngLat[0].toFixed(3)}`,
  });

  return [{ title, rows }];
}
