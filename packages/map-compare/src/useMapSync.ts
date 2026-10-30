import { useEffect, useRef } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';

/** Which parts of the view state participate in synchronisation. */
export interface MapSyncOptions {
  /** Synchronise centre and zoom. Default `true`. */
  center?: boolean;
  /** Synchronise bearing and pitch. Default `true`. */
  rotation?: boolean;
  /** Suspend synchronisation without unmounting. Default `true`. */
  enabled?: boolean;
}

/**
 * Keep several MapLibre instances on one view state.
 *
 * Comparison is only valid when the panes show the same ground at the same
 * scale, so the synchronisation is not a convenience — an unsynchronised
 * comparison invites the reader to attribute a difference in framing to a
 * difference in the data.
 *
 * Two properties make this correct rather than merely functional:
 *
 * **Re-entrancy guard.** Applying a camera to a follower fires that follower's
 * own `move` event, which would propagate back to the leader and on to every
 * other pane. Without the guard the maps oscillate until a gesture ends, and on
 * three or more panes the feedback compounds into visible stutter.
 *
 * **`jumpTo`, never `easeTo`.** An animated follower lags the leader by the
 * animation duration, so during a drag the panes show different ground —
 * precisely the state the synchronisation exists to prevent.
 *
 * The hook attaches to whatever maps are present in the array on each render, so
 * panes may mount and unmount freely.
 */
export function useMapSync(
  maps: ReadonlyArray<MapLibreMap | null | undefined>,
  options: MapSyncOptions = {},
): void {
  const { center = true, rotation = true, enabled = true } = options;

  // A ref rather than state: the guard is read and written inside an event
  // handler many times per gesture, and must never schedule a render.
  const syncing = useRef(false);

  const present = maps.filter((map): map is MapLibreMap => Boolean(map));
  // A stable dependency across renders that pass a fresh array of the same maps.
  const key = present.length;

  useEffect(() => {
    if (!enabled || present.length < 2) return;

    const handlers: Array<{ map: MapLibreMap; onMove: () => void }> = [];

    for (const leader of present) {
      const onMove = () => {
        if (syncing.current) return;
        syncing.current = true;
        try {
          const camera = {
            ...(center
              ? { center: leader.getCenter(), zoom: leader.getZoom() }
              : {}),
            ...(rotation
              ? { bearing: leader.getBearing(), pitch: leader.getPitch() }
              : {}),
          };
          for (const follower of present) {
            if (follower === leader) continue;
            follower.jumpTo(camera);
          }
        } finally {
          syncing.current = false;
        }
      };

      leader.on('move', onMove);
      handlers.push({ map: leader, onMove });
    }

    return () => {
      for (const { map, onMove } of handlers) map.off('move', onMove);
    };
    // `present` is rebuilt every render; its length plus the maps themselves are
    // the meaningful identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...present, center, rotation, enabled]);
}
