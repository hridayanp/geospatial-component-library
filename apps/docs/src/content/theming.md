Every colour, radius and font in the library is a CSS custom property. Theming
means overriding variables, not fighting specificity.

## The stylesheet

One import, anywhere in your application:

```ts
import '@hridayanp/ui/styles.css';
```

It ships from `@hridayanp/ui` and covers every visual package — legend, hover
card, timeline, controls and the shared primitives. Layer packages render
nothing to the DOM and need no CSS.

## No Tailwind, no CSS-in-JS

Class names are namespaced `gcl-` and shipped as one plain stylesheet. That is a
deliberate choice with three consequences:

- A consumer needs **no build configuration** — no PostCSS plugin, no content
  globs, no runtime style injection.
- The library **cannot leak** into your components, and yours cannot leak into
  it. Two isolated namespaces.
- The whole surface is **inspectable** — open devtools, read the variables,
  override what you want.

## Tokens

```css
:root {
  --gcl-bg: #ffffff;
  --gcl-bg-elevated: rgba(255, 255, 255, 0.92);
  --gcl-fg: #0f172a;
  --gcl-fg-muted: #64748b;
  --gcl-border: rgba(15, 23, 42, 0.12);
  --gcl-accent: #0ea5e9;
  --gcl-accent-fg: #ffffff;
  --gcl-track: rgba(15, 23, 42, 0.12);
  --gcl-shadow: 0 8px 24px rgba(15, 23, 42, 0.14);
  --gcl-radius: 8px;
  --gcl-radius-sm: 5px;
  --gcl-font: ui-sans-serif, system-ui, sans-serif;
  --gcl-font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  --gcl-space: 8px;
  --gcl-z-overlay: 40;
  --gcl-z-popover: 9999;
}
```

Override any of them anywhere in your cascade:

```css
:root {
  --gcl-accent: #7c3aed;
  --gcl-radius: 3px;
  --gcl-font: 'Inter', sans-serif;
}
```

Every panel, button, slider, legend and tooltip follows immediately.

## Light and dark

Set the attribute on any ancestor:

```html
<html data-gcl-theme="dark">
<html data-gcl-theme="light">
```

With **neither** set, the library follows the operating system:

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-gcl-theme='light']) { /* dark tokens */ }
}
```

Toggling at runtime is a single attribute write:

```ts
document.documentElement.setAttribute('data-gcl-theme', next);
```

Because everything is variables, the switch is instant and needs no re-render.

## Scoping a theme to part of the page

The attribute works on any element, so a single map can carry its own theme:

```tsx
<div data-gcl-theme="dark">
  <MapContainer …>
    <GeoLegend … />   {/* dark, regardless of the page */}
  </MapContainer>
</div>
```

## Class names

Stable and namespaced, so you can target them directly when a variable is not
enough:

| Class | What it is |
| --- | --- |
| `.gcl-panel` | The floating card every overlay sits in |
| `.gcl-panel--floating`, `.gcl-panel--bottom-right` | Docked placement |
| `.gcl-button`, `.gcl-button--icon`, `.gcl-button--solid` | Controls |
| `.gcl-slider`, `.gcl-slider__track`, `.gcl-slider__thumb` | Sliders |
| `.gcl-legend`, `.gcl-legend__ramp`, `.gcl-legend__swatch` | Legend internals |
| `.gcl-hover-card`, `.gcl-hover-card__row` | Readout card |
| `.gcl-timeline`, `.gcl-timeline__scrubber` | Timeline |
| `.gcl-controls__group` | A segmented control cluster |
| `.gcl-surface` | Portalled popovers, tooltips and selects |

> **Note:** These are part of the public surface. They will not be renamed
> within a major version.

## Styling the map itself

Basemap appearance is a MapLibre style, not a library concern:

```ts
import { createBlankStyle, createRasterStyle, withPMTilesOutline }
  from '@hridayanp/map-container';

createBlankStyle('#0b1220');                     // background only, no requests
createRasterStyle(tiles, { attribution, ... });  // a raster basemap
withPMTilesOutline(style, { url, sourceLayer }); // add a vector boundary layer
```

Anything MapLibre can express, you can pass as `mapStyle`.

## Overlay placement

Overlay components take a `placement` prop rather than needing positioning CSS:

```tsx
<GeoLegend placement="bottom-right" />
<TimelineControl placement="bottom-center" />
<MapControlBar placement="top-right" />
```

Omit it and the component renders as a normal block element you position
yourself — a legend in a sidebar or a print layout needs no map at all.

The overlay layer is `pointer-events: none`, so the map stays draggable through
the gaps between panels; each panel opts its own subtree back in.
