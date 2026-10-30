import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  extractObservations,
  getisOrdGiStar,
  hotspotLegendClasses,
  kernelDensity,
  spatialWeights,
  suggestBandwidthKm,
  summarizeClusters,
  toHotspotFeatures,
} from '@hridayanp/hotspot-analysis';
import { VectorLayer } from '@hridayanp/vector-layer';
import { RasterLayer } from '@hridayanp/raster-layer';
import { GeoLegend } from '@hridayanp/geo-legend';
import { GeoHover } from '@hridayanp/geo-hover';
import { DemoMap, DemoSurface } from './demo/DemoMap';
import { PALETTES } from './demo/data';
import { CONVECTIVE_VIEW, loadObservations } from './demo/assets';
import { useAsset } from './demo/useAsset';
import { thin } from './demo/classified';

/**
 * Gi* evaluates every pair of observations, so the sample is thinned before
 * analysis. Taking every nth feature preserves the spatial spread across the
 * full extent, where taking the first n would analyse one corner of it.
 */
const SAMPLE_LIMIT = 700;
const VALUE_PROPERTY = 'thunderstorm_prob_pct';

const meta = {
  title: 'Analysis/Hotspot Analysis',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Spatial cluster detection: Getis-Ord Gi\\* over discrete observations, and kernel
density estimation onto a continuous surface.

**Installation**

\`\`\`bash
npm install @hridayanp/hotspot-analysis
\`\`\`

Every export is a pure function over plain data. Results come back in the shapes
the rendering packages already accept — a FeatureCollection carrying computed
properties for \`VectorLayer\`, and a \`RasterData\` surface for
\`RasterLayer\` — so the analysis and its rendering stay separable and the same
computation can run in a worker or on a server.

### What Gi\\* answers

For each observation: are the values in its neighbourhood higher — or lower —
than a random arrangement of the same values would produce? A large positive
z-score means an observation is surrounded by high values, a **hot spot**; a
large negative one means the opposite.

**A high value is not a hot spot.** An isolated maximum surrounded by low values
is an outlier, and Gi\\* will not flag it. A hot spot is a *cluster*, and an
observation of unremarkable magnitude can sit at the centre of one.

\`\`\`text
         Σⱼ wᵢⱼ xⱼ − X̄ Σⱼ wᵢⱼ
Gi*ᵢ = ─────────────────────────────────────────
       S √[ (n Σⱼ wᵢⱼ² − (Σⱼ wᵢⱼ)²) / (n − 1) ]
\`\`\`

### The distance band

There is no universally correct value. Too small and most observations have no
neighbours, so every statistic is undefined; too large and the local statistic
converges on the global mean and every cluster disappears. **The same data yields
different clusters at different scales, and neither is wrong** — report the
bandwidth alongside the map.

\`suggestBandwidthKm\` returns the median, 90th-percentile and maximum
nearest-neighbour distances. The maximum is the smallest band that leaves no
observation isolated: a floor rather than a recommendation, since a sparse
periphery can inflate it well beyond the scale of the process.

Distances are great-circle throughout, so a band means the same thing at every
latitude. A planar distance on Web Mercator coordinates would shrink the
effective band toward the equator and inflate it toward the poles, biasing where
clusters are detected.

### Multiple comparisons

A local statistic is computed once per observation, so at the conventional 5%
level roughly one observation in twenty is flagged by chance alone — a thousand
observations yield about fifty spurious hot spots.
\`falseDiscoveryRate: true\` applies the Benjamini-Hochberg correction, which
controls the expected share of false positives among those reported. Enable it
whenever the result will be read as a map of real clusters.

### Colour

Hot and cold are opposite states either side of "no clustering", so the symbology
is **diverging**: warm for high-value clusters, cool for low-value ones, a
neutral midpoint for the not-significant band. Confidence is encoded as lightness
within each arm, so the three bands read as an ordered sequence.
\`toHotspotFeatures\` writes the resolved colour onto each feature, so the map
and \`hotspotLegendClasses()\` cannot disagree.

### Kernel density

Where Gi\\* asks whether values cluster, density asks where observations
concentrate. Cells beyond the bandwidth of every observation are written as
**NoData, not zero** — an area with no observations is unobserved, not measured
at zero, and rendering the two identically overstates coverage.

### Performance

\`spatialWeights\` is O(n²) in observation count, and the matrix is stored
sparsely because a distance band over ten thousand observations is almost
entirely zeros. Kernel density costs O(cells × observations); reduce the grid
width before reducing the observation count, since the surface is smooth and a
coarse grid loses very little.

### Data used in these stories

\`assets/vector.geojson\` — 3,190 observation points carrying
\`thunderstorm_prob_pct\` — thinned to ${SAMPLE_LIMIT} for the pairwise
computation.
        `,
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function useSample() {
  const { value: collection } = useAsset(loadObservations);
  return useMemo(() => {
    if (!collection) return null;
    const extracted = extractObservations(collection, VALUE_PROPERTY);
    const indices = thin(
      extracted.positions.map((_, i) => i),
      SAMPLE_LIMIT,
    );
    return {
      positions: indices.map((i) => extracted.positions[i]!),
      values: indices.map((i) => extracted.values[i]!),
      features: indices.map((i) => extracted.features[i]!),
    };
  }, [collection]);
}

/** Gi\* clusters, rendered through the existing vector layer. */
export const ClusterMap: Story = {
  render: () => {
    const sample = useSample();
    const [bandwidthKm, setBandwidthKm] = useState(35);
    const [corrected, setCorrected] = useState(true);

    const analysis = useMemo(() => {
      if (!sample || sample.positions.length < 3) return null;
      const weights = spatialWeights(sample.positions, { bandwidthKm });
      const results = getisOrdGiStar(sample.values, weights, {
        falseDiscoveryRate: corrected,
      });
      return {
        features: toHotspotFeatures(sample.features, results),
        summary: summarizeClusters(results),
      };
    }, [sample, bandwidthKm, corrected]);

    return (
      <div>
        <p className="demo-note">
          Move the band and the clusters change — that is the statistic behaving
          correctly, not instability. Report the bandwidth with the map.
        </p>
        <div
          className="gcl-row"
          style={{ marginBottom: 10, fontSize: 12, flexWrap: 'wrap', gap: 16 }}
        >
          <label className="gcl-row" style={{ minWidth: 260 }}>
            band {bandwidthKm} km
            <input
              type="range"
              min={10}
              max={120}
              step={5}
              value={bandwidthKm}
              onChange={(event) => setBandwidthKm(Number(event.target.value))}
              style={{ flex: 1 }}
            />
          </label>
          <label className="gcl-row">
            <input
              type="checkbox"
              checked={corrected}
              onChange={(event) => setCorrected(event.target.checked)}
            />
            False discovery rate correction
          </label>
        </div>

        <DemoMap {...CONVECTIVE_VIEW}>
          <VectorLayer
            id="hotspots"
            data={analysis?.features ?? null}
            pointColor={['get', 'gi_color']}
            pointRadius={[
              'interpolate',
              ['linear'],
              ['abs', ['get', 'gi_z_score']],
              0,
              2.5,
              4,
              8,
            ]}
            pointStrokeWidth={0}
            hitRadius={12}
            opacity={0.92}
          />
          <GeoLegend
            title="Cluster significance"
            subtitle={`Gi* · ${bandwidthKm} km band`}
            classes={hotspotLegendClasses()}
            placement="bottom-right"
            collapsible
          />
          <GeoHover
            layerIds={['hotspots-hit']}
            sections={(state) => {
              const properties = state.features[0]?.properties;
              if (!properties) return [];
              return [
                {
                  title: String(properties['gi_cluster']),
                  accentColor: String(properties['gi_color']),
                  rows: [
                    {
                      label: 'Observed',
                      value: Number(properties[VALUE_PROPERTY]),
                      unit: '%',
                    },
                    {
                      label: 'z-score',
                      value: Number(properties['gi_z_score']).toFixed(2),
                    },
                    {
                      label: 'p-value',
                      value: Number(properties['gi_p_value']).toFixed(4),
                    },
                    {
                      label: 'Neighbours',
                      value: Number(properties['gi_neighbours']),
                    },
                  ],
                },
              ];
            }}
          />
        </DemoMap>

        <DemoSurface note="A result in which almost everything clusters usually means the band is too large; one in which almost nothing does usually means it is too small.">
          <div className="demo-readout">
            {analysis
              ? Object.entries(analysis.summary)
                  .map(([band, count]) => `${band.padEnd(18)} ${count}`)
                  .join('\n')
              : 'Computing…'}
          </div>
        </DemoSurface>
      </div>
    );
  },
};

/** Choosing a band from the observations' own spacing. */
export const BandwidthSelection: Story = {
  render: () => {
    const sample = useSample();
    const suggestion = useMemo(
      () => (sample ? suggestBandwidthKm(sample.positions) : null),
      [sample],
    );

    return (
      <DemoSurface note="The maximum nearest-neighbour distance is the smallest band that leaves no observation isolated. It is driven by the single most isolated observation, so inspect the percentiles before adopting it.">
        <div className="demo-readout">
          {suggestion
            ? [
                `observations      ${sample?.positions.length}`,
                `median nearest    ${suggestion.medianNearestKm.toFixed(2)} km   typical spacing`,
                `p90 nearest       ${suggestion.p90NearestKm.toFixed(2)} km   common compromise`,
                `max nearest       ${suggestion.maxNearestKm.toFixed(2)} km   no observation isolated`,
              ].join('\n')
            : 'Computing…'}
        </div>
      </DemoSurface>
    );
  },
};

/** Kernel density: where observations concentrate, as a continuous surface. */
export const DensitySurface: Story = {
  render: () => {
    const sample = useSample();
    const [bandwidthKm, setBandwidthKm] = useState(40);

    const surface = useMemo(() => {
      if (!sample || sample.positions.length === 0) return null;
      return kernelDensity(sample.positions, {
        bandwidthKm,
        kernel: 'quartic',
        weights: sample.values,
        width: 200,
      });
    }, [sample, bandwidthKm]);

    return (
      <div>
        <p className="demo-note">
          Weighted by observed probability, so the surface shows where high values
          concentrate rather than only where observations are dense. The result is
          a <code className="demo-code">RasterData</code>, rendered by the
          existing raster layer.
        </p>
        <label
          className="gcl-row"
          style={{ marginBottom: 10, fontSize: 12, maxWidth: 320 }}
        >
          band {bandwidthKm} km
          <input
            type="range"
            min={10}
            max={120}
            step={5}
            value={bandwidthKm}
            onChange={(event) => setBandwidthKm(Number(event.target.value))}
            style={{ flex: 1 }}
          />
        </label>
        <DemoMap {...CONVECTIVE_VIEW}>
          <RasterLayer
            data={surface}
            frameKey={`kde-${bandwidthKm}`}
            colorScale={[...PALETTES.magma]}
            smoothFactor={3}
            smoothEdges
            opacity={0.85}
          />
          <GeoLegend
            title="Weighted density"
            subtitle={`Quartic kernel · ${bandwidthKm} km`}
            colorScale={[...PALETTES.magma]}
            min={0}
            max={1}
            formatValue={(value) => (value === 0 ? 'low' : 'high')}
            ticks={2}
            placement="bottom-right"
          />
        </DemoMap>
      </div>
    );
  },
};

/** The four kernels, at one bandwidth. */
export const Kernels: Story = {
  render: () => {
    const sample = useSample();
    const surfaces = useMemo(() => {
      if (!sample || sample.positions.length === 0) return [];
      return (['quartic', 'epanechnikov', 'gaussian', 'uniform'] as const).map(
        (kernel) => ({
          kernel,
          surface: kernelDensity(sample.positions, {
            bandwidthKm: 45,
            kernel,
            width: 160,
          }),
        }),
      );
    }, [sample]);

    return (
      <div>
        <p className="demo-note">
          Kernel shape changes the surface's texture, not its structure. Uniform
          produces visible discs and is appropriate when the quantity is a count
          within a radius; the others differ mainly in how sharply influence falls
          off.
        </p>
        <div className="demo-grid">
          {surfaces.map(({ kernel, surface }) => (
            <DemoMap key={kernel} {...CONVECTIVE_VIEW} size="short" note={kernel}>
              <RasterLayer
                id={`kde-${kernel}`}
                data={surface}
                frameKey={`kde-kernel-${kernel}`}
                colorScale={[...PALETTES.viridis]}
                smoothFactor={2}
                opacity={0.88}
              />
            </DemoMap>
          ))}
        </div>
      </div>
    );
  },
};
