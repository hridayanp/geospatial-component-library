# @hridayanp/hotspot-analysis

Spatial cluster detection: Getis-Ord Gi\* over discrete observations, and kernel
density estimation onto a continuous surface.

Every export is a pure function over plain data. No React, no map dependency —
results come back in the shapes the rendering packages already accept.

## Installation

```bash
npm install @hridayanp/hotspot-analysis
```

## What Gi\* answers

For each observation: are the values in its neighbourhood higher — or lower —
than a random arrangement of the same values would produce?

A large positive z-score means an observation is surrounded by high values: a
**hot spot**. A large negative one means the opposite: a **cold spot**.

The distinction that matters: **a high value is not a hot spot.** An isolated
maximum surrounded by low values is an outlier, and Gi\* will not flag it. A hot
spot is a *cluster*, and an observation of unremarkable magnitude can sit at the
centre of one.

## Usage

```ts
import {
  extractObservations,
  spatialWeights,
  getisOrdGiStar,
  toHotspotFeatures,
  hotspotLegendClasses,
  suggestBandwidthKm,
} from '@hridayanp/hotspot-analysis';

const { positions, values, features } = extractObservations(
  observations,
  ['incident_count', 'count'],
);

const weights = spatialWeights(positions, { bandwidthKm: 25 });
const results = getisOrdGiStar(values, weights, { falseDiscoveryRate: true });

const hotspots = toHotspotFeatures(features, results);
```

The result is an ordinary FeatureCollection carrying `gi_z_score`, `gi_p_value`,
`gi_cluster`, `gi_neighbours` and `gi_color`, so it renders through the existing
`VectorLayer`:

```tsx
<VectorLayer
  data={hotspots}
  pointColor={['get', 'gi_color']}
  pointRadius={['interpolate', ['linear'], ['abs', ['get', 'gi_z_score']], 0, 3, 4, 9]}
  hitRadius={12}
/>
<GeoLegend title="Cluster significance" classes={hotspotLegendClasses()} />
```

## Choosing a bandwidth

There is no universally correct distance band. Too small and most observations
have no neighbours, so every statistic is undefined; too large and the local
statistic converges on the global mean and every cluster disappears. **The same
data yields different clusters at different scales, and neither is wrong** —
report the bandwidth alongside the map.

```ts
suggestBandwidthKm(positions);
// { maxNearestKm, medianNearestKm, p90NearestKm }
```

`maxNearestKm` is the smallest band that leaves no observation isolated. It is a
floor, not a recommendation: driven by the single most isolated observation, a
sparse periphery can inflate it well beyond the scale of the process.

Distances are great-circle throughout, so a band means the same thing at every
latitude. A planar distance on Web Mercator coordinates would shrink the
effective band toward the equator and inflate it toward the poles, biasing where
clusters are detected.

## Multiple comparisons

A local statistic is computed once per observation, so at the conventional 5%
level roughly one observation in twenty is flagged by chance alone — a thousand
observations yield about fifty spurious hot spots.

```ts
getisOrdGiStar(values, weights, { falseDiscoveryRate: true });
```

The Benjamini-Hochberg correction adjusts the thresholds to control the expected
share of false positives among those reported. Enable it whenever the result will
be read as a map of real clusters.

## Kernel density

Where Gi\* asks whether values cluster, density asks where observations
concentrate.

```ts
import { kernelDensity, changeDensity } from '@hridayanp/hotspot-analysis';

const surface = kernelDensity(positions, {
  bandwidthKm: 25,
  kernel: 'quartic',
  weights: magnitudes,
});
```

The result is a `RasterData`, which `RasterLayer` renders directly:

```tsx
<RasterLayer data={surface} colorScale={heat} smoothFactor={4} />
```

Cells beyond the bandwidth of every observation are written as **NoData, not
zero** — an area with no observations is unobserved, not measured at zero, and
rendering the two identically overstates coverage.

`changeDensity` is the same computation over a `changeMask` from
`@hridayanp/classified-raster`, for locating where land-cover change concentrates
rather than where observations do.

## Performance

`spatialWeights` is O(n²) in observation count. For the few thousand points a
browser realistically analyses that is well under a second; a larger study is
better served by a spatially indexed implementation on the server. The weights
matrix is stored sparsely — a distance band over ten thousand observations is
almost entirely zeros, and the dense form would need hundreds of megabytes.

Kernel density costs O(cells × observations). Reduce `width` before reducing the
observation count: the surface is smooth, so a coarse grid loses very little.

## Colour

Hot and cold are opposite states either side of "no clustering", so the
symbology is **diverging**: warm for high-value clusters, cool for low-value
ones, a neutral midpoint for the not-significant band. Confidence is encoded as
lightness within each arm, so the three bands read as an ordered sequence.

`HOTSPOT_COLORS` and `hotspotLegendClasses()` expose it, and `toHotspotFeatures`
writes the resolved colour onto each feature so the map and the legend cannot
disagree.

## Geospatial considerations

- Positions are `[longitude, latitude]` in EPSG:4326.
- Gi\* is defined over discrete observations at locations. Reduce polygons to
  representative points with `geometryAnchor` from `@hridayanp/geo-utils` first —
  doing it explicitly keeps that choice visible rather than hidden inside the
  statistic.
- Values must be finite. Filter or impute absent observations before analysis
  rather than letting a sentinel enter the mean.

## Documentation

Interactive examples live in the workspace Storybook:

```bash
npm run storybook
```

## License

MIT
