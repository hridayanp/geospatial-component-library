## Purpose

`classified-raster` handles rasters whose cells hold an integer **class code**
rather than a measured quantity — land cover, land use, suitability, hazard
classes. It supplies the rendering configuration such a band requires, and the
change accounting a pair of epochs supports.

```bash
npm install @hridayanp/classified-raster
```

Every export is a pure function over plain data. No React and no map dependency,
so the package runs in a web worker, is testable without a browser, and composes
with the existing [`raster-layer`](/docs/raster-layer) rather than duplicating
it.

## Responsibilities

| Concern | Owner |
| --- | --- |
| Class code → label and colour resolution | `classified-raster` |
| Exact-lookup colourisation, no interpolation | `classified-raster` |
| Latitude-weighted class areas | `classified-raster` |
| Cross-tabulation of two epochs | `classified-raster` |
| Classification itself, and its accuracy | Producer of the data |
| Resampling two epochs onto a common grid | Host application |
| Rendering the result on a map | [`raster-layer`](/docs/raster-layer) |

## Data model

A classified raster is an ordinary `RasterData` whose values are codes. The codes
are meaningless without the table that interprets them:

```ts
import type { ClassTable } from '@hridayanp/classified-raster';

const LAND_COVER: ClassTable = [
  { value: 1,  label: 'Water',              color: '#419BDF' },
  { value: 2,  label: 'Trees',              color: '#397D49' },
  { value: 4,  label: 'Flooded vegetation', color: '#7A87C6' },
  { value: 5,  label: 'Crops',              color: '#E49635' },
  { value: 7,  label: 'Built area',         color: '#C4281B' },
  { value: 8,  label: 'Bare ground',        color: '#A59B8F' },
  { value: 11, label: 'Rangeland',          color: '#DFC35A' },
];
```

| Field | Required | Notes |
| --- | --- | --- |
| `value` | yes | Integer cell code. Duplicates raise, since the mapping would be ambiguous |
| `label` | yes | Class name as published by the producer |
| `color` | yes | Used on the map, in the legend, and in every chart of the data |
| `description` | no | Longer definition, for a legend tooltip or a data dictionary |

**Order is presentation order.** Legends, composition charts and transition
matrices all render classes in the order given, so a table ordered water →
vegetation → agriculture → built reads as a gradient of human modification
rather than as an arbitrary sequence.

Codes need not be contiguous — published schemes rarely are — which is why
resolution is an exact lookup rather than an index.

## Rendering model

```tsx
import { classifiedToDataUrl } from '@hridayanp/classified-raster';

const image = classifiedToDataUrl(landCover, LAND_COVER);

<RasterLayer data={{ kind: 'image', ...image }} resampling="nearest" />
```

Categorical codes must never be interpolated. A value halfway between "water" and
"trees" is not half of either, and blending their colours invents a class that
does not exist. `colorizeClassified` therefore resolves every cell by exact
lookup, and cells whose code is absent from the table are left **fully
transparent** rather than snapped to a neighbouring class.

Upsampling replicates whole cells, preserving the hard class boundaries that
carry the classification's meaning.

> **Warning:** pass `resampling="nearest"` to the layer. Without it the GPU
> reintroduces bilinear interpolation at draw time and softens exactly the
> boundaries the exact lookup preserved.

| Option | Default | Effect |
| --- | --- | --- |
| `opacity` | `1` | Global alpha multiplier |
| `maxDimension` | `2048` | Cap on the longest output edge |
| `visibleClasses` | — | Render a subset; other codes stay transparent |

In a worker, use `colorizeClassified` and transfer the pixel buffer;
`classifiedToDataUrl` requires a DOM.

The legend comes off the same table, so the map and its key cannot drift apart:

```tsx
import { classTableToLegendClasses } from '@hridayanp/classified-raster';

<GeoLegend title="Land cover" classes={classTableToLegendClasses(LAND_COVER)} />
```

`classifiedColorScale` and `classifiedDomain` are also exported for callers who
want `RasterLayer` to colourise. Note the caveat: a discrete scale snaps to the
nearest stop *below* the value, so a code absent from the table adopts the
preceding class's colour instead of rendering transparent. Where the coding
scheme has gaps, prefer the exact path above.

## Area weighting

```ts
import { classAreas } from '@hridayanp/classified-raster';

const { classes, totalAreaKm2, unclassifiedCells } =
  classAreas(landCover, LAND_COVER);
```

Areas are **latitude-weighted**, and this is not a refinement. Cells of a raster
in geographic coordinates are graticule quadrangles, not squares: one degree of
longitude spans about 111 km at the equator and half that at 60° latitude.
Counting cells and multiplying by a single constant overstates high-latitude
classes and understates low-latitude ones, by enough to invert a ranking over a
continental extent.

The exact area of a quadrangle on a sphere is

```text
A = R² · Δλ · (sin φ₂ − sin φ₁)
```

which depends only on the row's latitude bounds. One value per row is therefore
sufficient, and computing it per row rather than per cell keeps a full-grid
statistic linear and cheap.

Cells matching the raster's `noData` sentinel, holding a non-finite value, or
carrying an uncoded value are excluded from every total and reported separately
as `unclassifiedCells`. Excluding them rather than assigning them to a residual
class keeps `fraction` a share of the *classified* area — the quantity a
composition chart should sum to one over.

`rowAreasKm2` and `boundsAreaKm2` are exported for callers computing their own
statistics over the same grid.

## Change accounting

```ts
import {
  transitionMatrix,
  netChange,
  topTransitions,
  persistenceRate,
} from '@hridayanp/classified-raster';

const matrix = transitionMatrix(epoch2017, epoch2024, LAND_COVER);
```

`cells[i][j]` counts cells classified as `classes[i]` in the first epoch and
`classes[j]` in the second; `areaKm2[i][j]` is the same in latitude-weighted
area. The diagonal is persistence, everything off it is conversion. Reading
across a row shows where a class went; reading down a column shows where a class
came from.

> **Warning:** a cell is counted only when **both** epochs classify it. Excluding
> partially-observed cells rather than treating an absence as a class is what
> keeps a matrix from reporting cloud gaps as land-cover change — the most common
> way a change statistic becomes wrong while remaining entirely plausible. The
> count of excluded cells is returned, and a large one is a reason to distrust
> the result rather than a detail.

Grids must match in dimensions, and in extent unless `allowMismatchedBounds` is
set. A cross-tabulation is only meaningful when cell *i* of both epochs covers
the same ground; two grids of identical dimensions over different extents would
produce a matrix that looks correct and means nothing.

### Derived summaries

```ts
netChange(matrix);          // gain, loss and net per class
topTransitions(matrix, 5);  // largest conversions, diagonal excluded
persistenceRate(matrix);    // share of compared area that did not change
```

`netChange` reports gain and loss **separately** because they are separate
processes: a class can be stable in net terms while a large area of it is
converted and an equal area gained elsewhere. Reporting only the net presents
that as no change at all.

`topTransitions` excludes the diagonal, because persistence usually holds most of
the area and ranking without excluding it returns "water stayed water" as the
headline finding.

`persistenceRate` is worth reading before interpreting a change map: agreement
far below what the interval plausibly supports usually indicates misregistration
or a classifier difference rather than change on the ground.

### Change mask

```ts
import { changeMask } from '@hridayanp/classified-raster';

const mask = changeMask(epoch2017, epoch2024, LAND_COVER);
```

`1` where the class changed, `0` where it persisted, NoData where either epoch
was unclassified. This is the input `changeDensity` in
[`hotspot-analysis`](/docs/hotspot-analysis) expects, for locating where change
concentrates rather than only how much of it there was.

## Integration boundaries

The package classifies nothing and produces no data: it interprets codes a
producer assigned, and the accuracy of that classification is a property of the
source. Two epochs from different classifiers, or from one classifier at
different versions, will differ for reasons that are not change on the ground.

Resampling two epochs onto a common grid is a host responsibility. Doing it
inside the cross-tabulation would hide a decision — which grid, which resampling
rule — that materially affects the result, and for categorical data the only
defensible rule is nearest neighbour.

## Performance considerations

- Every statistic is one linear pass over the grid; a full-resolution band of a
  few million cells completes in well under a second.
- The transition matrix allocates two *k* × *k* arrays for *k* classes, which is
  negligible for any real coding scheme.
- Colourisation is the expensive operation, because it writes pixels. Class
  colours are resolved once into a lookup rather than parsed per cell — the same
  reasoning behind the 256-entry table in
  [`raster-utils`](/docs/raster-utils#the-256-entry-lookup-table).
- For large grids, run `colorizeClassified` in a worker and transfer the buffer.

## Geospatial considerations

- Extents are `[west, south, east, north]` in EPSG:4326, describing the grid's
  outer edges. Grids are row-major with the northern row first.
- Areas are computed on a sphere of the IUGG mean radius. Error against an
  ellipsoidal computation is well under one percent — appropriate for
  composition and change accounting, and not appropriate for cadastral or
  statutory area reporting.
- No reprojection is performed. A classified raster in a projected CRS must be
  warped upstream, with nearest-neighbour resampling.
- Codes are read with `Math.round`, so a band stored as float is handled, but a
  band whose codes are genuinely non-integer is not a classified raster.
