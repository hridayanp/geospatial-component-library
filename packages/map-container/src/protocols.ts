import maplibregl from 'maplibre-gl';

const registered = new Set<string>();

/**
 * Register the `pmtiles://` protocol so styles can point at a single PMTiles
 * archive instead of a tile server.
 *
 * Safe to call repeatedly — registration is idempotent, which matters because
 * MapLibre throws when a protocol is registered twice and React Strict Mode
 * runs effects more than once in development.
 *
 * `pmtiles` is an optional peer dependency; install it only if you use this.
 */
export async function registerPMTilesProtocol(): Promise<boolean> {
  if (registered.has('pmtiles')) return true;
  try {
    const { Protocol } = await import('pmtiles');
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
    registered.add('pmtiles');
    return true;
  } catch (error) {
    console.warn(
      '[gcl] Could not register the pmtiles protocol. Install the optional peer dependency "pmtiles" to use pmtiles:// sources.',
      error,
    );
    return false;
  }
}

/**
 * Register the `cog://` protocol, which lets MapLibre read a Cloud-Optimised
 * GeoTIFF directly as a raster source — no pre-tiling, no server.
 *
 * Use this when the host already has a COG on object storage and wants the map
 * to stream it; use `@hridayanp/raster-layer` with decoded data when you need
 * control over the colour ramp, NoData handling or value inspection.
 *
 * `@geomatico/maplibre-cog-protocol` is an optional peer dependency.
 */
export async function registerCOGProtocol(): Promise<boolean> {
  if (registered.has('cog')) return true;
  try {
    const { cogProtocol } = await import('@geomatico/maplibre-cog-protocol');
    maplibregl.addProtocol('cog', cogProtocol);
    registered.add('cog');
    return true;
  } catch (error) {
    console.warn(
      '[gcl] Could not register the cog protocol. Install the optional peer dependency "@geomatico/maplibre-cog-protocol" to use cog:// sources.',
      error,
    );
    return false;
  }
}

/** Which optional protocols this page has registered so far. */
export function registeredProtocols(): string[] {
  return [...registered];
}
