import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  MapContainer,
  type MapContainerHandle,
  type MapContainerProps,
} from '@hridayanp/map-container';
import { cx } from '@hridayanp/ui';
import { useMapSync } from './useMapSync';

/** One pane of a synchronised grid. */
export interface MapGridPane {
  /** Stable identity. Also the React key. */
  id: string;
  /** Caption rendered over the pane — the epoch, scenario or variable it shows. */
  label?: ReactNode;
  /** Layers and overlays for this pane. */
  content: ReactNode;
  /** Style specification for this pane. Defaults to the shared `mapStyle`. */
  mapStyle?: MapContainerProps['mapStyle'];
}

export interface MapGridProps
  extends Omit<MapContainerProps, 'children' | 'className' | 'style'> {
  panes: readonly MapGridPane[];
  /** Columns in the grid. Defaults to `min(panes.length, 2)`. */
  columns?: number;
  /** Suspend view-state synchronisation. Default `true`. */
  synchronized?: boolean;
  onPaneClick?: (id: string) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * A grid of synchronised maps — small multiples over one extent.
 *
 * Where `CompareMaps` answers "what changed between two states", a grid answers
 * "how does this extent look across many". Small multiples are the appropriate
 * form once a comparison exceeds two states: a reader can hold two swipe
 * positions in mind, but not six, and faceting lets every state be seen at once
 * rather than remembered.
 *
 * ```tsx
 * <MapGrid
 *   center={[87.2, 22.3]}
 *   zoom={5}
 *   columns={3}
 *   panes={years.map((year) => ({
 *     id: year,
 *     label: year,
 *     content: (
 *       <RasterLayer data={byYear[year]} frameKey={year} colorScale={ramp}
 *                    min={0} max={50} />
 *     ),
 *   }))}
 * />
 * ```
 *
 * ### Interpretation
 *
 * Every pane must share one colour domain. Small multiples work because the
 * reader compares position and colour across panes without re-reading a legend;
 * a per-pane domain silently breaks that and makes the facets incomparable.
 *
 * ### Performance
 *
 * Each pane is an independent MapLibre instance with its own WebGL context.
 * Browsers cap the number of live contexts — commonly around sixteen — and the
 * oldest is discarded when the cap is exceeded, blanking a pane that is still on
 * screen. Beyond roughly six panes, prefer paginating the facets.
 */
export function MapGrid({
  panes,
  columns,
  synchronized = true,
  onPaneClick,
  className,
  style,
  ...mapProps
}: MapGridProps) {
  const handles = useRef(new Map<string, MapContainerHandle | null>());
  const [maps, setMaps] = useState<ReadonlyMap<string, MapLibreMap>>(new Map());

  const registerMap = useCallback((id: string, map: MapLibreMap) => {
    setMaps((current) => {
      if (current.get(id) === map) return current;
      const next = new Map(current);
      next.set(id, map);
      return next;
    });
  }, []);

  const instances = useMemo(
    () => panes.map((pane) => maps.get(pane.id) ?? null),
    [panes, maps],
  );

  useMapSync(instances, { enabled: synchronized });

  const resolvedColumns = columns ?? Math.min(panes.length || 1, 2);

  return (
    <div
      className={cx('gcl-map-grid', className)}
      style={
        {
          '--gcl-map-grid-columns': String(Math.max(1, resolvedColumns)),
          ...style,
        } as CSSProperties
      }
    >
      {panes.map((pane) => (
        <div
          key={pane.id}
          className="gcl-map-grid__pane"
          {...(onPaneClick
            ? {
                onClick: () => onPaneClick(pane.id),
                role: 'button',
                tabIndex: 0,
                onKeyDown: (event: React.KeyboardEvent) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onPaneClick(pane.id);
                  }
                },
              }
            : {})}
        >
          <MapContainer
            {...mapProps}
            {...(pane.mapStyle ? { mapStyle: pane.mapStyle } : {})}
            ref={(handle) => {
              handles.current.set(pane.id, handle);
            }}
            onLoad={(map) => {
              registerMap(pane.id, map);
              mapProps.onLoad?.(map);
            }}
          >
            {pane.content}
          </MapContainer>
          {pane.label != null && (
            <div className="gcl-map-grid__label">{pane.label}</div>
          )}
        </div>
      ))}
    </div>
  );
}
