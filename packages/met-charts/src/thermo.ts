/**
 * Thermodynamics for soundings: saturation, mixing ratio, adiabats, the
 * lifting condensation level and a surface-based parcel's CAPE and CIN.
 *
 * Formulas are the standard operational approximations — Bolton (1980) for
 * saturation vapour pressure and the LCL, and a pseudo-adiabatic lapse rate
 * integrated with second-order Runge–Kutta for moist ascent. They match
 * MetPy's defaults to within a few tenths of a degree over the troposphere,
 * which is finer than a Skew-T can be read. Temperatures are °C unless named
 * otherwise; pressures are hPa.
 */

const RD = 287.04; // J kg⁻¹ K⁻¹, dry air
const CP = 1005.7; // J kg⁻¹ K⁻¹
const LV = 2.501e6; // J kg⁻¹, latent heat of vaporisation
const EPSILON = 0.622;
const KAPPA = RD / CP;
const K = 273.15;

/** Saturation vapour pressure over water, hPa (Bolton 1980). */
export function saturationVaporPressure(temperatureC: number): number {
  return 6.112 * Math.exp((17.67 * temperatureC) / (temperatureC + 243.5));
}

/** Mixing ratio, kg/kg, from vapour pressure and total pressure (hPa). */
export function mixingRatio(vaporPressure: number, pressure: number): number {
  return (EPSILON * vaporPressure) / Math.max(1e-6, pressure - vaporPressure);
}

/** Saturation mixing ratio, kg/kg. */
export function saturationMixingRatio(temperatureC: number, pressure: number): number {
  return mixingRatio(saturationVaporPressure(temperatureC), pressure);
}

/** Temperature (°C) at which air at `pressure` saturates with mixing ratio `w` (kg/kg). */
export function temperatureAtMixingRatio(w: number, pressure: number): number {
  const e = (w * pressure) / (EPSILON + w);
  const ln = Math.log(e / 6.112);
  return (243.5 * ln) / (17.67 - ln);
}

/** Potential temperature, K. */
export function potentialTemperature(temperatureC: number, pressure: number): number {
  return (temperatureC + K) * (1000 / pressure) ** KAPPA;
}

/** Temperature (°C) on the dry adiabat `thetaK` at `pressure`. */
export function dryAdiabatTemperature(thetaK: number, pressure: number): number {
  return thetaK * (pressure / 1000) ** KAPPA - K;
}

/** Pseudo-adiabatic lapse rate dT/dp, K per hPa. */
function moistLapse(temperatureK: number, pressure: number): number {
  const ws = saturationMixingRatio(temperatureK - K, pressure);
  const numerator = RD * temperatureK + LV * ws;
  const denominator = CP + (LV * LV * ws * EPSILON) / (RD * temperatureK * temperatureK);
  return numerator / denominator / pressure;
}

/**
 * Follow a saturated parcel from (`temperatureC`, `fromPressure`) to each
 * pressure in `pressures` (any order), returning temperatures in °C.
 */
export function moistAdiabat(
  temperatureC: number,
  fromPressure: number,
  pressures: readonly number[],
  stepHpa = 5,
): number[] {
  return pressures.map((target) => {
    let t = temperatureC + K;
    let p = fromPressure;
    const direction = target < p ? -1 : 1;
    while ((target - p) * direction > 1e-9) {
      const dp = direction * Math.min(stepHpa, Math.abs(target - p));
      const k1 = moistLapse(t, p);
      const k2 = moistLapse(t + k1 * dp, p + dp);
      t += ((k1 + k2) / 2) * dp;
      p += dp;
    }
    return t - K;
  });
}

/** Lifting condensation level of a parcel (Bolton 1980, eq. 15). */
export function liftingCondensationLevel(
  temperatureC: number,
  dewpointC: number,
  pressure: number,
): { pressure: number; temperature: number } {
  const t = temperatureC + K;
  const td = Math.min(dewpointC, temperatureC) + K;
  const tLcl = 1 / (1 / (td - 56) + Math.log(t / td) / 800) + 56;
  return {
    pressure: pressure * (tLcl / t) ** (1 / KAPPA),
    temperature: tLcl - K,
  };
}

/** One level of a sounding. */
export interface SoundingLevel {
  /** Pressure, hPa. */
  pressure: number;
  /** Air temperature, °C. */
  temperature: number;
  /** Dewpoint, °C. Omit where it was not measured. */
  dewpoint?: number | null;
  /** Wind speed, knots. */
  windSpeed?: number | null;
  /** Direction the wind blows from, degrees. */
  windDirection?: number | null;
  /** Geopotential height, metres. */
  height?: number | null;
}

/** A lifted parcel and the indices derived from it. */
export interface ParcelAnalysis {
  /** Parcel temperature (°C) at each pressure of the input sounding. */
  path: { pressure: number; temperature: number }[];
  lcl: { pressure: number; temperature: number };
  /** Level of free convection, hPa — `null` if the parcel never becomes buoyant. */
  lfc: number | null;
  /** Equilibrium level, hPa — `null` without an LFC. */
  el: number | null;
  /** Convective available potential energy, J/kg. */
  cape: number;
  /** Convective inhibition, J/kg (≤ 0). */
  cin: number;
}

/**
 * Lift the lowest level of a sounding and measure its buoyancy.
 *
 * The parcel rises dry-adiabatically to its LCL and pseudo-adiabatically above.
 * CAPE and CIN integrate `Rd (Tparcel − Tenv) d ln p` over the sounding's own
 * levels, using temperature rather than virtual temperature — the textbook
 * definition, a few per cent below a virtual-temperature-corrected value.
 * Returns `null` when the lowest level has no dewpoint.
 */
export function analyzeParcel(levels: readonly SoundingLevel[]): ParcelAnalysis | null {
  const sorted = levels
    .filter((level) => Number.isFinite(level.pressure) && Number.isFinite(level.temperature))
    .slice()
    .sort((a, b) => b.pressure - a.pressure);
  const surface = sorted[0];
  if (!surface || surface.dewpoint == null || !Number.isFinite(surface.dewpoint)) return null;

  const lcl = liftingCondensationLevel(surface.temperature, surface.dewpoint, surface.pressure);
  const theta = potentialTemperature(surface.temperature, surface.pressure);

  // Moist ascent is integrated once, upward through every level above the LCL.
  const above = sorted.filter((level) => level.pressure < lcl.pressure).map((level) => level.pressure);
  const moist = moistAdiabat(lcl.temperature, lcl.pressure, above);
  let moistIndex = 0;
  const path = sorted.map((level) => ({
    pressure: level.pressure,
    temperature:
      level.pressure >= lcl.pressure
        ? dryAdiabatTemperature(theta, level.pressure)
        : moist[moistIndex++]!,
  }));

  let cape = 0;
  let cin = 0;
  let lfc: number | null = null;
  let el: number | null = null;
  for (let i = 1; i < sorted.length; i++) {
    const lower = sorted[i - 1]!;
    const upper = sorted[i]!;
    const buoyancyLower = path[i - 1]!.temperature - lower.temperature;
    const buoyancyUpper = path[i]!.temperature - upper.temperature;
    const mean = (buoyancyLower + buoyancyUpper) / 2;
    const layer = RD * mean * Math.log(lower.pressure / upper.pressure);

    if (upper.pressure < lcl.pressure && buoyancyUpper > 0 && lfc === null) {
      // Interpolate the crossing in ln p between the two levels.
      const f = buoyancyLower < 0 ? -buoyancyLower / (buoyancyUpper - buoyancyLower) : 0;
      lfc = Math.exp(Math.log(lower.pressure) + f * (Math.log(upper.pressure) - Math.log(lower.pressure)));
    }
    if (lfc !== null) {
      if (mean > 0) {
        cape += layer;
        el = upper.pressure;
      }
    } else if (mean < 0) {
      cin += layer;
    }
  }
  return { path, lcl, lfc, el, cape, cin: lfc === null ? 0 : cin };
}
