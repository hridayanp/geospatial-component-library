import { useMemo } from 'react';
import type { StyleSpecification } from 'maplibre-gl';
import type { Bounds } from '@hridayanp/geo-utils';
import { MapContainer } from '@hridayanp/map-container';
import { RasterLayer } from '@hridayanp/raster-layer';
import { VectorLayer } from '@hridayanp/vector-layer';
import { WindParticleLayer, type WindField } from '@hridayanp/wind-particle-layer';
import { GeoLegend, GeoLegendStack } from '@hridayanp/geo-legend';
import { MapControlBar, ZoomControl } from '@hridayanp/map-controls';
import type { RasterData } from '@hridayanp/raster-utils';

/**
 * The landing-page demo.
 *
 * This renders the real packages, resolved through the workspace — not a
 * screenshot and not a Storybook iframe. It is therefore also a smoke test:
 * if the composition breaks, the front page shows it.
 *
 * All data is generated below. Nothing is fetched.
 */

const BOUNDS: Bounds = [88, 22, 96, 29];

const PALETTE = ['#0b2545', '#134074', '#8da9c4', '#f4d35e', '#ee964b', '#c1121f'];
const WIND_COLORS = ['#bae6fd', '#7dd3fc', '#facc15', '#fb923c', '#ef4444'];

function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function makeRaster(): RasterData {
  const width = 110;
  const height = 96;
  const random = makeRandom(17);
  const blobs = Array.from({ length: 5 }, () => ({
    x: random(),
    y: random(),
    radius: 0.1 + random() * 0.2,
    weight: 0.4 + random() * 0.6,
  }));

  const data = new Float32Array(width * height);
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const nx = column / (width - 1);
      const ny = row / (height - 1);
      let value = 0;
      for (const blob of blobs) {
        const distanceSq = (nx - blob.x) ** 2 + (ny - blob.y) ** 2;
        value += blob.weight * Math.exp(-distanceSq / (2 * blob.radius ** 2));
      }
      data[row * width + column] = Math.min(100, value * 85);
    }
  }
  return { data, width, height, bounds: BOUNDS, noData: -9999 };
}

function makeWindField(): WindField {
  const width = 64;
  const height = 56;
  const u = new Float32Array(width * height);
  const v = new Float32Array(width * height);
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const dx = column / (width - 1) - 0.5;
      const dy = row / (height - 1) - 0.5;
      const distance = Math.hypot(dx, dy) + 1e-6;
      const swirl = Math.exp(-distance * 3) * 38;
      const index = row * width + column;
      u[index] = (-dy / distance) * swirl + 7;
      v[index] = (dx / distance) * swirl;
    }
  }
  return { kind: 'field', u, v, width, height, bounds: BOUNDS };
}

function makeOutline() {
  const random = makeRandom(9);
  const ring = (cx: number, cy: number, radius: number) =>
    Array.from({ length: 13 }, (_, index) => {
      const angle = ((index % 12) / 12) * Math.PI * 2;
      const wobble = 0.75 + random() * 0.5;
      return [cx + Math.cos(angle) * radius * wobble, cy + Math.sin(angle) * radius * wobble * 0.8];
    });

  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [ring(90.6, 25.4, 1.1)] },
        properties: { color: '#38bdf8' },
      },
      {
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [ring(93.8, 26.8, 0.9)] },
        properties: { color: '#a78bfa' },
      },
    ],
  };
}

const BASEMAP: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#080d18' },
    },
  ],
};

export function HeroMap() {
  const raster = useMemo(makeRaster, []);
  const field = useMemo(makeWindField, []);
  const outline = useMemo(makeOutline, []);

  return (
    <div className="docs-hero__map">
      <MapContainer center={[92, 25.5]} zoom={5.4} mapStyle={BASEMAP} attributionControl={false}>
        <RasterLayer
          data={raster}
          colorScale={PALETTE}
          min={0}
          max={100}
          opacity={0.82}
          smoothFactor={6}
          smoothEdges
        />
        <VectorLayer
          data={outline}
          fill={false}
          stroke={['coalesce', ['get', 'color'], '#94a3b8']}
          strokeWidth={1.4}
          strokeDasharray={[3, 2]}
        />
        <WindParticleLayer
          data={field}
          particleCount={2200}
          maxSpeed={40}
          colors={WIND_COLORS}
          width={1.2}
          maxAge={50}
        />
        <GeoLegendStack placement="bottom-right">
          <GeoLegend
            title="Intensity"
            colorScale={PALETTE}
            min={0}
            max={100}
            unit="index"
            ticks={3}
          />
          <GeoLegend title="Wind" colorScale={WIND_COLORS} min={0} max={40} unit="kt" ticks={3} />
        </GeoLegendStack>
        <MapControlBar placement="top-right">
          <ZoomControl />
        </MapControlBar>
      </MapContainer>
    </div>
  );
}
