import type { CSSProperties, ReactNode } from 'react';
import {
  Button,
  Tooltip,
  cx,
  placementClass,
  type PanelPlacement,
} from '@hridayanp/ui';
import {
  CircleToolIcon,
  ClearIcon,
  FreehandToolIcon,
  LineToolIcon,
  PointToolIcon,
  PolygonToolIcon,
  RectangleToolIcon,
  SelectToolIcon,
  TrashIcon,
} from './icons';
import { formatArea, formatDistance, measureFeature } from './measure';
import {
  ALL_DRAW_MODES,
  useMapDraw,
  type DrawMode,
  type UseMapDrawOptions,
} from './useMapDraw';

const TOOLS: Record<DrawMode, { label: string; icon: ReactNode }> = {
  select: { label: 'Select and edit', icon: <SelectToolIcon /> },
  point: { label: 'Draw point', icon: <PointToolIcon /> },
  linestring: { label: 'Draw line', icon: <LineToolIcon /> },
  polygon: { label: 'Draw polygon', icon: <PolygonToolIcon /> },
  rectangle: { label: 'Draw rectangle', icon: <RectangleToolIcon /> },
  circle: { label: 'Draw circle', icon: <CircleToolIcon /> },
  freehand: { label: 'Draw freehand', icon: <FreehandToolIcon /> },
};

export interface DrawControlProps extends UseMapDrawOptions {
  /** Corner of the map to dock to. Default `'top-left'`. */
  placement?: PanelPlacement;
  orientation?: 'vertical' | 'horizontal';
  /**
   * Show area, perimeter, length and radius of the selected (or most recent)
   * shape beneath the toolbar. Default `true`.
   */
  showMeasurements?: boolean;
  /** Show the delete-selected and clear-all buttons. Default `true`. */
  showDeleteControls?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * A docked drawing toolbar: one button per tool, delete and clear, and a
 * geodesic measurement readout.
 *
 * ```tsx
 * <MapContainer ...>
 *   <DrawControl
 *     modes={['polygon', 'rectangle', 'circle', 'select']}
 *     singleFeature
 *     onChange={(features) => setAreaOfInterest(features[0] ?? null)}
 *   />
 * </MapContainer>
 * ```
 *
 * Clicking the active tool again returns the map to panning. Keyboard: `Esc`
 * cancels a shape in progress, `Enter` finishes a line or polygon — terra-draw's
 * defaults.
 */
export function DrawControl({
  placement = 'top-left',
  orientation = 'vertical',
  showMeasurements = true,
  showDeleteControls = true,
  className,
  style,
  modes = ALL_DRAW_MODES,
  ...options
}: DrawControlProps) {
  const draw = useMapDraw({ ...options, modes });
  const tooltipSide = placement.endsWith('right') ? 'left' : 'right';

  const focus =
    draw.features.find((feature) => feature.id === draw.selectedId) ??
    draw.features[draw.features.length - 1] ??
    null;
  const measurement = focus ? measureFeature(focus) : null;

  const readout: string[] = [];
  if (measurement?.radiusKm != null) readout.push(`Radius ${formatDistance(measurement.radiusKm)}`);
  if (measurement?.areaKm2 != null) readout.push(`Area ${formatArea(measurement.areaKm2)}`);
  if (measurement?.perimeterKm != null) readout.push(`Perimeter ${formatDistance(measurement.perimeterKm)}`);
  if (measurement?.lengthKm != null) readout.push(`Length ${formatDistance(measurement.lengthKm)}`);
  if (measurement?.center && readout.length === 0) {
    readout.push(`${measurement.center[1].toFixed(4)}, ${measurement.center[0].toFixed(4)}`);
  }

  return (
    <div
      className={cx(
        'gcl-controls',
        `gcl-controls--${orientation}`,
        'gcl-draw',
        placementClass(placement),
        className,
      )}
      style={style}
    >
      <div className="gcl-controls__group" role="toolbar" aria-label="Drawing tools">
        {modes.map((tool) => {
          const { label, icon } = TOOLS[tool];
          const active = draw.mode === tool;
          return (
            <Tooltip key={tool} label={label} side={tooltipSide}>
              <Button
                aria-label={label}
                aria-pressed={active}
                active={active}
                disabled={!draw.ready}
                onClick={() => draw.setMode(active ? null : tool)}
              >
                {icon}
              </Button>
            </Tooltip>
          );
        })}
      </div>

      {showDeleteControls && (
        <div className="gcl-controls__group">
          <Tooltip label="Delete selected" side={tooltipSide}>
            <Button
              aria-label="Delete selected shape"
              disabled={draw.selectedId == null}
              onClick={draw.removeSelected}
            >
              <TrashIcon />
            </Button>
          </Tooltip>
          <Tooltip label="Clear all" side={tooltipSide}>
            <Button
              aria-label="Clear all shapes"
              disabled={draw.features.length === 0}
              onClick={draw.clear}
            >
              <ClearIcon />
            </Button>
          </Tooltip>
        </div>
      )}

      {showMeasurements && readout.length > 0 && (
        <div className="gcl-panel gcl-draw__readout" aria-live="polite">
          {readout.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
