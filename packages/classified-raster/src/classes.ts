import type { ColorScale } from '@hridayanp/raster-utils';

/**
 * One class in a classified raster's coding scheme.
 *
 * A classified (categorical) raster stores an integer code per cell rather than
 * a measured quantity. The code is meaningless without the table that maps it to
 * a label and a colour — land-cover code `2` is "Trees" only because the
 * producer says so, and the same code means something else in another product.
 */
export interface ClassDefinition {
  /** Integer cell value this class occupies. */
  value: number;
  /** Human-readable class name, as published by the data producer. */
  label: string;
  /** CSS colour used for this class, on the map and in every chart of it. */
  color: string;
  /** Optional longer definition, for a legend tooltip or a data dictionary. */
  description?: string;
}

/**
 * The complete coding scheme for a classified raster.
 *
 * Order is presentation order: legends, composition charts and transition
 * matrices all render classes in the order given here, so a table ordered
 * water → vegetation → agriculture → built reads as a gradient of human
 * modification rather than as an arbitrary sequence.
 */
export type ClassTable = readonly ClassDefinition[];

/** Fast integer-code lookup built once from a table. */
export type ClassIndex = ReadonlyMap<number, ClassDefinition>;

/**
 * Build a code → class lookup.
 *
 * Classified rasters are read cell by cell, so the linear scan a bare array
 * would require is the difference between a colourisation that runs in
 * milliseconds and one that does not.
 *
 * @throws if two entries declare the same `value`, which would make the mapping
 * ambiguous and silently drop one class from every statistic.
 */
export function buildClassIndex(table: ClassTable): ClassIndex {
  const index = new Map<number, ClassDefinition>();
  for (const definition of table) {
    if (!Number.isInteger(definition.value)) {
      throw new Error(
        `[gcl] Class "${definition.label}" has a non-integer value (${definition.value}). Classified rasters store integer codes.`,
      );
    }
    if (index.has(definition.value)) {
      throw new Error(
        `[gcl] Duplicate class value ${definition.value} ("${index.get(definition.value)?.label}" and "${definition.label}").`,
      );
    }
    index.set(definition.value, definition);
  }
  return index;
}

/** Resolve a cell value to its class, or `undefined` when it is not coded. */
export function classAt(
  index: ClassIndex,
  value: number | undefined | null,
): ClassDefinition | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return index.get(Math.round(value));
}

/**
 * Legend entries for `GeoLegend`'s `classes` prop.
 *
 * Keeping the map and its key on one table is what stops the two from drifting
 * apart — a legend that disagrees with the raster is worse than no legend.
 *
 * ```tsx
 * <GeoLegend title="Land cover" classes={classTableToLegendClasses(LAND_COVER)} />
 * ```
 */
export function classTableToLegendClasses(
  table: ClassTable,
): Array<{ color: string; label: string }> {
  return table.map(({ color, label }) => ({ color, label }));
}

/**
 * A discrete `ColorScale` positioned at the table's own class codes.
 *
 * Provided for callers who want `RasterLayer` to perform its own colourisation
 * rather than supplying a pre-rendered image.
 *
 * > **Note:** a discrete scale snaps to the nearest stop *below* the value, so a
 * > cell holding a code absent from the table adopts the preceding class's
 * > colour instead of rendering transparent. Where the coding scheme has gaps —
 * > and most published schemes do — prefer {@link colorizeClassified}, which
 * > performs an exact lookup and leaves uncoded cells transparent.
 */
export function classifiedColorScale(table: ClassTable): ColorScale {
  const sorted = [...table].sort((a, b) => a.value - b.value);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) {
    throw new Error('[gcl] classifiedColorScale requires a non-empty table.');
  }

  const span = last.value - first.value || 1;
  return {
    stops: sorted.map(
      (definition) =>
        [(definition.value - first.value) / span, definition.color] as [
          number,
          string,
        ],
    ),
    mode: 'discrete',
    interpolation: 'rgb',
  };
}

/** Value domain a {@link classifiedColorScale} must be stretched across. */
export function classifiedDomain(table: ClassTable): [number, number] {
  const values = table.map((definition) => definition.value);
  return [Math.min(...values), Math.max(...values)];
}

/**
 * A stable cache identity for a table.
 *
 * Colourised frames are cached by key, and a table edited in place would
 * otherwise serve a stale image. Derived from the codes and colours only —
 * relabelling a class does not change a pixel.
 */
export function classTableKey(table: ClassTable): string {
  return table
    .map((definition) => `${definition.value}:${definition.color}`)
    .join('|');
}
