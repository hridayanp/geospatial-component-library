import { useEffect, useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DeckOverlay } from '@hridayanp/deck-overlay';
import { GeoHover } from '@hridayanp/geo-hover';
import { GeoLegend, GeoLegendStack } from '@hridayanp/geo-legend';
import {
  FullscreenControl,
  MapControlBar,
  OpacityControl,
  ResetViewControl,
  ZoomControl,
} from '@hridayanp/map-controls';
import { RasterLayer, preloadRasterFrame } from '@hridayanp/raster-layer';
import { TimelineControl } from '@hridayanp/timeline-control';
import { VectorLayer } from '@hridayanp/vector-layer';
import { WindParticleLayer } from '@hridayanp/wind-particle-layer';
import { DemoMap } from './demo/DemoMap';
import { PALETTES } from './demo/data';
import {
  ASSET_FRAME_KEYS,
  CONVECTIVE_BOUNDS,
  CONVECTIVE_VIEW,
  WIND_BOUNDS,
  WIND_VIEW,
  loadConvectiveRaster,
  loadObservations,
  loadWindField,
  loadWindObservations,
  loadWindSpeedRaster,
} from './demo/assets';
import { useAsset } from './demo/useAsset';
import { deriveRasterSequence, deriveWindFields } from './demo/derive';

const WIND_COLORS = ['#bae6fd', '#7dd3fc', '#facc15', '#fb923c', '#ef4444'];
const MAX_SPEED = 36;
const OBSERVATION_FRAME_KEY = 'asset:wind_particle_vector.geojson';

const meta = {
  title: 'Composition Examples',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Layer components resolve the enclosing map through React context and register
their own sources and style layers, so composition is expressed as JSX nesting.
There is no layer manager, registry or ordering array to maintain.

### Draw order

MapLibre renders style layers in registration order, and layers register as they
mount, so JSX order is draw order: later siblings composite above earlier ones.
Where that is insufficient — because thematic data should sit beneath basemap
labels — \`beforeId\` inserts a layer below a named style layer.

A conventional stack, bottom to top: raster fields, polygon fills, flow
particles, then lines and points, with basemap labels above all of them via
\`beforeId\`. Legends, timelines and control bars are DOM overlays rather than
map layers, and render into an absolutely positioned container that is
transparent to pointer events.

### Shared rendering infrastructure

\`<DeckOverlay>\` is the one piece of shared infrastructure. Each
\`MapboxOverlay\` is a separate deck.gl instance with its own animation loop and
picking pass, so several deck-based layers should share one host.

### State ownership

A composed map generally holds one temporal index and one opacity value in
application state, supplied to every layer that needs them. No package holds a
second copy: \`OpacityControl\` and \`TimelineControl\` are controlled, and the
layers read the same values.

### Data used in these stories

All four sample datasets in \`assets/\`: the convective probability band and its
observation points over 84.339, 19.590, 90.139, 25.090, and the wind-speed band
and wind observations over 67.875, 5.875, 97.875, 37.875. Each is decoded once
and shared across stories.
        `,
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** A gridded field beneath discrete observations of the same phenomenon. */
export const RasterAndVector: Story = {
  render: () => {
    const { value: raster } = useAsset(loadConvectiveRaster);
    const { value: observations } = useAsset(loadObservations);
    return (
      <DemoMap
        {...CONVECTIVE_VIEW}
        note="Two layers, one map, and no coupling between them: the raster layer has no knowledge that the vector layer exists."
      >
        <RasterLayer
          data={raster}
          frameKey={ASSET_FRAME_KEYS.convective}
          colorScale={[...PALETTES.ocean]}
          min={0}
          max={50}
          opacity={0.85}
        />
        <VectorLayer
          data={observations}
          pointRadius={2.5}
          pointColor="#f8fafc"
          pointStrokeWidth={0}
          opacity={0.6}
        />
        <GeoLegend
          title="Convective probability"
          colorScale={[...PALETTES.ocean]}
          min={0}
          max={50}
          unit="%"
          ticks={5}
          placement="bottom-right"
        />
      </DemoMap>
    );
  },
};

/**
 * Magnitude carried by a raster band, direction carried by flow particles —
 * two encodings of one vector field.
 */
export const RasterAndWind: Story = {
  render: () => {
    const { value: speed } = useAsset(loadWindSpeedRaster);
    const { value: field } = useAsset(loadWindField);
    return (
      <DemoMap
        {...WIND_VIEW}
        note="The pairing works because neither layer knows about the other; both read from application state through props."
      >
        <RasterLayer
          data={speed}
          frameKey={ASSET_FRAME_KEYS.windSpeed}
          colorScale={[...PALETTES.heat]}
          min={0}
          max={30}
          opacity={0.7}
        />
        <WindParticleLayer
          data={field}
          particleCount={2200}
          maxSpeed={MAX_SPEED}
          color={[226, 232, 240, 230]}
          width={1.2}
        />
        <GeoLegendStack placement="bottom-right">
          <GeoLegend
            title="Wind speed"
            colorScale={[...PALETTES.heat]}
            min={0}
            max={30}
            unit="kt"
            ticks={3}
          />
        </GeoLegendStack>
      </DemoMap>
    );
  },
};

/** Raster, vector and particle layers in one composition. */
export const RasterVectorAndWind: Story = {
  render: () => {
    const { value: speed } = useAsset(loadWindSpeedRaster);
    const { value: observations } = useAsset(loadWindObservations);
    const points = useMemo(
      () =>
        observations
          ? ({
              kind: 'points',
              data: observations,
              speedProperty: 'wind_speed_kt',
              directionProperty: 'wind_dir_deg',
              frameKey: OBSERVATION_FRAME_KEY,
            } as const)
          : null,
      [observations],
    );
    return (
      <DemoMap
        {...WIND_VIEW}
        size="tall"
        note="Draw order follows mount order. Each layer controls its own opacity and visibility independently."
      >
        <RasterLayer
          data={speed}
          frameKey={ASSET_FRAME_KEYS.windSpeed}
          colorScale={[...PALETTES.ocean]}
          min={0}
          max={30}
          opacity={0.7}
        />
        <VectorLayer
          data={observations}
          pointRadius={1.5}
          pointColor="#e2e8f0"
          pointStrokeWidth={0}
          opacity={0.35}
        />
        <WindParticleLayer
          data={points}
          particleCount={2000}
          maxSpeed={MAX_SPEED}
          colors={WIND_COLORS}
          width={1.3}
        />
        <GeoLegendStack placement="bottom-right">
          <GeoLegend
            title="Wind speed (grid)"
            colorScale={[...PALETTES.ocean]}
            min={0}
            max={30}
            unit="kt"
          />
          <GeoLegend
            title="Particle speed"
            colorScale={WIND_COLORS}
            min={0}
            max={MAX_SPEED}
            unit="kt"
          />
        </GeoLegendStack>
        <MapControlBar placement="top-right">
          <ZoomControl />
          <FullscreenControl />
        </MapControlBar>
      </DemoMap>
    );
  },
};

/**
 * Two particle layers sharing one deck.gl instance, over a low-contrast
 * magnitude band.
 */
export const SharedDeckOverlay: Story = {
  render: () => {
    const { value: speed } = useAsset(loadWindSpeedRaster);
    const { value: base } = useAsset(loadWindField);
    const levels = useMemo(() => (base ? deriveWindFields(base, 2) : []), [base]);
    return (
      <DemoMap
        {...WIND_VIEW}
        note="Without the wrapper each layer would provision its own MapboxOverlay — a separate deck.gl instance, animation loop and picking pass drawing to the same canvas."
      >
        <RasterLayer
          data={speed}
          frameKey={ASSET_FRAME_KEYS.windSpeed}
          colorScale={[...PALETTES.mono]}
          min={0}
          max={30}
          opacity={0.35}
        />
        <DeckOverlay>
          <WindParticleLayer
            id="surface"
            data={levels[0] ?? null}
            particleCount={1400}
            color={[125, 211, 252, 220]}
            width={1}
            maxSpeed={MAX_SPEED}
          />
          <WindParticleLayer
            id="upper"
            data={levels[1] ?? null}
            particleCount={1400}
            color={[248, 113, 113, 210]}
            width={1.8}
            maxAge={70}
            maxSpeed={MAX_SPEED}
          />
        </DeckOverlay>
        <GeoLegend
          title="Levels"
          classes={[
            { color: '#7dd3fc', label: 'Surface' },
            { color: '#f87171', label: 'Upper' },
          ]}
          placement="bottom-right"
        />
      </DemoMap>
    );
  },
};

/**
 * A full operational composition: a temporal raster sequence, an observation
 * overlay, flow particles, a legend stack, playback, view controls and pointer
 * inspection — driven by one index and one opacity value in application state.
 */
export const FullComposition: Story = {
  render: () => {
    const { value: baseRaster } = useAsset(loadConvectiveRaster);
    const { value: observations } = useAsset(loadObservations);
    const { value: baseField } = useAsset(loadWindField);

    const sequence = useMemo(
      () => (baseRaster ? deriveRasterSequence(baseRaster, 16) : []),
      [baseRaster],
    );
    const windFields = useMemo(
      () => (baseField ? deriveWindFields(baseField, 16) : []),
      [baseField],
    );

    const [index, setIndex] = useState(0);
    const [opacity, setOpacity] = useState(0.8);
    const [showWind, setShowWind] = useState(true);
    const active = sequence[index];

    // Prefetching is a host responsibility, because retrieval is a host
    // responsibility. Warming the next frame turns the next step into a swap.
    useEffect(() => {
      const next = sequence[(index + 1) % Math.max(1, sequence.length)];
      if (!next) return;
      void preloadRasterFrame(next.meta.raster, {
        colorScale: [...PALETTES.heat],
        min: 0,
        max: 50,
        frameKey: next.id,
      });
    }, [index, sequence]);

    return (
      <DemoMap
        {...CONVECTIVE_VIEW}
        size="tall"
        note="Nine packages over one map instance. A single index drives the raster sequence, the particle field and the legend footer."
      >
        {active && (
          <RasterLayer
            data={active.meta.raster}
            frameKey={active.id}
            colorScale={[...PALETTES.heat]}
            min={0}
            max={50}
            opacity={opacity}
          />
        )}

        {/*
          The observations lie on the same lattice as the band, so drawing all
          3,190 would obscure the field they describe. A filter keeps the source
          intact while restricting the draw to the higher-probability subset.
        */}
        <VectorLayer
          id="observations"
          data={observations}
          filter={['>=', ['get', 'thunderstorm_prob_pct'], 8]}
          pointRadius={3}
          pointColor="#e2e8f0"
          pointStrokeColor="#0f172a"
          pointStrokeWidth={0.75}
          opacity={0.85}
          hitRadius={12}
        />

        {showWind && (
          <WindParticleLayer
            data={windFields[index] ?? null}
            particleCount={1800}
            maxSpeed={MAX_SPEED}
            colors={WIND_COLORS}
            width={1.2}
            transitionMs={900}
          />
        )}

        <GeoLegendStack placement="bottom-right">
          <GeoLegend
            title="Convective probability"
            colorScale={[...PALETTES.heat]}
            min={0}
            max={50}
            unit="%"
            ticks={5}
            collapsible
            footer={active?.label}
          />
          {showWind && (
            <GeoLegend
              title="Wind speed"
              colorScale={WIND_COLORS}
              min={0}
              max={MAX_SPEED}
              unit="kt"
              ticks={3}
            />
          )}
        </GeoLegendStack>

        <MapControlBar placement="top-right">
          <ZoomControl />
          <OpacityControl
            value={opacity}
            onChange={setOpacity}
            label="Probability"
          />
          <ResetViewControl bounds={CONVECTIVE_BOUNDS} />
          <FullscreenControl />
        </MapControlBar>

        <div className="gcl-panel gcl-panel--floating gcl-panel--top-left">
          <div className="gcl-panel__body">
            <label className="gcl-row" style={{ fontSize: 12 }}>
              <input
                type="checkbox"
                checked={showWind}
                onChange={(event) => setShowWind(event.target.checked)}
              />
              Flow particles
            </label>
          </div>
        </div>

        <TimelineControl
          frames={sequence}
          index={index}
          onIndexChange={setIndex}
          frameDurationMs={500}
          placement="bottom-center"
        />

        <GeoHover
          layerIds={['observations-hit']}
          raster={active?.meta.raster ?? null}
          sampling="bilinear"
          sections={(state) => {
            const sections = [];
            if (state.value != null) {
              sections.push({
                title: 'Gridded field',
                accentColor: '#fb923c',
                rows: [
                  { label: 'Probability', value: state.value, unit: '%' },
                  {
                    label: 'Position',
                    value: `${state.lngLat[1].toFixed(3)}°, ${state.lngLat[0].toFixed(3)}°`,
                  },
                ],
              });
            }
            const properties = state.features[0]?.properties;
            if (properties) {
              sections.push({
                title: 'Observation',
                accentColor: '#38bdf8',
                rows: [
                  {
                    label: 'Gust',
                    value: Number(properties['wind_gust_kt']),
                    unit: 'kt',
                  },
                  {
                    label: 'Distance to cell',
                    value: Number(properties['thunderstorm_distance_km']),
                    unit: 'km',
                  },
                ],
              });
            }
            return sections;
          }}
        />
      </DemoMap>
    );
  },
};

/**
 * `beforeId` registers a layer below a named style layer, overriding the
 * mount-order default.
 */
export const DrawOrder: Story = {
  render: () => {
    const { value: speed } = useAsset(loadWindSpeedRaster);
    return (
      <div>
        <p className="demo-note">
          The demonstration basemap declares a <code className="demo-code">background</code>{' '}
          layer and a semi-transparent <code className="demo-code">osm</code>{' '}
          raster layer. On the left the field composites above both; on the right
          it is registered <em>below</em> the basemap tiles, so the tiles remain
          the topmost cartography.
        </p>
        <div className="demo-grid">
          <DemoMap {...WIND_VIEW} size="short" note="Default — mount order">
            <RasterLayer
              id="order-default"
              data={speed}
              frameKey={ASSET_FRAME_KEYS.windSpeed}
              colorScale={[...PALETTES.viridis]}
              min={0}
              max={30}
              opacity={0.85}
            />
          </DemoMap>
          <DemoMap {...WIND_VIEW} size="short" note={'beforeId="osm"'}>
            <RasterLayer
              id="order-before"
              data={speed}
              frameKey={ASSET_FRAME_KEYS.windSpeed}
              colorScale={[...PALETTES.viridis]}
              min={0}
              max={30}
              opacity={0.85}
              beforeId="osm"
            />
          </DemoMap>
        </div>
        <p className="demo-note" style={{ marginTop: 8 }}>
          Extent of the band: {WIND_BOUNDS.join(', ')} (EPSG:4326).
        </p>
      </div>
    );
  },
};
