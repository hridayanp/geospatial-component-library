import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ChangeMatrix,
  ClassAreaChart,
  TrendChart,
  compoundGrowthRate,
  linearTrend,
} from '@hridayanp/geo-charts';
import {
  classAreas,
  netChange,
  transitionMatrix,
} from '@hridayanp/classified-raster';
import { DemoSurface } from './demo/DemoMap';
import { loadConvectiveRaster } from './demo/assets';
import { useAsset } from './demo/useAsset';
import { deriveRasterSequence } from './demo/derive';
import { CONVECTIVE_CLASSES, classifyConvective } from './demo/classified';

const meta = {
  title: 'Analysis/Charts',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Charts for the output of geospatial analysis: a time series with a least-squares
projection, class composition and change, and a class transition matrix.

**Installation**

\`\`\`bash
npm install @hridayanp/geo-charts react
import '@hridayanp/ui/styles.css';
\`\`\`

Rendered as inline SVG with no charting dependency. The scope is deliberately
narrow — three forms that answer questions the rest of this library produces
answers to — rather than a general plotting library.

### Colour comes from the caller

When a chart describes something also drawn on a map, it must adopt the map's
symbology. A composition chart whose "Trees" bar is not the green the map paints
trees forces the reader to learn the encoding twice, and the mismatch reads as
two different datasets. Every component therefore takes its data colours as
props — pass the same class table the layer was given.

### Trend and projection

Observed values are drawn solid; projected values dashed, inside a prediction
band. A projection rendered identically to an observation invites the reader to
treat an extrapolation as data.

The projection is arithmetic, not a forecast: it assumes the observed rate of
change continues and knows nothing of saturation, policy or any driver of the
process. The band is a **prediction** interval — it accounts for the scatter of
an individual observation about the line, not only for uncertainty in the line's
position — and widens with distance from the observed period. A wide band is the
chart telling the truth.

\`linearTrend\` returns \`r2\` and the residual standard error alongside the
coefficients. A low \`r2\` does not mean the series is flat; it means a straight
line is the wrong description of it.

### Composition and change

Bars are horizontal because class names are words. In \`change\` mode they
diverge from a central zero: gains right, losses left. A signed quantity plotted
as unsigned magnitude — two equal bars for a gain and a loss — is the standard
way a change chart becomes unreadable.

### Transition matrix

Rows are the earlier class, columns the later one: the diagonal is persistence,
everything off it is conversion. Cell colour encodes magnitude, so it is a
**single-hue ramp with monotone lightness** — a multi-hue ramp has no perceptual
ordering, and a reader cannot say whether green means more than orange without
consulting the legend for every cell. Class identity lives on the axes, where
each label carries its map colour.

The diagonal is excluded from the colour scale by default: persistence usually
holds most of the area, so including it compresses every conversion into the
lightest step and the matrix reads as empty.

### Accessibility

Every chart ships a **table view** — a keyboard-reachable toggle rendering the
same values as text. A chart encodes values as position and colour, both
unavailable to a screen-reader user and unreliable for a reader with a colour
vision deficiency. No value is reachable only by hovering; tooltips enhance and
never gate.

The default categorical palette is validated for colour-vision deficiency: eight
hues in a fixed order whose adjacent pairs stay separable under simulated
protanopia and deuteranopia, with a re-stepped set for dark surfaces.

### Theming

Chrome — axes, gridlines, text, surfaces — is drawn from the library's
\`--gcl-*\` tokens, so charts follow \`data-gcl-theme\` and
\`prefers-color-scheme\` with the rest of the library. The sequential ramp ships
as \`--gcl-viz-seq-0\` … \`--gcl-viz-seq-5\`, each paired with a \`-ink\` token
that clears contrast against it; on a dark surface it is re-anchored rather than
inverted.

### Data used in these stories

\`assets/raster.tif\`, reclassified into five ordered severity classes and
tracked across the derived temporal sequence. Class areas are latitude-weighted
by \`@hridayanp/classified-raster\`.
        `,
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Class areas per epoch, derived once and shared by the stories below. */
function useClassSeries() {
  const { value: base } = useAsset(loadConvectiveRaster);

  return useMemo(() => {
    if (!base) return null;
    const frames = deriveRasterSequence(base, 16);

    const epochs = frames.map((frame, index) => ({
      index,
      label: frame.label,
      areas: classAreas(classifyConvective(frame.meta.raster), CONVECTIVE_CLASSES),
    }));

    const series = CONVECTIVE_CLASSES.map((klass) => ({
      id: klass.label,
      color: klass.color,
      points: epochs.map((epoch) => ({
        x: epoch.index,
        y:
          epoch.areas.classes.find((entry) => entry.value === klass.value)
            ?.areaKm2 ?? 0,
      })),
    }));

    const first = classifyConvective(frames[0]!.meta.raster);
    const last = classifyConvective(frames[frames.length - 1]!.meta.raster);

    return {
      epochs,
      series,
      matrix: transitionMatrix(first, last, CONVECTIVE_CLASSES),
      firstLabel: frames[0]!.label,
      lastLabel: frames[frames.length - 1]!.label,
    };
  }, [base]);
}

/** A time series with a least-squares projection and its prediction band. */
export const TrendWithProjection: Story = {
  render: () => {
    const model = useClassSeries();
    return (
      <TrendChart
        title="Area by severity class"
        subtitle="Observed across sixteen half-hourly steps, projected six steps beyond"
        xLabel="Step"
        yLabel="Area (km²)"
        unit="km²"
        projectTo={21}
        clampProjection={[0, Infinity]}
        series={model?.series ?? []}
        footnote="The projection assumes the observed rate of change continues. The band widens with distance from the observed period because the observations constrain a distant value only loosely."
      />
    );
  },
};

/** Observations only, with no extrapolation. */
export const ObservationsOnly: Story = {
  render: () => {
    const model = useClassSeries();
    return (
      <TrendChart
        title="Area by severity class"
        subtitle="Observed values, no projection"
        xLabel="Step"
        yLabel="Area (km²)"
        unit="km²"
        series={model?.series ?? []}
      />
    );
  },
};

/** A single series: no legend box, because the title already names it. */
export const SingleSeries: Story = {
  render: () => {
    const model = useClassSeries();
    const series = model?.series.filter((entry) => entry.id === 'High') ?? [];
    return (
      <TrendChart
        title="High-severity area"
        subtitle="One series, projected six steps beyond the observations"
        xLabel="Step"
        yLabel="Area (km²)"
        unit="km²"
        projectTo={21}
        clampProjection={[0, Infinity]}
        includeZero
        series={series}
      />
    );
  },
};

/** Class composition at one epoch. */
export const Composition: Story = {
  render: () => {
    const model = useClassSeries();
    const first = model?.epochs[0];
    return (
      <ClassAreaChart
        title="Severity composition"
        subtitle={first ? `At ${first.label}` : undefined}
        unit="km²"
        data={
          first?.areas.classes.map((klass) => ({
            label: klass.label,
            color: klass.color,
            value: klass.areaKm2,
          })) ?? []
        }
        footnote="Areas are latitude-weighted: cells of a geographic raster are graticule quadrangles, not squares."
      />
    );
  },
};

/** Signed change between two epochs, diverging from zero. */
export const ChangeByClass: Story = {
  render: () => {
    const model = useClassSeries();
    const changes = model ? netChange(model.matrix) : [];
    return (
      <ClassAreaChart
        title="Change by severity class"
        subtitle={
          model ? `${model.firstLabel} → ${model.lastLabel}` : undefined
        }
        mode="change"
        unit="km²"
        beforeLabel={model?.firstLabel ?? 'Before'}
        afterLabel={model?.lastLabel ?? 'After'}
        data={changes.map((entry) => ({
          label: entry.class.label,
          color: entry.class.color,
          value: entry.fromAreaKm2,
          compareValue: entry.toAreaKm2,
        }))}
        footnote="Net change only. A class can be stable in net terms while a large area of it converts and an equal area is gained elsewhere — the transition matrix separates the two."
      />
    );
  },
};

/** The transition matrix: what became what. */
export const Transitions: Story = {
  render: () => {
    const model = useClassSeries();
    return (
      <ChangeMatrix
        title="Severity transitions"
        subtitle={
          model ? `${model.firstLabel} → ${model.lastLabel}` : undefined
        }
        unit="km²"
        classes={model?.matrix.classes ?? []}
        values={model?.matrix.areaKm2 ?? []}
      />
    );
  },
};

/** The matrix with persistence included in the colour scale. */
export const TransitionsWithDiagonal: Story = {
  render: () => {
    const model = useClassSeries();
    return (
      <ChangeMatrix
        title="Severity transitions, diagonal included"
        subtitle="Persistence holds most of the area, so every conversion compresses into the lightest step"
        unit="km²"
        excludeDiagonal={false}
        classes={model?.matrix.classes ?? []}
        values={model?.matrix.areaKm2 ?? []}
      />
    );
  },
};

/** The fit statistics behind a projection. */
export const TrendStatistics: Story = {
  render: () => {
    const model = useClassSeries();
    const rows = useMemo(
      () =>
        (model?.series ?? []).map((entry) => {
          const fit = linearTrend(entry.points);
          return {
            label: entry.id,
            slope: fit.slope,
            r2: fit.r2,
            rse: fit.residualStandardError,
            cagr: compoundGrowthRate(entry.points),
          };
        }),
      [model],
    );

    return (
      <DemoSurface note="A low r² does not mean the series is flat; it means a straight line is the wrong description of it. Reading the projection without reading these is how an extrapolation becomes a claim.">
        <div className="demo-readout">
          {rows.length > 0
            ? [
                'class            slope        r²       RSE      per-step',
                ...rows.map(
                  (row) =>
                    `${row.label.padEnd(14)} ${row.slope.toFixed(2).padStart(8)} ${row.r2.toFixed(3).padStart(9)} ${row.rse.toFixed(2).padStart(9)} ${row.cagr != null ? `${(row.cagr * 100).toFixed(2)}%`.padStart(11) : '—'.padStart(11)}`,
                ),
              ].join('\n')
            : 'Computing…'}
        </div>
      </DemoSurface>
    );
  },
};
