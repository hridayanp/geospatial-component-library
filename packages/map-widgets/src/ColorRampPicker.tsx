import { useState } from 'react';
import { colorScaleToCss } from '@hridayanp/raster-utils';
import { Button, Popover, cx } from '@hridayanp/ui';

/** A named colour ramp: an ordered list of colours, low to high. */
export interface ColorRamp {
  id: string;
  label: string;
  colors: readonly string[];
  /** `'sequential'` for magnitudes, `'diverging'` for departures from a midpoint. */
  kind: 'sequential' | 'diverging' | 'cyclic';
}

/**
 * Perceptually ordered ramps suitable for scientific data.
 *
 * Viridis, Cividis, Magma, Inferno and Plasma are perceptually uniform and
 * readable with the common colour-vision deficiencies; Cividis is optimised
 * for them. The diverging ramps are ColorBrewer's. Rainbow-style ramps are
 * deliberately absent: they invent boundaries the data does not have.
 */
export const COLOR_RAMPS: readonly ColorRamp[] = [
  { id: 'viridis', label: 'Viridis', kind: 'sequential', colors: ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'] },
  { id: 'cividis', label: 'Cividis', kind: 'sequential', colors: ['#00224e', '#123570', '#3b496c', '#575d6d', '#707173', '#8a8678', '#a59c74', '#c3b369', '#e1cc55', '#fee838'] },
  { id: 'magma', label: 'Magma', kind: 'sequential', colors: ['#000004', '#180f3d', '#440f76', '#721f81', '#9e2f7f', '#cd4071', '#f1605d', '#fd9668', '#feca8d', '#fcfdbf'] },
  { id: 'inferno', label: 'Inferno', kind: 'sequential', colors: ['#000004', '#1b0c41', '#4a0c6b', '#781c6d', '#a52c60', '#cf4446', '#ed6925', '#fb9b06', '#f7d13d', '#fcffa4'] },
  { id: 'plasma', label: 'Plasma', kind: 'sequential', colors: ['#0d0887', '#46039f', '#7201a8', '#9c179e', '#bd3786', '#d8576b', '#ed7953', '#fb9f3a', '#fdca26', '#f0f921'] },
  { id: 'blues', label: 'Blues', kind: 'sequential', colors: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'] },
  { id: 'greens', label: 'Greens', kind: 'sequential', colors: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'] },
  { id: 'ylorrd', label: 'Yellow–Orange–Red', kind: 'sequential', colors: ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026'] },
  { id: 'ylgnbu', label: 'Yellow–Green–Blue', kind: 'sequential', colors: ['#ffffd9', '#edf8b1', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#253494', '#081d58'] },
  { id: 'rdbu', label: 'Red–Blue', kind: 'diverging', colors: ['#67001f', '#b2182b', '#d6604d', '#f4a582', '#fddbc7', '#f7f7f7', '#d1e5f0', '#92c5de', '#4393c3', '#2166ac', '#053061'] },
  { id: 'brbg', label: 'Brown–Teal', kind: 'diverging', colors: ['#543005', '#8c510a', '#bf812d', '#dfc27d', '#f6e8c3', '#f5f5f5', '#c7eae5', '#80cdc1', '#35978f', '#01665e', '#003c30'] },
  { id: 'piyg', label: 'Pink–Green', kind: 'diverging', colors: ['#8e0152', '#c51b7d', '#de77ae', '#f1b6da', '#fde0ef', '#f7f7f7', '#e6f5d0', '#b8e186', '#7fbc41', '#4d9221', '#276419'] },
  { id: 'spectral', label: 'Spectral', kind: 'diverging', colors: ['#9e0142', '#d53e4f', '#f46d43', '#fdae61', '#fee08b', '#ffffbf', '#e6f598', '#abdda4', '#66c2a5', '#3288bd', '#5e4fa2'] },
];

export interface ColorRampPickerProps {
  /** Id of the selected ramp. */
  value: string;
  /** Fired with the chosen ramp's id and its colours (reversed when `reversed`). */
  onChange: (id: string, colors: string[]) => void;
  /** Ramps to offer. Default {@link COLOR_RAMPS}. */
  ramps?: readonly ColorRamp[];
  /** Show only ramps of these kinds. */
  kinds?: ReadonlyArray<ColorRamp['kind']>;
  /** Whether the ramp runs high-to-low. */
  reversed?: boolean;
  /** Enables a reverse toggle. */
  onReversedChange?: (reversed: boolean) => void;
  /** Accessible name. Default `'Colour ramp'`. */
  label?: string;
  className?: string;
}

/**
 * Choose the colour ramp a layer and its legend are drawn with.
 *
 * Emits the colours themselves as well as the id, so the result plugs straight
 * into `colorScale` on `RasterLayer`, `DataTileLayer`, `ContourLayer` or
 * `GeoLegend` without a lookup.
 */
export function ColorRampPicker({
  value,
  onChange,
  ramps = COLOR_RAMPS,
  kinds,
  reversed = false,
  onReversedChange,
  label = 'Colour ramp',
  className,
}: ColorRampPickerProps) {
  const [open, setOpen] = useState(false);
  const offered = kinds ? ramps.filter((ramp) => kinds.includes(ramp.kind)) : ramps;
  const current = ramps.find((ramp) => ramp.id === value) ?? offered[0];

  const colorsOf = (ramp: ColorRamp, flip = reversed) =>
    flip ? [...ramp.colors].reverse() : [...ramp.colors];

  const gradient = (ramp: ColorRamp | undefined) =>
    ramp ? colorScaleToCss(colorsOf(ramp)) : 'transparent';

  return (
    <div className={cx('gcl-ramp-picker', className)}>
      <Popover
        side="bottom"
        align="start"
        open={open}
        onOpenChange={setOpen}
        trigger={
          <button
            type="button"
            className="gcl-ramp-picker__trigger"
            aria-label={`${label}: ${current?.label ?? 'none'}`}
          >
            <span className="gcl-ramp-picker__bar" style={{ background: gradient(current) }} />
            <span className="gcl-ramp-picker__name">{current?.label}</span>
          </button>
        }
      >
        <div className="gcl-ramp-picker__list" role="listbox" aria-label={label}>
          {offered.map((ramp) => (
            <button
              key={ramp.id}
              type="button"
              role="option"
              aria-selected={ramp.id === current?.id}
              className={cx('gcl-ramp-picker__option', ramp.id === current?.id && 'is-selected')}
              onClick={() => {
                onChange(ramp.id, colorsOf(ramp));
                setOpen(false);
              }}
            >
              <span className="gcl-ramp-picker__bar" style={{ background: gradient(ramp) }} />
              <span className="gcl-ramp-picker__name">{ramp.label}</span>
            </button>
          ))}
        </div>
      </Popover>
      {onReversedChange && (
        <Button
          variant="outline"
          size="sm"
          aria-pressed={reversed}
          active={reversed}
          onClick={() => {
            onReversedChange(!reversed);
            if (current) onChange(current.id, colorsOf(current, !reversed));
          }}
        >
          Reverse
        </Button>
      )}
    </div>
  );
}
