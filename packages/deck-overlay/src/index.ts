/**
 * `@hridayanp/deck-overlay`
 *
 * The one place in the library that knows how to get deck.gl layers onto a
 * MapLibre map. Keeping it in its own package means a raster or vector layer
 * never drags a WebGL rendering engine into a bundle that does not need one.
 */

export { DeckOverlay, DeckOverlayContext, useDeckLayers } from './DeckOverlay';
export type { DeckLayer, DeckOverlayProps } from './DeckOverlay';
