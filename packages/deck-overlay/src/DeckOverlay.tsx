import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { MapboxOverlay } from '@deck.gl/mapbox';
import type { Layer } from '@deck.gl/core';
import type { IControl } from 'maplibre-gl';
import { useMap } from '@hridayanp/map-container';

/** A deck.gl layer, or a falsy placeholder that is filtered out. */
export type DeckLayer = Layer | null | undefined | false;

interface DeckRegistry {
  register(id: string, layers: DeckLayer[]): void;
  unregister(id: string): void;
}

const DeckOverlayContext = createContext<DeckRegistry | null>(null);

export interface DeckOverlayProps {
  /**
   * Draw deck.gl layers *inside* the MapLibre render pass, so basemap labels
   * can sit above data and depth testing works. `false` composites deck on top
   * of the map instead, which is faster but always draws over everything.
   * Default `true`.
   */
  interleaved?: boolean;
  /** With `interleaved`, insert deck's draw call below this MapLibre layer. */
  beforeId?: string;
  /** Layers contributed directly, in addition to any registered by children. */
  layers?: DeckLayer[];
  children?: ReactNode;
}

/**
 * Hosts a single `MapboxOverlay` for every deck.gl layer in the subtree.
 *
 * Sharing one overlay matters: each additional overlay is a separate deck.gl
 * instance with its own animation loop and picking pass, so a map with three
 * deck layers should still have exactly one of them.
 *
 * Using this component is optional — {@link useDeckLayers} falls back to
 * creating a private overlay when no host is present, so a single deck-based
 * layer still works when dropped straight into a `<MapContainer>`.
 */
export function DeckOverlay({
  interleaved = true,
  beforeId,
  layers: ownLayers,
  children,
}: DeckOverlayProps) {
  const [registered, setRegistered] = useState<Record<string, DeckLayer[]>>({});

  const registry = useMemo<DeckRegistry>(
    () => ({
      register(id, layers) {
        setRegistered((current) => ({ ...current, [id]: layers }));
      },
      unregister(id) {
        setRegistered((current) => {
          if (!(id in current)) return current;
          const next = { ...current };
          delete next[id];
          return next;
        });
      },
    }),
    [],
  );

  const allLayers = useMemo(() => {
    const collected: DeckLayer[] = [...(ownLayers ?? [])];
    // Sorting by registration key keeps draw order stable across renders
    // instead of depending on object-key insertion order.
    for (const id of Object.keys(registered).sort()) {
      collected.push(...(registered[id] ?? []));
    }
    return collected;
  }, [ownLayers, registered]);

  useDeckOverlayInstance(allLayers, interleaved, beforeId);

  return (
    <DeckOverlayContext.Provider value={registry}>
      {children}
    </DeckOverlayContext.Provider>
  );
}

/**
 * Contribute deck.gl layers to the enclosing {@link DeckOverlay}, or to a
 * private overlay when there is no host.
 *
 * @param id - Stable identity for this contribution. Two components using the
 * same id would overwrite each other, so make it unique per layer instance.
 */
export function useDeckLayers(
  id: string,
  layers: DeckLayer[],
  options: { interleaved?: boolean; beforeId?: string } = {},
): void {
  const registry = useContext(DeckOverlayContext);

  useEffect(() => {
    if (!registry) return;
    registry.register(id, layers);
  }, [registry, id, layers]);

  useEffect(() => {
    if (!registry) return;
    return () => registry.unregister(id);
  }, [registry, id]);

  // Only used when there is no host overlay to register with.
  useDeckOverlayInstance(
    registry ? null : layers,
    options.interleaved ?? true,
    options.beforeId,
  );
}

/**
 * Owns one `MapboxOverlay` bound to the enclosing map.
 *
 * Passing `null` disables it entirely, which is how {@link useDeckLayers}
 * stays inert when a host overlay is present.
 */
function useDeckOverlayInstance(
  layers: DeckLayer[] | null,
  interleaved: boolean,
  beforeId?: string,
): void {
  const { map, ready } = useMap();
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const enabled = layers !== null;

  const setProps = useCallback(
    (next: DeckLayer[]) => {
      overlayRef.current?.setProps({
        layers: next.filter(Boolean) as Layer[],
      });
    },
    [],
  );

  useEffect(() => {
    if (!map || !ready || !enabled) return;

    const overlay = new MapboxOverlay({
      interleaved,
      ...(interleaved && beforeId ? { beforeId } : {}),
      layers: [],
    });
    overlayRef.current = overlay;
    map.addControl(overlay as unknown as IControl);

    return () => {
      overlayRef.current = null;
      try {
        map.removeControl(overlay as unknown as IControl);
      } catch {
        /* the map may already be torn down */
      }
      overlay.finalize();
    };
  }, [map, ready, enabled, interleaved, beforeId]);

  useEffect(() => {
    if (!enabled || !layers) return;
    setProps(layers);
  }, [enabled, layers, setProps]);
}

export { DeckOverlayContext };
