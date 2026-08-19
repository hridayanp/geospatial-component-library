import type { StyleSpecification } from 'maplibre-gl';

/**
 * A style with nothing in it but a background colour.
 *
 * This is the library's default so that a `<MapContainer>` never makes a
 * network request the host application did not ask for — which matters for
 * offline deployments, air-gapped installs and tests. Supply your own
 * `mapStyle` (or use {@link createRasterStyle}) to get a basemap.
 */
export function createBlankStyle(
  backgroundColor = '#0b1220',
): StyleSpecification {
  return {
    version: 8,
    name: 'gcl-blank',
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': backgroundColor },
      },
    ],
  };
}

/**
 * Build a style from a raster tile template.
 *
 * @param tiles - One or more `{z}/{x}/{y}` tile URL templates.
 * @param options.attribution - Required by most tile providers' terms of use;
 * pass it through rather than shipping a basemap with no credit.
 */
export function createRasterStyle(
  tiles: string | string[],
  options: {
    attribution?: string;
    tileSize?: number;
    minzoom?: number;
    maxzoom?: number;
    backgroundColor?: string;
  } = {},
): StyleSpecification {
  const {
    attribution,
    tileSize = 256,
    minzoom = 0,
    maxzoom = 19,
    backgroundColor = '#0b1220',
  } = options;

  return {
    version: 8,
    name: 'gcl-raster',
    sources: {
      basemap: {
        type: 'raster',
        tiles: Array.isArray(tiles) ? tiles : [tiles],
        tileSize,
        minzoom,
        maxzoom,
        ...(attribution ? { attribution } : {}),
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': backgroundColor },
      },
      {
        id: 'basemap',
        type: 'raster',
        source: 'basemap',
        minzoom,
        maxzoom,
      },
    ],
  };
}

/**
 * Add a PMTiles-backed vector source and a line layer to an existing style.
 *
 * Vector boundary overlays are the one basemap addition that shows up in
 * practically every deployment, so it is worth a helper rather than asking
 * every host to hand-write the source spec. Requires the `pmtiles` protocol to
 * be registered first — see `registerPMTilesProtocol`.
 */
export function withPMTilesOutline(
  style: StyleSpecification,
  options: {
    url: string;
    sourceLayer: string;
    id?: string;
    color?: string;
    width?: number;
  },
): StyleSpecification {
  const { url, sourceLayer, id = 'outline', color = '#94a3b8', width = 1 } = options;
  return {
    ...style,
    sources: {
      ...style.sources,
      [id]: {
        type: 'vector',
        url: url.startsWith('pmtiles://') ? url : `pmtiles://${url}`,
      },
    },
    layers: [
      ...style.layers,
      {
        id,
        type: 'line',
        source: id,
        'source-layer': sourceLayer,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': color, 'line-width': width },
      },
    ],
  };
}

/** The default style: a blank background, no network requests. */
export const DEFAULT_MAP_STYLE: StyleSpecification = createBlankStyle();
