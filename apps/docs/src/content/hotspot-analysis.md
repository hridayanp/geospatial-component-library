## Purpose

`hotspot-analysis` answers the question a point map cannot: *is this concentration
real, or is it what randomness looks like.* It provides the Getis-Ord Gi\* local
statistic for detecting statistically significant clusters of high and low values,
and kernel density estimation for turning discrete observations into a continuous
intensity surface.

```bash
npm install @hridayanp/hotspot-analysis
```

Every export is a pure function over plain data. No React and no map dependency,
so the package runs in a web worker and returns GeoJSON and `RasterData` that the
existing [`vector-layer`](/docs/vector-layer) and
[`raster-layer`](/docs/raster-layer) render — no layer of its own is required.

## Responsibilities

| Concern | Owner |
| --- | --- |
| Distance-band spatial weights | `spatialWeights` |
| The Gi\* statistic, its p-values and significance bands | `getisOrdGiStar` |
| Multiple-comparison correction | `getisOrdGiStar`, `falseDiscoveryRate` |
| Continuous intensity from discrete points | `kernelDensity` |
| Confidence-band symbology and legend entries | `HOTSPOT_COLORS`, `hotspotLegendClasses` |
| Choosing the bandwidth | Host application, informed by `suggestBandwidthKm` |
| Reducing polygons to representative points | Host application, via `geometryAnchor` |
| Rendering the result | `vector-layer` / `raster-layer` |

## What Gi\* measures

For each observation, Gi\* asks whether the values in its neighbourhood sum to
more than would be expected if the same values were distributed at random across
the study area:

```text
         Σⱼ wᵢⱼ xⱼ − X̄ Σⱼ wᵢⱼ
Gi*ᵢ = ─────────────────────────────────────────
       S √[ (n Σⱼ wᵢⱼ² − (Σⱼ wᵢⱼ)²) / (n − 1) ]
```

`X̄` and `S` are the global mean and population standard deviation of the values,
and `wᵢⱼ` is the spatial weight between observations *i* and *j*.

> **Note:** a high value is not a hot spot. An isolated maximum surrounded by low
> values is an outlier, and Gi\* will not flag it. A hot spot is a **cluster**,
> and an observation of unremarkable magnitude can sit at the centre of one. This
> is the distinction that makes the statistic worth computing rather than simply
> shading the top decile.

The `*` denotes self-inclusion: the observation is a member of its own
neighbourhood. Without it the statistic describes the ring around a location
rather than the location itself, and a cluster centred on a single observation is
missed.

## Spatial weights

```ts
import { spatialWeights, suggestBandwidthKm } from '@hridayanp/hotspot-analysis';

const spacing = suggestBandwidthKm(positions);
const weights = spatialWeights(positions, {
  bandwidthKm: spacing.p90NearestKm,
  scheme: 'binary',
});
```

| Option | Type | Default | Behaviour |
| --- | --- | --- | --- |
| `bandwidthKm` | `number` | — | Distance band; observations further apart are unweighted neighbours |
| `scheme` | `'binary' \| 'linear' \| 'gaussian'` | `'binary'` | Distance decay inside the band |
| `includeSelf` | `boolean` | `true` | Gi\* requires `true`; `false` computes plain Gi |

`binary` weights everything inside the band equally and is the Getis-Ord
convention. `linear` decays as `1 − d/bandwidth`, `gaussian` as
`exp(−(d/bandwidth)²)` truncated at the band.

Distances are great-circle, so a band means the same thing at every latitude. A
planar distance on Web Mercator coordinates would shrink the effective band
toward the equator and inflate it toward the poles — biasing not the precision of
the result but *where clusters are found*.

### Choosing the bandwidth

There is no universally correct value, and the choice is the single largest
determinant of the result. Too small and most observations have no neighbours, so
the statistic is undefined; too large and every local neighbourhood approaches
the global mean and all clustering disappears.

`suggestBandwidthKm` reports three quantities over nearest-neighbour distances:

| Field | Meaning |
| --- | --- |
| `maxNearestKm` | Smallest band at which no observation is isolated |
| `medianNearestKm` | Typical observation spacing |
| `p90NearestKm` | A common compromise between the two |

> **Warning:** `maxNearestKm` is a floor, not a recommendation. It is driven by
> the single most isolated observation, so a sparse periphery inflates it well
> beyond the scale of the process being studied. Prefer a band derived from that
> process where one exists, and report whichever you used alongside the map — the
> same data yields different clusters at different scales, and neither result is
> wrong.

The weights matrix is stored sparsely, as neighbour indices and weights per
observation. A distance band over ten thousand observations is almost entirely
zeros, and the dense *n* × *n* form would need several hundred megabytes to hold
them.

## Running the statistic

```ts
import {
  extractObservations,
  getisOrdGiStar,
  spatialWeights,
  toHotspotFeatures,
} from '@hridayanp/hotspot-analysis';

const { positions, values, features } = extractObservations(collection, [
  'intensity',
  'value',
]);

const weights = spatialWeights(positions, { bandwidthKm: 40 });
const results = getisOrdGiStar(values, weights, { falseDiscoveryRate: true });

const hotspots = toHotspotFeatures(features, results);
```

Each result carries:

| Field | Meaning |
| --- | --- |
| `index` | Position in the input array |
| `value` | The observation's own value |
| `zScore` | Standardised statistic; positive is a high-value cluster |
| `pValue` | Two-tailed, under the normal approximation |
| `neighbourCount` | Observations contributing, including self |
| `cluster` | Significance band |

`extractObservations` accepts an array of property aliases and takes the first
present, since feeds rarely agree on a name. Only `Point` geometry is extracted:
Gi\* is defined over discrete observations at locations, so a polygon must first
be reduced to a representative point with `geometryAnchor` from
[`geo-utils`](/docs/geo-utils). Doing that explicitly keeps the choice of
representative point visible rather than buried inside the statistic.

Non-finite values raise rather than being coerced. An absent observation is not a
zero, and treating it as one drags the global mean and manufactures cold spots
wherever data is missing.

### Multiple comparisons

A local statistic is computed once per observation. At the conventional 5% level
roughly one observation in twenty is flagged by chance alone — a thousand
observations produce about fifty spurious hot spots, in a map that looks entirely
credible.

`falseDiscoveryRate: true` applies the Benjamini-Hochberg procedure: for *m*
tests sorted ascending by p-value, the largest *k* satisfying `p₍k₎ ≤ k·α/m` sets
the effective threshold. The correction can only tighten a threshold, never loosen
one, so enabling it never adds clusters.

> **Note:** enable it whenever the result will be read as a map of real clusters
> rather than as exploratory shading. The uncorrected bands are appropriate for
> looking, not for reporting.

## Rendering the result

`toHotspotFeatures` writes the analysis onto the source features as ordinary
properties, so an existing `VectorLayer` renders it with a data-driven
expression:

```tsx
import { VectorLayer } from '@hridayanp/vector-layer';
import { GeoLegend } from '@hridayanp/geo-legend';
import { hotspotLegendClasses } from '@hridayanp/hotspot-analysis';

<VectorLayer
  data={hotspots}
  pointColor={['get', 'gi_color']}
  pointRadius={[
    'interpolate', ['linear'], ['abs', ['get', 'gi_z_score']],
    0, 3,
    4, 9,
  ]}
/>
<GeoLegend title="Cluster significance" classes={hotspotLegendClasses()} />
```

| Property | Type |
| --- | --- |
| `gi_z_score` | `number` |
| `gi_p_value` | `number` |
| `gi_cluster` | `HotspotClass` |
| `gi_neighbours` | `number` |
| `gi_color` | `string` |

The resolved colour is written as a property, not only the class name, so the
expression stays a plain `['get', …]` and the map cannot disagree with the legend.

### Symbology

`HOTSPOT_COLORS` is **diverging**, because hot and cold are opposite states
either side of "no clustering": a warm arm for high-value clusters, a cool arm
for low-value ones, and a neutral midpoint for observations that are not
significant. A single-hue ramp would imply an ordering that runs from cold to hot
through the middle, which is not what the statistic says.

| Band | Colour |
| --- | --- |
| `hot-99` / `hot-95` / `hot-90` | `#b02418` / `#eb6834` / `#f2a883` |
| `not-significant` | `#d8d7d2` |
| `cold-90` / `cold-95` / `cold-99` | `#9ec5f4` / `#3987e5` / `#184f95` |

Confidence is encoded as lightness within each arm, so the three bands read as an
ordered sequence rather than three unrelated colours.

`summarizeClusters` returns counts per band. The share that is *not* significant
is the number worth reading first: a result in which almost everything clusters
usually means the bandwidth is too large, and one in which almost nothing does
usually means it is too small.

## Kernel density

```ts
import { kernelDensity } from '@hridayanp/hotspot-analysis';

const surface = kernelDensity(positions, { bandwidthKm: 25, width: 320 });

<RasterLayer data={surface} colorScale={heat} smoothFactor={4} />
```

| Option | Default | Behaviour |
| --- | --- | --- |
| `bandwidthKm` | — | Search radius; the dominant parameter |
| `kernel` | `'quartic'` | `quartic`, `epanechnikov`, `gaussian`, `uniform` |
| `width` | `256` | Output grid width in cells |
| `height` | aspect-preserving | Output grid height |
| `bounds` | observations padded by one bandwidth | Extent to compute over |
| `weights` | `1` each | Per-observation intensity or count |
| `normalize` | `true` | Density per km² rather than a weighted count |

> **Warning:** cells beyond the bandwidth of every observation are written as
> **NoData, not zero**. An area with no observations is unobserved, not measured
> at zero, and rendering the two identically overstates coverage — the map claims
> knowledge of ground that was never sampled.

Normalisation matters when two surfaces are compared: doubling the bandwidth
roughly quadruples the area each observation contributes to, so unnormalised
surfaces at different bandwidths are not on the same scale.

The default extent pads the observations' own extent by one bandwidth, so density
is not truncated at the outermost point — a hard edge there is an artefact of the
frame rather than a property of the process.

`changeDensity` is the same estimator over a change mask, taking the output of
`changeMask` from [`classified-raster`](/docs/classified-raster) and locating
where change concentrates rather than only how much of it occurred.

## Integration boundaries

The package computes statistics and produces no data. It does not fetch, does not
aggregate, and does not decide what an observation is. Aggregating events to
administrative units, deduplicating reports, and reducing polygons to points all
happen upstream, because each is a modelling decision that changes the result and
belongs where it can be seen.

Nor does it interpret. Gi\* reports that values cluster; it does not report why,
and a cluster of reported incidents may be a cluster of reporting.

## Performance considerations

- `spatialWeights` and `suggestBandwidthKm` are O(n²) in observations. For the
  point counts a browser realistically analyses — up to a few thousand — this is
  well under a second; a larger study is better served by a spatially indexed
  implementation on the server.
- The pair loop exploits symmetry, evaluating each pair once and recording it on
  both rows, which halves the distance computations that dominate the cost.
- `getisOrdGiStar` is linear in the number of non-zero weights once the matrix
  exists, so re-running it at several thresholds over one weights matrix is cheap.
- `kernelDensity` is O(cells × observations). Reduce `width` before reducing the
  observation count: a coarser grid loses resolution, dropping observations loses
  the signal.
- Both are pure functions over plain arrays, so a large analysis belongs in a
  worker; `RasterData` holds a transferable `Float32Array`.

## Geospatial considerations

- Positions are EPSG:4326 `[longitude, latitude]` in decimal degrees.
- All distances are great-circle on a sphere of the IUGG mean radius. Error
  against an ellipsoidal computation is well under one percent — immaterial at
  the scale a distance band is chosen with.
- Density surfaces are returned as `RasterData` with `bounds` describing the
  grid's outer edges, row-major with the northern row first, matching every other
  raster in the library.
- The normal approximation underlying the p-values assumes enough neighbours for
  the statistic to be approximately normal. `getisOrdGiStar` requires at least
  three observations; a neighbourhood of one or two is reported honestly but
  should not be read as a significance claim.
- Observations near the edge of the study area have fewer neighbours than
  interior ones, so their statistics are less stable. This edge effect is
  inherent to a local statistic on a bounded extent, and is a reason to analyse a
  buffer beyond the area of interest and clip afterwards.
