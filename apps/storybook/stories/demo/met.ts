/**
 * Synthetic meteorological datasets for the chart stories.
 *
 * Generated in the browser, deterministically, for the same reason as the rest
 * of the demo data: if the documentation needed a backend, the library would
 * too. The shapes are physically plausible — a moist tropical sounding with a
 * veering, strengthening wind profile, a diurnal temperature cycle with
 * afternoon showers — so the charts show what they are for.
 */

import type { SoundingLevel } from '@hridayanp/met-charts';
import { makeRandom } from './data';

const PRESSURES = [1000, 975, 950, 925, 900, 850, 800, 750, 700, 650, 600, 550, 500, 450, 400, 350, 300, 250, 200, 150, 100];

/** A pre-monsoon sounding: warm, moist boundary layer, dry mid-levels, veering wind. */
export function makeSounding(): SoundingLevel[] {
  return PRESSURES.map((pressure) => {
    const height = 44330 * (1 - (pressure / 1013.25) ** 0.1903);
    const temperature =
      pressure > 200 ? 31 - 6.6 * (height / 1000) + (pressure > 850 ? 0 : 1.2) : -55 + (200 - pressure) * 0.05;
    const depression = pressure > 850 ? 4 + (1000 - pressure) * 0.02 : pressure > 600 ? 9 + (850 - pressure) * 0.04 : 22;
    const windSpeed = 6 + (1000 - pressure) * 0.075 + (pressure < 300 && pressure > 150 ? 22 : 0);
    const windDirection = (160 + (1000 - pressure) * 0.14) % 360;
    return {
      pressure,
      height: Math.round(height),
      temperature: Math.round(temperature * 10) / 10,
      dewpoint: Math.round((temperature - depression) * 10) / 10,
      windSpeed: Math.round(windSpeed),
      windDirection: Math.round(windDirection),
    };
  });
}

/** Hourly wind observations with a prevailing south-westerly. */
export function makeWindSamples(count = 2000, seed = 4): { direction: number; speed: number }[] {
  const random = makeRandom(seed);
  return Array.from({ length: count }, () => {
    const prevailing = random() < 0.65;
    const direction = prevailing ? 225 + (random() - 0.5) * 70 : random() * 360;
    const speed = prevailing ? 6 + random() * 22 : random() * 10;
    return { direction: (direction + 360) % 360, speed: random() < 0.05 ? 0 : speed };
  });
}

/** 72 hours of hourly point-forecast values. */
export function makeMeteogram(hours = 72) {
  const random = makeRandom(9);
  const start = Date.UTC(2026, 9, 30, 0);
  const times = Array.from({ length: hours }, (_, i) => start + i * 3600_000);
  const temperature = times.map((_, i) => 26 + 6 * Math.sin(((i - 9) / 24) * Math.PI * 2) + (random() - 0.5));
  const dewpoint = temperature.map((t) => t - 4 - random() * 2);
  const rain = times.map((_, i) => {
    const hour = i % 24;
    return hour >= 10 && hour <= 14 && random() > 0.4 ? Math.round(random() * 60) / 10 : 0;
  });
  const pressure = times.map((_, i) => 1008 + 2 * Math.sin((i / 12) * Math.PI) - i * 0.04);
  const windSpeed = times.map((_, i) => 8 + 10 * Math.max(0, Math.sin(((i - 12) / 24) * Math.PI * 2)) + random() * 3);
  const windDirection = times.map((_, i) => (200 + i * 1.2) % 360);
  return { times, temperature, dewpoint, rain, pressure, windSpeed, windDirection };
}

/** Forecast–observation pairs with a warm bias and under-dispersion. */
export function makeVerificationPairs(count = 120) {
  const random = makeRandom(31);
  return Array.from({ length: count }, (_, i) => {
    const observed = 18 + random() * 18;
    const forecast = 0.82 * observed + 5 + (random() - 0.5) * 4;
    return { observed, forecast, label: `Station ${String((i % 40) + 1).padStart(2, '0')}` };
  });
}

/** A vertical section of relative humidity through a moist column. */
export function makeCrossSection() {
  const distancesKm = Array.from({ length: 60 }, (_, i) => i * 10);
  const levels = [1000, 950, 900, 850, 800, 750, 700, 650, 600, 550, 500, 450, 400, 350, 300, 250, 200];
  const values = levels.map((p) =>
    distancesKm.map((d) => {
      const column = Math.exp(-(((d - 300) / 120) ** 2));
      const depth = Math.max(0, (p - 250) / 750);
      return Math.min(100, Math.round(25 + 70 * column * depth ** 0.5 + 10 * depth));
    }),
  );
  return { distancesKm, levels, values };
}
