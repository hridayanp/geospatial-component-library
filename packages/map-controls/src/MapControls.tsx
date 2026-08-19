import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { StyleSpecification } from 'maplibre-gl';
import type { Bounds, ViewState } from '@hridayanp/geo-utils';
import { useMap } from '@hridayanp/map-container';
import {
  Button,
  CollapseIcon,
  ExpandIcon,
  MinusIcon,
  OpacityIcon,
  Panel,
  PlusIcon,
  Popover,
  Select,
  Slider,
  TargetIcon,
  Tooltip,
  cx,
  placementClass,
  type PanelPlacement,
} from '@hridayanp/ui';

/* ------------------------------------------------------------------ */
/* Container                                                           */
/* ------------------------------------------------------------------ */

export interface MapControlBarProps {
  /** Corner of the map to dock to. Default `'top-right'`. */
  placement?: PanelPlacement;
  orientation?: 'vertical' | 'horizontal';
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * Groups controls into one docked cluster.
 *
 * The bar is transparent to pointer events and its children opt back in, so
 * the map stays draggable in the gaps between control groups.
 */
export function MapControlBar({
  placement = 'top-right',
  orientation = 'vertical',
  className,
  style,
  children,
}: MapControlBarProps) {
  return (
    <div
      className={cx(
        'gcl-controls',
        `gcl-controls--${orientation}`,
        placementClass(placement),
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Zoom                                                                */
/* ------------------------------------------------------------------ */

export interface ZoomControlProps {
  /** Zoom levels per click. Default `1`. */
  step?: number;
  className?: string;
}

/** Zoom in and out buttons wired to the enclosing map. */
export function ZoomControl({ step = 1, className }: ZoomControlProps) {
  const { map } = useMap();
  const [zoom, setZoom] = useState<number | null>(null);

  // Track zoom so the buttons can disable themselves at the map's limits
  // instead of clicking with no visible effect.
  useEffect(() => {
    if (!map) return;
    const update = () => setZoom(map.getZoom());
    update();
    map.on('zoom', update);
    return () => {
      map.off('zoom', update);
    };
  }, [map]);

  const atMin = map != null && zoom != null && zoom <= map.getMinZoom() + 1e-6;
  const atMax = map != null && zoom != null && zoom >= map.getMaxZoom() - 1e-6;

  return (
    <div className={cx('gcl-controls__group', className)}>
      <Tooltip label="Zoom in" side="left">
        <Button
          aria-label="Zoom in"
          disabled={!map || atMax}
          onClick={() => map?.easeTo({ zoom: map.getZoom() + step, duration: 200 })}
        >
          <PlusIcon />
        </Button>
      </Tooltip>
      <Tooltip label="Zoom out" side="left">
        <Button
          aria-label="Zoom out"
          disabled={!map || atMin}
          onClick={() => map?.easeTo({ zoom: map.getZoom() - step, duration: 200 })}
        >
          <MinusIcon />
        </Button>
      </Tooltip>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reset view                                                          */
/* ------------------------------------------------------------------ */

export interface ResetViewControlProps {
  /** Camera to return to. Ignored when `bounds` is given. */
  view?: ViewState;
  /** Box to fit on reset. Takes precedence over `view`. */
  bounds?: Bounds;
  /** Padding in pixels when fitting `bounds`. Default `24`. */
  padding?: number;
  label?: string;
  className?: string;
}

/**
 * Return the camera to a known view.
 *
 * Worth having on any map a user can pan freely: getting lost is easy, and
 * finding your way back by hand is not.
 */
export function ResetViewControl({
  view,
  bounds,
  padding = 24,
  label = 'Reset view',
  className,
}: ResetViewControlProps) {
  const { map } = useMap();

  const reset = useCallback(() => {
    if (!map) return;
    if (bounds) {
      map.fitBounds(
        [
          [bounds[0], bounds[1]],
          [bounds[2], bounds[3]],
        ],
        { padding, duration: 500 },
      );
      return;
    }
    if (view) {
      map.flyTo({
        center: view.center,
        zoom: view.zoom,
        ...(view.bearing != null ? { bearing: view.bearing } : {}),
        ...(view.pitch != null ? { pitch: view.pitch } : {}),
        duration: 500,
      });
    }
  }, [map, bounds, view, padding]);

  return (
    <div className={cx('gcl-controls__group', className)}>
      <Tooltip label={label} side="left">
        <Button aria-label={label} disabled={!map} onClick={reset}>
          <TargetIcon />
        </Button>
      </Tooltip>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fullscreen                                                          */
/* ------------------------------------------------------------------ */

export interface FullscreenControlProps {
  /**
   * Element to expand. Defaults to the map's own container, which is usually
   * what you want — expanding a wrapper would leave overlays behind.
   */
  target?: HTMLElement | null;
  className?: string;
}

/** Toggle fullscreen for the map (or any element you nominate). */
export function FullscreenControl({ target, className }: FullscreenControlProps) {
  const { map } = useMap();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggle = useCallback(() => {
    const element =
      target ?? (map?.getContainer().parentElement as HTMLElement | null) ?? null;
    if (!element) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void element.requestFullscreen().catch((error: unknown) => {
        console.warn('[gcl] Fullscreen request was refused:', error);
      });
    }
    // The map's canvas size changes after the transition, not during it.
    window.setTimeout(() => map?.resize(), 150);
  }, [map, target]);

  const label = isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen';

  return (
    <div className={cx('gcl-controls__group', className)}>
      <Tooltip label={label} side="left">
        <Button aria-label={label} aria-pressed={isFullscreen} onClick={toggle}>
          {isFullscreen ? <CollapseIcon /> : <ExpandIcon />}
        </Button>
      </Tooltip>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Opacity                                                             */
/* ------------------------------------------------------------------ */

export interface OpacityControlProps {
  value: number;
  onChange: (value: number) => void;
  /** Shown above the slider. Default `'Opacity'`. */
  label?: string;
  /** Render inline instead of behind a popover button. Default `false`. */
  inline?: boolean;
  className?: string;
}

/**
 * An opacity slider, `0..1`.
 *
 * Controlled by design: opacity almost always belongs to the layer the host is
 * already managing, and a control that owned its own copy would immediately
 * disagree with it.
 */
export function OpacityControl({
  value,
  onChange,
  label = 'Opacity',
  inline = false,
  className,
}: OpacityControlProps) {
  const slider = (
    <div className={cx('gcl-opacity-control', className)}>
      <Slider
        aria-label={label}
        value={value}
        min={0}
        max={1}
        step={0.01}
        onValueChange={onChange}
      />
      <span className="gcl-opacity-control__value">
        {Math.round(value * 100)}%
      </span>
    </div>
  );

  if (inline) return slider;

  return (
    <div className="gcl-controls__group">
      <Popover
        side="left"
        trigger={
          <Button aria-label={label}>
            <OpacityIcon />
          </Button>
        }
      >
        <div style={{ minWidth: 168 }}>
          <div className="gcl-panel__title" style={{ marginBottom: 6 }}>
            {label}
          </div>
          {slider}
        </div>
      </Popover>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Basemap                                                             */
/* ------------------------------------------------------------------ */

export interface BasemapOption {
  id: string;
  label: string;
  style: StyleSpecification | string;
}

export interface BasemapSwitcherProps {
  options: BasemapOption[];
  value: string;
  onChange: (id: string, style: StyleSpecification | string) => void;
  /**
   * Apply the style to the map directly. Leave `false` when the host passes
   * `mapStyle` to `<MapContainer>` itself — otherwise the two fight.
   * Default `false`.
   */
  applyToMap?: boolean;
  className?: string;
}

/**
 * Switch between basemap styles.
 *
 * Note that swapping a style discards every source and layer that was added on
 * top of it. Layer packages in this library re-attach themselves automatically
 * afterwards; anything you added by hand needs to do the same.
 */
export function BasemapSwitcher({
  options,
  value,
  onChange,
  applyToMap = false,
  className,
}: BasemapSwitcherProps) {
  const { map } = useMap();

  return (
    <Panel className={className}>
      <Select
        aria-label="Basemap"
        value={value}
        options={options.map(({ id, label }) => ({ value: id, label }))}
        onValueChange={(id) => {
          const option = options.find((entry) => entry.id === id);
          if (!option) return;
          if (applyToMap && map) map.setStyle(option.style);
          onChange(id, option.style);
        }}
      />
    </Panel>
  );
}
