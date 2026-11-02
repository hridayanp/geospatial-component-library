import {
  useCallback,
  useEffect,
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
import { useSwipeDivider } from './useSwipeDivider';

/** How the two panes share the viewport. */
export type CompareMode =
  /** One viewport; the second pane is revealed by a draggable divider. */
  | 'swipe'
  /** Two viewports abreast, both fully visible. */
  | 'side-by-side';

export interface CompareMapsProps
  extends Omit<MapContainerProps, 'children' | 'className' | 'style'> {
  /** Layers and overlays rendered on the first (base) pane. */
  before: ReactNode;
  /** Layers and overlays rendered on the second (revealed) pane. */
  after: ReactNode;
  /** Presentation mode. Default `'swipe'`. */
  mode?: CompareMode;
  /** Split axis in swipe mode. Default `'vertical'`. */
  orientation?: 'vertical' | 'horizontal';
  /** Divider position as a fraction, `0..1`. Controlled. */
  position?: number;
  /** Initial divider position when uncontrolled. Default `0.5`. */
  defaultPosition?: number;
  onPositionChange?: (position: number) => void;
  /** Label rendered over the first pane — the epoch or scenario it shows. */
  beforeLabel?: ReactNode;
  /** Label rendered over the second pane. */
  afterLabel?: ReactNode;
  /**
   * Style specification for the second pane. Defaults to the shared `mapStyle`,
   * which is the usual case — the comparison is between layers, not basemaps.
   */
  afterMapStyle?: MapContainerProps['mapStyle'];
  /** Fired once both panes have loaded, with each map instance. */
  onReady?: (maps: { before: MapLibreMap; after: MapLibreMap }) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * Two synchronised maps presenting the same extent under different layers.
 *
 * The comparison is between what is *drawn*, so both panes share one view state:
 * panning or zooming either moves both, and the divider changes only how much of
 * the second pane is revealed. Each pane owns its own MapLibre instance and
 * context, so the layer components inside them are ordinary children with no
 * knowledge that they are being compared.
 *
 * ```tsx
 * <CompareMaps
 *   center={[87.2, 22.3]}
 *   zoom={6}
 *   beforeLabel="2017"
 *   afterLabel="2024"
 *   before={<RasterLayer data={epoch2017} frameKey="2017" colorScale={ramp} />}
 *   after={<RasterLayer data={epoch2024} frameKey="2024" colorScale={ramp} />}
 * />
 * ```
 *
 * ### Responsibilities
 *
 * The component owns pane layout, view-state synchronisation and divider
 * interaction. What each pane renders, and the data behind it, remain with the
 * consuming application.
 *
 * ### Interpretation
 *
 * Two rasters are only comparable when they share a colour domain. Passing a
 * different `min`/`max` to each pane produces a comparison in which a difference
 * in colour may mean a difference in scaling rather than in the data — the same
 * failure mode as an unfixed domain across an animated sequence.
 */
export function CompareMaps({
  before,
  after,
  mode = 'swipe',
  orientation = 'vertical',
  position,
  defaultPosition = 0.5,
  onPositionChange,
  beforeLabel,
  afterLabel,
  afterMapStyle,
  onReady,
  className,
  style,
  ...mapProps
}: CompareMapsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const beforeRef = useRef<MapContainerHandle>(null);
  const afterRef = useRef<MapContainerHandle>(null);

  const [beforeMap, setBeforeMap] = useState<MapLibreMap | null>(null);
  const [afterMap, setAfterMap] = useState<MapLibreMap | null>(null);

  const divider = useSwipeDivider({
    containerRef,
    defaultPosition,
    ...(position != null ? { position } : {}),
    ...(onPositionChange ? { onPositionChange } : {}),
    orientation,
  });

  useMapSync([beforeMap, afterMap]);

  const onLoad = mapProps.onLoad;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  const handleBeforeLoad = useCallback(
    (map: MapLibreMap) => {
      setBeforeMap(map);
      onLoad?.(map);
    },
    [onLoad],
  );
  const handleAfterLoad = useCallback((map: MapLibreMap) => {
    setAfterMap(map);
  }, []);

  useEffect(() => {
    if (beforeMap && afterMap) {
      readyRef.current?.({ before: beforeMap, after: afterMap });
    }
  }, [beforeMap, afterMap]);

  // Changing the split changes each pane's rendered size, and MapLibre sizes its
  // canvas from the container. Without an explicit resize the second pane keeps
  // the canvas it was created with and its content is scaled rather than
  // re-rendered — visible as a soft, offset copy of the first pane.
  useEffect(() => {
    beforeRef.current?.resize();
    afterRef.current?.resize();
  }, [divider.position, mode, orientation]);

  const sideBySide = mode === 'side-by-side';
  const percent = divider.position * 100;

  // `clip-path` rather than width: the revealed pane keeps its full viewport, so
  // both panes render the same extent at the same scale and the divider only
  // changes how much of the second is visible. Resizing it instead would give
  // the two panes different aspect ratios and break the comparison.
  const revealStyle: CSSProperties = sideBySide
    ? {}
    : orientation === 'horizontal'
      ? { clipPath: `inset(${percent}% 0 0 0)` }
      : { clipPath: `inset(0 0 0 ${percent}%)` };

  return (
    <div
      ref={containerRef}
      className={cx(
        'gcl-compare',
        sideBySide && `gcl-compare--split gcl-compare--${orientation}`,
        divider.dragging && 'gcl-compare--dragging',
        className,
      )}
      style={style}
    >
      <div className="gcl-compare__pane">
        <MapContainer {...mapProps} ref={beforeRef} onLoad={handleBeforeLoad}>
          {before}
        </MapContainer>
        {beforeLabel != null && (
          <div className="gcl-compare__label gcl-compare__label--before">
            {beforeLabel}
          </div>
        )}
      </div>

      <div
        className={cx(
          'gcl-compare__pane',
          !sideBySide && 'gcl-compare__pane--reveal',
        )}
        style={revealStyle}
      >
        <MapContainer
          {...mapProps}
          {...(afterMapStyle ? { mapStyle: afterMapStyle } : {})}
          ref={afterRef}
          onLoad={handleAfterLoad}
        >
          {after}
        </MapContainer>
        {afterLabel != null && (
          <div className="gcl-compare__label gcl-compare__label--after">
            {afterLabel}
          </div>
        )}
      </div>

      {!sideBySide && (
        <div
          {...divider.handleProps}
          className={cx(
            'gcl-compare__divider',
            `gcl-compare__divider--${orientation}`,
          )}
          style={
            orientation === 'horizontal'
              ? { top: `${percent}%` }
              : { left: `${percent}%` }
          }
        >
          <span className="gcl-compare__grip" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
              <path
                d="M6 3 2.5 8 6 13M10 3l3.5 5-3.5 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      )}
    </div>
  );
}
