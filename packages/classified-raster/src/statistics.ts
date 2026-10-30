import type { RasterData } from '@hridayanp/raster-utils';
import { rowAreasKm2 } from './area';
import {
  buildClassIndex,
  type ClassDefinition,
  type ClassTable,
} from './classes';

/** Area and cell count occupied by one class. */
export interface ClassArea {
  value: number;
  label: string;
  color: string;
  /** Cells assigned to this class. */
  cells: number;
  /** Latitude-weighted area in square kilometres. */
  areaKm2: number;
  /** Share of the classified area, `0..1`. */
  fraction: number;
}

/** Result of {@link classAreas}. */
export interface ClassAreaResult {
  classes: ClassArea[];
  /** Cells carrying a code present in the table. */
  classifiedCells: number;
  /** Cells holding NoData, a non-finite value, or an uncoded value. */
  unclassifiedCells: number;
  /** Total classified area in square kilometres. */
  totalAreaKm2: number;
}

export interface ClassAreaOptions {
  /**
   * Retain classes with no cells. Default `true`.
   *
   * A composition chart that silently drops empty classes changes shape between
   * frames of a time series, which reads as data appearing and disappearing.
   */
  includeEmpty?: boolean;
}

/**
 * Cell counts and latitude-weighted areas per class.
 *
 * Cells matching the raster's `noData` sentinel, holding a non-finite value, or
 * carrying a code absent from the table are excluded from every total and
 * reported as `unclassifiedCells`. Excluding them rather than assigning them to
 * a residual class keeps `fraction` a share of the *classified* area, which is
 * the quantity a composition chart should sum to one over.
 */
export function classAreas(
  raster: RasterData,
  table: ClassTable,
  options: ClassAreaOptions = {},
): ClassAreaResult {
  const { includeEmpty = true } = options;
  const { data, width, height, bounds, noData } = raster;

  const index = buildClassIndex(table);
  const rowArea = rowAreasKm2(bounds, width, height);

  const cellCounts = new Map<number, number>();
  const areaTotals = new Map<number, number>();
  let classifiedCells = 0;
  let unclassifiedCells = 0;
  let totalAreaKm2 = 0;

  for (let row = 0; row < height; row++) {
    const area = rowArea[row] ?? 0;
    const offset = row * width;
    for (let column = 0; column < width; column++) {
      const raw = Number(data[offset + column]);
      if (!Number.isFinite(raw) || (noData != null && raw === noData)) {
        unclassifiedCells += 1;
        continue;
      }
      const code = Math.round(raw);
      if (!index.has(code)) {
        unclassifiedCells += 1;
        continue;
      }
      cellCounts.set(code, (cellCounts.get(code) ?? 0) + 1);
      areaTotals.set(code, (areaTotals.get(code) ?? 0) + area);
      classifiedCells += 1;
      totalAreaKm2 += area;
    }
  }

  const classes: ClassArea[] = [];
  for (const definition of table) {
    const cells = cellCounts.get(definition.value) ?? 0;
    if (cells === 0 && !includeEmpty) continue;
    const areaKm2 = areaTotals.get(definition.value) ?? 0;
    classes.push({
      value: definition.value,
      label: definition.label,
      color: definition.color,
      cells,
      areaKm2,
      fraction: totalAreaKm2 > 0 ? areaKm2 / totalAreaKm2 : 0,
    });
  }

  return { classes, classifiedCells, unclassifiedCells, totalAreaKm2 };
}

/** A class-to-class transition between two epochs. */
export interface Transition {
  from: ClassDefinition;
  to: ClassDefinition;
  cells: number;
  areaKm2: number;
  /** Share of all changed area, `0..1`. Unchanged cells are excluded. */
  fraction: number;
}

/** Result of {@link transitionMatrix}. */
export interface TransitionMatrixResult {
  /** Classes in table order; both axes of the matrix use this order. */
  classes: ClassDefinition[];
  /** `cells[from][to]` — cell counts, indexed into {@link classes}. */
  cells: number[][];
  /** `areaKm2[from][to]` — latitude-weighted areas, same indexing. */
  areaKm2: number[][];
  /** Cells classified in both epochs. */
  comparedCells: number;
  /** Cells excluded because either epoch was NoData or uncoded. */
  excludedCells: number;
  totalAreaKm2: number;
  /** Area on the diagonal — classified identically in both epochs. */
  unchangedAreaKm2: number;
  /** Area off the diagonal. */
  changedAreaKm2: number;
}

export interface TransitionMatrixOptions {
  /**
   * Permit grids whose extents differ. Default `false`.
   *
   * A cross-tabulation is only meaningful when cell *i* of both epochs covers
   * the same ground. Two grids of identical dimensions over different extents
   * would produce a matrix that looks correct and means nothing, so the mismatch
   * is an error by default.
   */
  allowMismatchedBounds?: boolean;
}

const BOUNDS_TOLERANCE = 1e-9;

/**
 * Cross-tabulate two classified rasters of the same grid.
 *
 * The result is a change matrix: `cells[i][j]` counts cells classified as
 * `classes[i]` in the first epoch and `classes[j]` in the second. The diagonal
 * is persistence; everything off it is conversion.
 *
 * A cell is counted only when **both** epochs classify it. Excluding
 * partially-observed cells rather than treating an absence as a class is what
 * keeps a matrix from reporting cloud gaps as land-cover change — the most
 * common way a change statistic becomes wrong while remaining plausible.
 *
 * @throws when the grids differ in dimensions, or in extent unless
 * `allowMismatchedBounds` is set.
 */
export function transitionMatrix(
  from: RasterData,
  to: RasterData,
  table: ClassTable,
  options: TransitionMatrixOptions = {},
): TransitionMatrixResult {
  const { allowMismatchedBounds = false } = options;

  if (from.width !== to.width || from.height !== to.height) {
    throw new Error(
      `[gcl] transitionMatrix requires matching grid dimensions (${from.width}×${from.height} vs ${to.width}×${to.height}). Resample one epoch onto the other's grid first.`,
    );
  }
  if (!allowMismatchedBounds) {
    const drift = from.bounds.some(
      (value, i) => Math.abs(value - to.bounds[i]!) > BOUNDS_TOLERANCE,
    );
    if (drift) {
      throw new Error(
        `[gcl] transitionMatrix requires matching extents ([${from.bounds.join(', ')}] vs [${to.bounds.join(', ')}]). Pass allowMismatchedBounds to override.`,
      );
    }
  }

  const classes = [...table];
  const index = buildClassIndex(table);
  const position = new Map<number, number>();
  classes.forEach((definition, i) => position.set(definition.value, i));

  const size = classes.length;
  const cells: number[][] = Array.from({ length: size }, () =>
    new Array<number>(size).fill(0),
  );
  const areaKm2: number[][] = Array.from({ length: size }, () =>
    new Array<number>(size).fill(0),
  );

  const rowArea = rowAreasKm2(from.bounds, from.width, from.height);
  let comparedCells = 0;
  let excludedCells = 0;
  let totalAreaKm2 = 0;
  let unchangedAreaKm2 = 0;

  const resolve = (raster: RasterData, i: number): number | undefined => {
    const raw = Number(raster.data[i]);
    if (!Number.isFinite(raw)) return undefined;
    if (raster.noData != null && raw === raster.noData) return undefined;
    const code = Math.round(raw);
    return index.has(code) ? position.get(code) : undefined;
  };

  for (let row = 0; row < from.height; row++) {
    const area = rowArea[row] ?? 0;
    const offset = row * from.width;
    for (let column = 0; column < from.width; column++) {
      const i = offset + column;
      const a = resolve(from, i);
      const b = resolve(to, i);
      if (a === undefined || b === undefined) {
        excludedCells += 1;
        continue;
      }
      cells[a]![b] += 1;
      areaKm2[a]![b] += area;
      comparedCells += 1;
      totalAreaKm2 += area;
      if (a === b) unchangedAreaKm2 += area;
    }
  }

  return {
    classes,
    cells,
    areaKm2,
    comparedCells,
    excludedCells,
    totalAreaKm2,
    unchangedAreaKm2,
    changedAreaKm2: totalAreaKm2 - unchangedAreaKm2,
  };
}

/** Gain, loss and net change for one class between two epochs. */
export interface NetChange {
  class: ClassDefinition;
  /** Area of this class in the first epoch. */
  fromAreaKm2: number;
  /** Area of this class in the second epoch. */
  toAreaKm2: number;
  /** Area converted **into** this class from others. */
  gainKm2: number;
  /** Area converted **out of** this class into others. */
  lossKm2: number;
  /** `gainKm2 − lossKm2`; equivalently `toAreaKm2 − fromAreaKm2`. */
  netKm2: number;
  /** Net change as a share of the first epoch's area, or `null` when it was zero. */
  netFraction: number | null;
}

/**
 * Per-class gain, loss and net change, derived from a transition matrix.
 *
 * Gain and loss are reported separately because they are separate processes: a
 * class can be stable in net terms while a large area of it is converted and an
 * equal area gained elsewhere. Reporting only the net would present that as no
 * change at all.
 */
export function netChange(matrix: TransitionMatrixResult): NetChange[] {
  const { classes, areaKm2 } = matrix;
  return classes.map((definition, i) => {
    let fromArea = 0;
    let toArea = 0;
    let gain = 0;
    let loss = 0;

    for (let j = 0; j < classes.length; j++) {
      const out = areaKm2[i]![j] ?? 0;
      const into = areaKm2[j]![i] ?? 0;
      fromArea += out;
      toArea += into;
      if (i !== j) {
        loss += out;
        gain += into;
      }
    }

    return {
      class: definition,
      fromAreaKm2: fromArea,
      toAreaKm2: toArea,
      gainKm2: gain,
      lossKm2: loss,
      netKm2: gain - loss,
      netFraction: fromArea > 0 ? (gain - loss) / fromArea : null,
    };
  });
}

/**
 * The largest class-to-class conversions, excluding persistence.
 *
 * The diagonal of a change matrix usually holds most of the area, so ranking
 * transitions without excluding it returns "water stayed water" as the headline
 * finding.
 *
 * @param limit Maximum transitions to return. Default `10`.
 */
export function topTransitions(
  matrix: TransitionMatrixResult,
  limit = 10,
): Transition[] {
  const { classes, cells, areaKm2, changedAreaKm2 } = matrix;
  const transitions: Transition[] = [];

  for (let i = 0; i < classes.length; i++) {
    for (let j = 0; j < classes.length; j++) {
      if (i === j) continue;
      const area = areaKm2[i]![j] ?? 0;
      if (area <= 0) continue;
      transitions.push({
        from: classes[i]!,
        to: classes[j]!,
        cells: cells[i]![j] ?? 0,
        areaKm2: area,
        fraction: changedAreaKm2 > 0 ? area / changedAreaKm2 : 0,
      });
    }
  }

  transitions.sort((a, b) => b.areaKm2 - a.areaKm2);
  return transitions.slice(0, limit);
}

/**
 * Overall agreement between two epochs, `0..1`.
 *
 * The share of compared area on the matrix diagonal. Useful as a sanity check
 * before interpreting a change map: an agreement far below what the interval
 * plausibly supports usually indicates misregistration or a classifier
 * difference rather than change on the ground.
 */
export function persistenceRate(matrix: TransitionMatrixResult): number {
  return matrix.totalAreaKm2 > 0
    ? matrix.unchangedAreaKm2 / matrix.totalAreaKm2
    : 0;
}
