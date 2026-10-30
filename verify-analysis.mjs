/**
 * Correctness checks for the analysis packages.
 *
 * `smoke.mjs` and `smoke-docs.mjs` establish that components render; this
 * establishes that the numbers they render are right. Every assertion is an
 * invariant that must hold for any input — area conservation across a transition
 * matrix, a recovered slope on an exact fit, the sign of Gi* over a known
 * cluster — rather than a comparison against a recorded output.
 *
 * Runs against the built ESM entry points, so it also verifies that each
 * package's public surface exports what it claims to.
 *
 *   npm run build && node verify-analysis.mjs
 */
import {
  rowAreasKm2, boundsAreaKm2, classAreas, transitionMatrix, netChange,
  topTransitions, persistenceRate, changeMask, colorizeClassified,
} from './packages/classified-raster/dist/index.js';
import {
  spatialWeights, getisOrdGiStar, kernelDensity, suggestBandwidthKm, twoTailedP,
} from './packages/hotspot-analysis/dist/index.js';
import {
  linearTrend, projectSeries, movingAverage, compoundGrowthRate, niceTicks, niceDomain,
} from './packages/geo-charts/dist/index.js';

let failures = 0;
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
function check(name, ok, detail = '') {
  if (ok) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}  ${detail}`); }
}

const TABLE = [
  { value: 1, label: 'Water', color: '#419BDF' },
  { value: 2, label: 'Trees', color: '#397D49' },
  { value: 5, label: 'Crops', color: '#E49635' },
  { value: 7, label: 'Built', color: '#C4281B' },
];

console.log('\n— area weighting —');
{
  const bounds = [0, 0, 10, 10];
  const rows = rowAreasKm2(bounds, 10, 10);
  const summed = Array.from(rows).reduce((s, a) => s + a * 10, 0);
  check('row areas sum to the closed-form extent area',
    near(summed, boundsAreaKm2(bounds), 1e-9), `${summed} vs ${boundsAreaKm2(bounds)}`);

  // A degree cell at the equator is larger than one at 60°N by ~1/cos(60°) = 2.
  const equator = rowAreasKm2([0, -0.5, 1, 0.5], 1, 1)[0];
  const high = rowAreasKm2([0, 59.5, 1, 60.5], 1, 1)[0];
  check('latitude weighting halves cell area at 60°N', near(equator / high, 2, 2e-3),
    `ratio ${(equator / high).toFixed(4)}`);
  check('equatorial 1° cell ≈ 12363 km²', Math.abs(equator - 12363) < 5, `${equator.toFixed(1)}`);
}

console.log('\n— class areas —');
const gridA = {
  data: Float32Array.from([1, 1, 2, 2, 2, 5, 5, 7, -9]),
  width: 3, height: 3, bounds: [0, 0, 3, 3], noData: -9,
};
{
  const result = classAreas(gridA, TABLE);
  const sum = result.classes.reduce((s, c) => s + c.fraction, 0);
  check('fractions sum to 1', near(sum, 1), String(sum));
  check('cell counts correct',
    JSON.stringify(result.classes.map(c => c.cells)) === '[2,3,2,1]',
    JSON.stringify(result.classes.map(c => c.cells)));
  check('NoData excluded', result.unclassifiedCells === 1 && result.classifiedCells === 8);
  check('area totals match the sum of class areas',
    near(result.totalAreaKm2, result.classes.reduce((s, c) => s + c.areaKm2, 0)));
}

console.log('\n— transition matrix —');
const gridB = {
  data: Float32Array.from([1, 2, 2, 7, 2, 5, 7, 7, -9]),
  width: 3, height: 3, bounds: [0, 0, 3, 3], noData: -9,
};
{
  const m = transitionMatrix(gridA, gridB, TABLE);
  const rowSums = m.areaKm2.map(r => r.reduce((s, v) => s + v, 0));
  const colSums = TABLE.map((_, j) => m.areaKm2.reduce((s, r) => s + r[j], 0));
  const fromAreas = classAreas(gridA, TABLE).classes.map(c => c.areaKm2);
  const toAreas = classAreas(gridB, TABLE).classes.map(c => c.areaKm2);

  check('compared + excluded = all cells', m.comparedCells + m.excludedCells === 9);
  check('unchanged + changed = total', near(m.unchangedAreaKm2 + m.changedAreaKm2, m.totalAreaKm2));

  const nc = netChange(m);
  check('net = to − from for every class',
    nc.every(c => near(c.netKm2, c.toAreaKm2 - c.fromAreaKm2)));
  check('net changes sum to zero (area is conserved)',
    near(nc.reduce((s, c) => s + c.netKm2, 0), 0, 1e-9));
  check('row sums equal per-class from-areas', rowSums.every((v, i) => near(v, nc[i].fromAreaKm2)));
  check('column sums equal per-class to-areas', colSums.every((v, i) => near(v, nc[i].toAreaKm2)));
  // Both grids share one NoData cell, so from/to areas match a direct count.
  check('matrix from-areas agree with classAreas', rowSums.every((v, i) => near(v, fromAreas[i], 1e-9)));
  check('matrix to-areas agree with classAreas', colSums.every((v, i) => near(v, toAreas[i], 1e-9)));

  const top = topTransitions(m, 5);
  check('top transitions exclude the diagonal', top.every(t => t.from.value !== t.to.value));
  check('top transitions are ordered by area',
    top.every((t, i) => i === 0 || top[i - 1].areaKm2 >= t.areaKm2));
  check('persistence rate in 0..1', persistenceRate(m) >= 0 && persistenceRate(m) <= 1);

  let threw = false;
  try { transitionMatrix(gridA, { ...gridB, bounds: [1, 1, 4, 4] }, TABLE); } catch { threw = true; }
  check('mismatched extents rejected', threw);
}

console.log('\n— change mask —');
{
  const mask = changeMask(gridA, gridB, TABLE);
  const changed = Array.from(mask.data).filter(v => v === 1).length;
  const same = Array.from(mask.data).filter(v => v === 0).length;
  check('mask counts match the matrix diagonal', same === 5 && changed === 3, `${same}/${changed}`);
  check('mask marks the shared NoData cell', mask.data[8] === -1);
}

console.log('\n— colourisation —');
{
  const out = colorizeClassified(gridA, TABLE, { maxDimension: 3 });
  check('uncoded and NoData cells stay transparent', out.pixels[8 * 4 + 3] === 0);
  check('water cell carries its exact class colour',
    out.pixels[0] === 0x41 && out.pixels[1] === 0x9b && out.pixels[2] === 0xdf && out.pixels[3] === 255);
  check('unclassified count reported', out.unclassifiedCells === 1);
  const up = colorizeClassified(gridA, TABLE, { maxDimension: 12 });
  check('upsampling replicates whole cells', up.width === 12 && up.height === 12);
}

console.log('\n— least squares —');
{
  // y = 3x + 1 exactly.
  const exact = [0, 1, 2, 3, 4].map(x => ({ x, y: 3 * x + 1 }));
  const t = linearTrend(exact);
  check('slope recovered', near(t.slope, 3));
  check('intercept recovered', near(t.intercept, 1));
  check('r² = 1 on an exact fit', near(t.r2, 1));
  check('residual standard error = 0 on an exact fit', near(t.residualStandardError, 0));

  const p = projectSeries(exact, { to: 7 });
  check('projection extends to the requested x',
    p.points.length === 3 && p.points[2].x === 7, JSON.stringify(p.points.map(q => q.x)));
  check('projected values follow the fit', near(p.points[2].y, 22));
  check('anchor carries the last observation', p.anchor.x === 4 && p.anchor.y === 13);

  // Noisy series: the band must widen with distance from x̄.
  const noisy = [0, 1, 2, 3, 4, 5].map(x => ({ x, y: 2 * x + (x % 2 ? 1.5 : -1.5) }));
  const np = projectSeries(noisy, { to: 12, step: 1 });
  const widths = np.points.map(q => q.upper - q.lower);
  check('prediction band widens with extrapolation distance',
    widths.every((w, i) => i === 0 || w > widths[i - 1]));
  const clamped = projectSeries([{x:0,y:5},{x:1,y:2},{x:2,y:1}], { to: 6, clamp: [0, Infinity] });
  check('clamp holds the projection non-negative', clamped.points.every(q => q.y >= 0 && q.lower >= 0));

  check('moving average preserves length and span',
    movingAverage(noisy, 3).length === noisy.length);
  check('CAGR of a doubling over 10 periods ≈ 7.18%',
    near(compoundGrowthRate([{ x: 0, y: 100 }, { x: 10, y: 200 }]), 2 ** 0.1 - 1, 1e-9));
  check('CAGR undefined from a zero base',
    compoundGrowthRate([{ x: 0, y: 0 }, { x: 1, y: 5 }]) === null);
}

console.log('\n— axis ticks —');
{
  check('ticks are round', JSON.stringify(niceTicks([0, 100], 5)) === '[0,20,40,60,80,100]',
    JSON.stringify(niceTicks([0, 100], 5)));
  check('domain includes zero for bars', niceDomain([12, 48, 30])[0] === 0);
  check('no floating-point drift in ticks', niceTicks([0, 1], 10).every(t => String(t).length <= 4));
}

console.log('\n— Getis-Ord Gi* —');
{
  // A tight cluster of high values, a tight cluster of low values, well separated.
  const hot = [[0, 0], [0.05, 0], [0, 0.05], [0.05, 0.05]];
  const cold = [[5, 5], [5.05, 5], [5, 5.05], [5.05, 5.05]];
  const positions = [...hot, ...cold];
  const values = [100, 98, 102, 99, 1, 2, 3, 2];

  const w = spatialWeights(positions, { bandwidthKm: 20 });
  check('weights are symmetric',
    w.neighbours.every((ns, i) => ns.every(j => i === j || w.neighbours[j].includes(i))));
  check('self is included for Gi*', w.neighbours.every((ns, i) => ns.includes(i)));

  const g = getisOrdGiStar(values, w);
  check('high-value cluster yields positive z', g.slice(0, 4).every(r => r.zScore > 1.6),
    g.slice(0, 4).map(r => r.zScore.toFixed(2)).join(','));
  check('low-value cluster yields negative z', g.slice(4).every(r => r.zScore < -1.6),
    g.slice(4).map(r => r.zScore.toFixed(2)).join(','));
  check('hot cluster classified hot', g.slice(0, 4).every(r => r.cluster.startsWith('hot')));
  check('cold cluster classified cold', g.slice(4).every(r => r.cluster.startsWith('cold')));

  // A uniform field has no clusters at all.
  const flat = getisOrdGiStar([5, 5, 5, 5, 5, 5, 5, 5], w);
  check('a uniform field produces no clusters',
    flat.every(r => r.cluster === 'not-significant' && r.zScore === 0));

  // FDR must be no less strict than the uncorrected thresholds.
  const corrected = getisOrdGiStar(values, w, { falseDiscoveryRate: true });
  const rank = { 'hot-99': 3, 'hot-95': 2, 'hot-90': 1, 'not-significant': 0,
                 'cold-90': 1, 'cold-95': 2, 'cold-99': 3 };
  check('FDR correction never loosens a classification',
    corrected.every((r, i) => rank[r.cluster] <= rank[g[i].cluster]));

  check('two-tailed p of z=1.96 ≈ 0.05', near(twoTailedP(1.96), 0.05, 2e-3), twoTailedP(1.96).toFixed(5));
  check('two-tailed p of z=0 = 1', near(twoTailedP(0), 1, 1.5e-7));

  const b = suggestBandwidthKm(positions);
  check('bandwidth suggestion is ordered',
    b.medianNearestKm <= b.p90NearestKm && b.p90NearestKm <= b.maxNearestKm);
}

console.log('\n— kernel density —');
{
  const points = [[0, 0], [0.1, 0.1], [0.05, 0.05], [3, 3]];
  const surface = kernelDensity(points, { bandwidthKm: 30, width: 40 });
  check('surface is a RasterData grid',
    surface.width === 40 && surface.height > 0 && surface.data.length === surface.width * surface.height);
  const valid = Array.from(surface.data).filter(v => v !== surface.noData);
  check('some cells are covered', valid.length > 0);
  check('density is non-negative', valid.every(v => v >= 0));
  check('uncovered cells are NoData, not zero',
    Array.from(surface.data).some(v => v === surface.noData));

  // The cluster of three must out-densify the lone point.
  const at = (lng, lat) => {
    const [w, s, e, n] = surface.bounds;
    const col = Math.floor(((lng - w) / (e - w)) * surface.width);
    const row = Math.floor(((n - lat) / (n - s)) * surface.height);
    return surface.data[row * surface.width + col];
  };
  check('the three-point cluster is denser than the isolated point', at(0.05, 0.05) > at(3, 3),
    `${at(0.05, 0.05)} vs ${at(3, 3)}`);
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASS' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
