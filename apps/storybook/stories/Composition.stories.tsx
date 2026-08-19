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
import {
  DEMO_BOUNDS,
  PALETTES,
  makePolygons,
  makeRaster,
  makeRasterSequence,
  makeWindField,
  makeWindPoints,
} from './demo/data';

const raster = makeRaster();
const polygons = makePolygons();
const field = makeWindField();
const stations = makeWindPoints();
const WIND_COLORS = ['#bae6fd', '#7dd3fc', '#facc15', '#fb923c', '#ef4444'];

const meta = {
  title: 'Composition Examples',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
The packages are independent, but they are designed to stack.

Every layer attaches itself through the map context, so composition is nothing
more than nesting. No package depends on another package's *domain*: the raster
layer does not know the wind layer exists, and the legend works with no map at
all.

The one shared piece of infrastructure is \`<DeckOverlay>\`, which lets several
deck.gl-based layers share a single deck instance instead of each creating
their own.
        `,
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Raster underneath, vector boundaries on top. */
export const RasterAndVector: Story = {
  render: () => (
    <DemoMap note="Two layers, one map, no coupling between them.">
      <RasterLayer
        data={raster}
        colorScale={[...PALETTES.ocean]}
        min={0}
        max={100}
        opacity={0.85}
      />
      <VectorLayer
        data={polygons}
        fill={false}
        stroke={['coalesce', ['get', 'color'], '#94a3b8']}
        strokeWidth={1.75}
      />
      <GeoLegend
        title="Rainfall"
        colorScale={[...PALETTES.ocean]}
        min={0}
        max={120}
        unit="mm"
        ticks={5}
        placement="bottom-right"
      />
    </DemoMap>
  ),
};

/** A scalar field with a flow field animating over it. */
export const RasterAndWind: Story = {
  render: () => (
    <DemoMap note="Raster carries magnitude; particles carry direction. The pairing works because neither layer knows about the other.">
      <RasterLayer
        data={raster}
        colorScale={[...PALETTES.heat]}
        min={0}
        max={100}
        opacity={0.7}
      />
      <WindParticleLayer
        data={field}
        particleCount={2200}
        maxSpeed={40}
        color={[226, 232, 240, 230]}
        width={1.2}
      />
      <GeoLegendStack placement="bottom-right">
        <GeoLegend
          title="Intensity"
          colorScale={[...PALETTES.heat]}
          min={0}
          max={100}
          ticks={3}
        />
      </GeoLegendStack>
    </DemoMap>
  ),
};

/** All three layer types at once. */
export const RasterVectorAndWind: Story = {
  render: () => (
    <DemoMap
      size="tall"
      note="Draw order follows mount order. Each layer independently controls its own opacity and visibility."
    >
      <RasterLayer
        data={raster}
        colorScale={[...PALETTES.ocean]}
        min={0}
        max={100}
        opacity={0.7}
      />
      <VectorLayer
        data={polygons}
        fill={['coalesce', ['get', 'color'], '#64748b']}
        fillOpacity={0.12}
        stroke={['coalesce', ['get', 'color'], '#94a3b8']}
        strokeWidth={1.5}
      />
      <WindParticleLayer
        data={{ kind: 'points', data: stations }}
        particleCount={2000}
        maxSpeed={40}
        colors={WIND_COLORS}
        width={1.3}
      />
      <GeoLegendStack placement="bottom-right">
        <GeoLegend
          title="Rainfall"
          colorScale={[...PALETTES.ocean]}
          min={0}
          max={120}
          unit="mm"
        />
        <GeoLegend
          title="Wind"
          colorScale={WIND_COLORS}
          min={0}
          max={40}
          unit="kt"
        />
      </GeoLegendStack>
      <MapControlBar placement="top-right">
        <ZoomControl />
        <FullscreenControl />
      </MapControlBar>
    </DemoMap>
  ),
};

/** Two deck.gl layers sharing one overlay. */
export const SharedDeckOverlay: Story = {
  render: () => (
    <DemoMap note="Without the wrapper each particle layer would create its own deck.gl instance, animation loop and picking pass. Wrapped, they share one.">
      <RasterLayer
        data={raster}
        colorScale={[...PALETTES.mono]}
        min={0}
        max={100}
        opacity={0.35}
      />
      <DeckOverlay>
        <WindParticleLayer
          id="surface"
          data={makeWindField({ maxSpeed: 22 })}
          particleCount={1400}
          color={[125, 211, 252, 220]}
          width={1}
        />
        <WindParticleLayer
          id="upper"
          data={makeWindField({ maxSpeed: 45, phase: 0.35 })}
          particleCount={1400}
          color={[248, 113, 113, 210]}
          width={1.8}
          maxAge={70}
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
  ),
};

/**
 * Everything together: animated raster, vector overlay, particles, legend
 * stack, timeline, controls and hover inspection.
 */
export const FullComposition: Story = {
  render: () => {
    const sequence = useMemo(() => makeRasterSequence(16), []);
    const windFields = useMemo(
      () => Array.from({ length: 16 }, (_, index) => makeWindField({ phase: index / 16 })),
      [],
    );
    const [index, setIndex] = useState(0);
    const [opacity, setOpacity] = useState(0.8);
    const [showWind, setShowWind] = useState(true);
    const active = sequence[index];

    // Prefetching is the host's job, because retrieval is the host's job.
    useEffect(() => {
      const next = sequence[(index + 1) % sequence.length];
      if (!next) return;
      void preloadRasterFrame(next.raster, {
        colorScale: [...PALETTES.heat],
        min: 0,
        max: 100,
        frameKey: next.id,
      });
    }, [index, sequence]);

    return (
      <DemoMap
        size="tall"
        note="Nine packages, one map, and not a single API call, store or route between them. Press play."
      >
        {active && (
          <RasterLayer
            data={active.raster}
            frameKey={active.id}
            colorScale={[...PALETTES.heat]}
            min={0}
            max={100}
            opacity={opacity}
          />
        )}

        <VectorLayer
          id="zones"
          data={polygons}
          fill={false}
          stroke={['coalesce', ['get', 'color'], '#94a3b8']}
          strokeWidth={1.5}
        />

        {showWind && (
          <WindParticleLayer
            data={windFields[index]}
            particleCount={1800}
            maxSpeed={40}
            colors={WIND_COLORS}
            width={1.2}
            transitionMs={900}
          />
        )}

        <GeoLegendStack placement="bottom-right">
          <GeoLegend
            title="Intensity"
            colorScale={[...PALETTES.heat]}
            min={0}
            max={100}
            unit="index"
            ticks={5}
            collapsible
            footer={active?.timestamp.slice(0, 16).replace('T', ' ') + ' UTC'}
          />
          {showWind && (
            <GeoLegend
              title="Wind"
              colorScale={WIND_COLORS}
              min={0}
              max={40}
              unit="kt"
              ticks={3}
            />
          )}
        </GeoLegendStack>

        <MapControlBar placement="top-right">
          <ZoomControl />
          <OpacityControl value={opacity} onChange={setOpacity} />
          <ResetViewControl bounds={DEMO_BOUNDS} />
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
              Wind particles
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
          layerIds={['zones-fill', 'zones-outline']}
          raster={active?.raster ?? null}
          sampling="bilinear"
          sections={(state) => {
            const sections = [];
            if (state.value != null) {
              sections.push({
                title: 'Intensity',
                accentColor: '#fb923c',
                rows: [
                  { label: 'Value', value: state.value, unit: 'index' },
                  {
                    label: 'Position',
                    value: `${state.lngLat[1].toFixed(2)}, ${state.lngLat[0].toFixed(2)}`,
                  },
                ],
              });
            }
            const zone = state.features[0]?.properties;
            if (zone) {
              sections.push({
                title: String(zone['name'] ?? 'Zone'),
                accentColor: String(zone['color'] ?? '#94a3b8'),
                rows: [{ label: 'Intensity', value: Number(zone['intensity']) }],
              });
            }
            return sections;
          }}
        />
      </DemoMap>
    );
  },
};
