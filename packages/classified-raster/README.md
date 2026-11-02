# @hridayanp/classified-raster

Rendering configuration and change accounting for classified (categorical)
rasters — land cover, land use, suitability classes, any band whose cells hold an
integer code rather than a measured quantity.

Every export is a pure function over plain data. No React, no map dependency.

## Installation

```bash
npm install @hridayanp/classified-raster
```

## The class table

A classified raster stores a code per cell. The code is meaningless without the
table that maps it to a label and a colour — code `2` is "Trees" only because the
producer says so.

```ts
import type { ClassTable } from '@hridayanp/classified-raster';

const LAND_COVER: ClassTable = [
  { value: 1, label: 'Water', color: '#419BDF' },
  { value: 2, label: 'Trees', color: '#397D49' },
  { value: 4, label: 'Flooded vegetation', color: '#7A87C6' },
  { value: 5, label: 'Crops', color: '#E49635' },
  { value: 7, label: 'Built area', color: '#C4281B' },
  { value: 8, label: 'Bare ground', color: '#A59B8F' },
  { value: 11, label: 'Rangeland', color: '#DFC35A' },
];
```

Order is presentation order: legends, composition charts and transition matrices
all render classes in the order given.

## Rendering

Categorical codes must never be interpolated — a value halfway between "water"
and "trees" is not half of either. `colorizeClassified` resolves every cell by
exact lookup and leaves uncoded cells transparent rather than snapping them to a
neighbouring class.

```tsx
import { classifiedToDataUrl } from '@hridayanp/classified-raster';
import { RasterLayer } from '@hridayanp/raster-layer';

const image = classifiedToDataUrl(landCover, LAND_COVER);

<RasterLayer data={{ kind: 'image', ...image }} resampling="nearest" />;
```

`resampling="nearest"` matters: without it the GPU reintroduces interpolation at
draw time and softens the class boundaries that carry the classification's
meaning.

The legend comes off the same table, so the map and its key cannot drift apart:

```tsx
import { classTableToLegendClasses } from '@hridayanp/classified-raster';

<GeoLegend title="Land cover" classes={classTableToLegendClasses(LAND_COVER)} />;
```

## Class areas

```ts
import { classAreas } from '@hridayanp/classified-raster';

const { classes, totalAreaKm2, unclassifiedCells } = classAreas(raster, LAND_COVER);
```

Areas are **latitude-weighted**. Cells of a raster in geographic coordinates are
graticule quadrangles, not squares: one degree of longitude spans about 111 km at
the equator and half that at 60° latitude. Counting cells and multiplying by a
constant overstates high-latitude classes badly enough to invert a ranking over a
continental extent.

The exact area of a quadrangle on a sphere depends only on its latitude bounds:

```text
A = R² · Δλ · (sin φ₂ − sin φ₁)
```

so one value per row is sufficient, and the statistic stays linear in cell count.

## Change accounting

```ts
import {
  transitionMatrix,
  netChange,
  topTransitions,
  persistenceRate,
} from '@hridayanp/classified-raster';

const matrix = transitionMatrix(epoch2017, epoch2024, LAND_COVER);

netChange(matrix);          // gain, loss and net per class
topTransitions(matrix, 5);  // the largest conversions, diagonal excluded
persistenceRate(matrix);    // share of area that did not change
```

`cells[i][j]` counts cells classified as `classes[i]` in the first epoch and
`classes[j]` in the second. The diagonal is persistence; everything off it is
conversion.

A cell is counted only when **both** epochs classify it. Excluding
partially-observed cells rather than treating an absence as a class is what keeps
a matrix from reporting cloud gaps as land-cover change — the most common way a
change statistic becomes wrong while remaining plausible.

Gain and loss are reported separately because they are separate processes: a
class can be stable in net terms while a large area of it is converted and an
equal area gained elsewhere.

Grids must match in dimensions, and in extent unless `allowMismatchedBounds` is
set. A cross-tabulation is only meaningful when cell *i* of both epochs covers
the same ground.

## Change mask

```ts
import { changeMask } from '@hridayanp/classified-raster';

const mask = changeMask(epoch2017, epoch2024, LAND_COVER);
```

`1` where the class changed, `0` where it persisted, NoData where either epoch
was unclassified — the input a change layer or a density analysis of change
intensity expects.

## Geospatial considerations

- Extents are `[west, south, east, north]` in EPSG:4326; grids are row-major with
  the northern row first.
- Areas use a sphere of the IUGG mean radius. Error against an ellipsoidal
  computation is well under one percent — appropriate for composition and change
  accounting, not for cadastral or statutory reporting.
- No reprojection is performed. A classified raster in a projected CRS must be
  warped upstream.

## Documentation

Interactive examples live in the workspace Storybook:

```bash
npm run storybook
```

## License

MIT
