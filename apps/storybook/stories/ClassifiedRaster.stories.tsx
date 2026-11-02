import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  classAreas,
  classTableToLegendClasses,
  classifiedToDataUrl,
  netChange,
  persistenceRate,
  topTransitions,
  transitionMatrix,
} from '@hridayanp/classified-raster';
import { RasterLayer } from '@hridayanp/raster-layer';
import { GeoLegend } from '@hridayanp/geo-legend';
import { CompareMaps } from '@hridayanp/map-compare';
import { DemoMap, DemoSurface } from './demo/DemoMap';
import { DEMO_BASEMAP } from './demo/data';
import { CONVECTIVE_VIEW, loadConvectiveRaster } from './demo/assets';
import { useAsset } from './demo/useAsset';
import { deriveRasterSequence } from './demo/derive';
import { CONVECTIVE_CLASSES, classifyConvective } from './demo/classified';

const meta = {
  title: 'Analysis/Classified Raster',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Rendering configuration and change accounting for classified (categorical)
rasters — land cover, land use, suitability classes, any band whose cells hold an
integer code rather than a measured quantity.

**Installation**

\`\`\`bash
npm install @hridayanp/classified-raster
\`\`\`

Every export is a pure function over plain data. No React and no map dependency,
so the package runs in a web worker and composes with the existing
\`RasterLayer\` rather than duplicating it.

### Data model

A \`ClassTable\` maps each integer code to a label and a colour. The code is
meaningless without it — code \`2\` is "Trees" only because the producer says so,
and the same code means something else in another product.

\`\`\`ts
const LAND_COVER: ClassTable = [
  { value: 1, label: 'Water', color: '#419BDF' },
  { value: 2, label: 'Trees', color: '#397D49' },
  { value: 7, label: 'Built area', color: '#C4281B' },
];
\`\`\`

Order is presentation order: legends, composition charts and transition matrices
all render classes in the order given.

### Rendering model

Categorical codes must never be interpolated: a value halfway between "water" and
"trees" is not half of either, and blending their colours invents a class that
does not exist. \`colorizeClassified\` resolves every cell by exact lookup and
leaves uncoded cells transparent rather than snapping them to a neighbouring
class. Upsampling replicates whole cells, preserving the hard boundaries that
carry the classification's meaning.

Pair the result with \`resampling="nearest"\` so the GPU does not reintroduce
interpolation at draw time.

### Area weighting

Cells of a raster in geographic coordinates are graticule quadrangles, not
squares: one degree of longitude spans about 111 km at the equator and half that
at 60° latitude. Counting cells and multiplying by a constant overstates
high-latitude classes badly enough to invert a ranking over a continental extent.

The exact area of a quadrangle on a sphere depends only on its latitude bounds,

\`\`\`text
A = R² · Δλ · (sin φ₂ − sin φ₁)
\`\`\`

so one value per row is sufficient and the statistic stays linear in cell count.

### Change accounting

\`transitionMatrix\` cross-tabulates two epochs of one grid: \`cells[i][j]\`
counts cells classified as \`classes[i]\` in the first and \`classes[j]\` in the
second. The diagonal is persistence; everything off it is conversion.

A cell is counted only when **both** epochs classify it. Excluding
partially-observed cells rather than treating an absence as a class is what keeps
a matrix from reporting cloud gaps as land-cover change — the most common way a
change statistic becomes wrong while remaining plausible.

\`netChange\` reports gain and loss separately, because they are separate
processes: a class can be stable in net terms while a large area of it is
converted and an equal area gained elsewhere.

### Data used in these stories

\`assets/raster.tif\` — a continuous convective probability band —
reclassified into five ordered severity classes. Reclassifying a continuous
surface is a standard operation and produces exactly the integer-coded band these
functions consume. Two epochs come from the derived temporal sequence.

### Geospatial considerations

Extents are \`[west, south, east, north]\` in EPSG:4326 and grids are row-major
with the northern row first. Areas use a sphere of the IUGG mean radius — error
against an ellipsoidal computation is well under one percent, appropriate for
composition and change accounting and not for statutory area reporting.

Grids must match in dimensions, and in extent unless \`allowMismatchedBounds\` is
set: a cross-tabulation is only meaningful when cell *i* of both epochs covers the
same ground.
        `,
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function useClassifiedEpochs() {
  const { value: base } = useAsset(loadConvectiveRaster);
  return useMemo(() => {
    if (!base) return null;
    const frames = deriveRasterSequence(base, 16);
    const first = frames[0]!.meta.raster;
    const last = frames[frames.length - 1]!.meta.raster;
    return {
      before: classifyConvective(first),
      after: classifyConvective(last),
      beforeLabel: frames[0]!.label,
      afterLabel: frames[frames.length - 1]!.label,
    };
  }, [base]);
}

/** A classified band rendered through an exact class lookup. */
export const ClassifiedLayer: Story = {
  render: () => {
    const epochs = useClassifiedEpochs();
    const image = useMemo(
      () =>
        epochs ? classifiedToDataUrl(epochs.before, CONVECTIVE_CLASSES) : null,
      [epochs],
    );

    return (
      <DemoMap
        {...CONVECTIVE_VIEW}
        note="Rendered as a pre-coloured image and placed by the existing RasterLayer. No layer of its own is required — the class table produces the pixels, and resampling='nearest' keeps the GPU from softening the class boundaries."
      >
        {image && (
          <RasterLayer
            data={{ kind: 'image', url: image.url, bounds: image.bounds }}
            resampling="nearest"
            opacity={0.9}
          />
        )}
        <GeoLegend
          title="Convective severity"
          classes={classTableToLegendClasses(CONVECTIVE_CLASSES)}
          placement="bottom-right"
        />
      </DemoMap>
    );
  },
};

/** Two classified epochs, compared by swipe. */
export const ClassifiedComparison: Story = {
  render: () => {
    const epochs = useClassifiedEpochs();
    const images = useMemo(() => {
      if (!epochs) return null;
      return {
        before: classifiedToDataUrl(epochs.before, CONVECTIVE_CLASSES),
        after: classifiedToDataUrl(epochs.after, CONVECTIVE_CLASSES),
      };
    }, [epochs]);

    return (
      <div>
        <p className="demo-note">
          Both epochs share one class table, so a difference in colour is a
          difference in class rather than in scaling.
        </p>
        <div style={{ height: 460 }}>
          <CompareMaps
            {...CONVECTIVE_VIEW}
            mapStyle={DEMO_BASEMAP as never}
            beforeLabel={epochs?.beforeLabel}
            afterLabel={epochs?.afterLabel}
            before={
              images && (
                <RasterLayer
                  id="classified-before"
                  data={{ kind: 'image', ...images.before }}
                  resampling="nearest"
                  opacity={0.9}
                />
              )
            }
            after={
              images && (
                <>
                  <RasterLayer
                    id="classified-after"
                    data={{ kind: 'image', ...images.after }}
                    resampling="nearest"
                    opacity={0.9}
                  />
                  <GeoLegend
                    title="Convective severity"
                    classes={classTableToLegendClasses(CONVECTIVE_CLASSES)}
                    placement="bottom-right"
                  />
                </>
              )
            }
          />
        </div>
      </div>
    );
  },
};

/** Latitude-weighted class areas, and what they sum to. */
export const ClassAreaStatistics: Story = {
  render: () => {
    const epochs = useClassifiedEpochs();
    const result = useMemo(
      () => (epochs ? classAreas(epochs.before, CONVECTIVE_CLASSES) : null),
      [epochs],
    );

    return (
      <DemoSurface note="Areas are weighted by each row's latitude, so a class concentrated at the north of the extent is not credited with the area it would have at the equator.">
        <div className="demo-readout">
          {result
            ? [
                'class            cells        km²     share',
                ...result.classes.map(
                  (klass) =>
                    `${klass.label.padEnd(14)} ${String(klass.cells).padStart(6)} ${klass.areaKm2.toFixed(1).padStart(10)} ${(klass.fraction * 100).toFixed(1).padStart(8)}%`,
                ),
                '',
                `classified     ${String(result.classifiedCells).padStart(6)} ${result.totalAreaKm2.toFixed(1).padStart(10)}`,
                `unclassified   ${String(result.unclassifiedCells).padStart(6)}`,
              ].join('\n')
            : 'Decoding…'}
        </div>
      </DemoSurface>
    );
  },
};

/** The change matrix, and the summaries derived from it. */
export const ChangeAccounting: Story = {
  render: () => {
    const epochs = useClassifiedEpochs();
    const analysis = useMemo(() => {
      if (!epochs) return null;
      const matrix = transitionMatrix(
        epochs.before,
        epochs.after,
        CONVECTIVE_CLASSES,
      );
      return {
        matrix,
        net: netChange(matrix),
        top: topTransitions(matrix, 5),
        persistence: persistenceRate(matrix),
      };
    }, [epochs]);

    return (
      <DemoSurface note="Gain and loss are reported separately: a class can be stable in net terms while a large area of it converts and an equal area is gained elsewhere.">
        <div className="demo-readout">
          {analysis
            ? [
                `persistence    ${(analysis.persistence * 100).toFixed(1)}% of compared area`,
                `compared       ${analysis.matrix.comparedCells} cells (${analysis.matrix.excludedCells} excluded)`,
                '',
                'class            from        to      gain      loss       net',
                ...analysis.net.map(
                  (entry) =>
                    `${entry.class.label.padEnd(14)} ${entry.fromAreaKm2.toFixed(0).padStart(6)} ${entry.toAreaKm2.toFixed(0).padStart(9)} ${entry.gainKm2.toFixed(0).padStart(9)} ${entry.lossKm2.toFixed(0).padStart(9)} ${(entry.netKm2 >= 0 ? '+' : '−') + Math.abs(entry.netKm2).toFixed(0).padStart(8)}`,
                ),
                '',
                'largest conversions',
                ...analysis.top.map(
                  (transition) =>
                    `  ${transition.from.label} → ${transition.to.label}: ${transition.areaKm2.toFixed(0)} km² (${(transition.fraction * 100).toFixed(1)}% of changed area)`,
                ),
              ].join('\n')
            : 'Decoding…'}
        </div>
      </DemoSurface>
    );
  },
};

/** Selective rendering: one class at a time, over the basemap. */
export const VisibleClasses: Story = {
  render: () => {
    const epochs = useClassifiedEpochs();
    const images = useMemo(() => {
      if (!epochs) return null;
      return CONVECTIVE_CLASSES.slice(2).map((klass) => ({
        klass,
        image: classifiedToDataUrl(epochs.before, CONVECTIVE_CLASSES, {
          visibleClasses: [klass.value],
        }),
      }));
    }, [epochs]);

    return (
      <div>
        <p className="demo-note">
          <code className="demo-code">visibleClasses</code> renders a subset;
          every other code stays transparent, leaving the basemap visible rather
          than masking it.
        </p>
        <div className="demo-grid">
          {(images ?? []).map(({ klass, image }) => (
            <DemoMap key={klass.value} {...CONVECTIVE_VIEW} size="short" note={klass.label}>
              <RasterLayer
                id={`class-${klass.value}`}
                data={{ kind: 'image', url: image.url, bounds: image.bounds }}
                resampling="nearest"
                opacity={0.92}
              />
            </DemoMap>
          ))}
        </div>
      </div>
    );
  },
};
