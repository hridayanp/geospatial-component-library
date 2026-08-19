Presentation is parameterised through CSS custom properties. Retheming is
accomplished by overriding design tokens rather than by overriding rules.

## Stylesheet

A single import, once per application:

```ts
import '@hridayanp/ui/styles.css';
```

The stylesheet is published by `@hridayanp/ui` and covers every package that
renders interface elements — legend, hover card, timeline, controls and the
shared primitives. Layer packages render no DOM and require no stylesheet.

## Distribution model

Class names are scoped to a `gcl-` namespace and shipped as one plain
stylesheet. Three properties follow from that choice:

- **No build integration.** No preprocessor, no PostCSS plugin, no content
  globs, no runtime style injection. The stylesheet is consumable by any
  bundler and by a plain `<link>` element.
- **Bidirectional isolation.** Library rules cannot match application elements,
  and application rules — including global element selectors — cannot match
  library internals.
- **Inspectable surface.** Every token is a declared custom property, readable
  and overridable from developer tools.

## Design tokens

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

Overriding a token at any point in the cascade propagates to every component
that consumes it:

```css
:root {
  --gcl-accent: #7c3aed;
  --gcl-radius: 3px;
  --gcl-font: 'Inter', sans-serif;
}
```

## Colour scheme

The active scheme is selected by a data attribute on any ancestor element:

```html
<html data-gcl-theme="dark">
<html data-gcl-theme="light">
```

When the attribute is absent, the library resolves the scheme from the user
agent preference:

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-gcl-theme='light']) { /* dark tokens */ }
}
```

Runtime switching is a single attribute write. Because the tokens are custom
properties, the transition requires no React re-render:

```ts
document.documentElement.setAttribute('data-gcl-theme', next);
```

## Scoped themes

The attribute is honoured at any depth, so an individual map can carry a scheme
independent of the surrounding page:

```tsx
<div data-gcl-theme="dark">
  <MapContainer center={[92, 25.5]} zoom={6}>
    <GeoLegend title="Intensity" colorScale={palette} min={0} max={100} />
  </MapContainer>
</div>
```

The same mechanism scopes token overrides. A compact variant is a selector, not
a second provider:

```css
.compact-map { --gcl-radius: 2px; --gcl-space: 6px; }
```

## Class name reference

Class names are stable and namespaced, and may be targeted directly where a
token is insufficient.

| Class | Element |
| --- | --- |
| `.gcl-panel` | The elevated surface underlying every overlay |
| `.gcl-panel--floating`, `.gcl-panel--bottom-right` | Docked placement modifiers |
| `.gcl-button`, `.gcl-button--icon`, `.gcl-button--solid` | Interactive controls |
| `.gcl-slider`, `.gcl-slider__track`, `.gcl-slider__thumb` | Slider internals |
| `.gcl-legend`, `.gcl-legend__ramp`, `.gcl-legend__swatch` | Legend internals |
| `.gcl-hover-card`, `.gcl-hover-card__row` | Readout card |
| `.gcl-timeline`, `.gcl-timeline__scrubber` | Timeline internals |
| `.gcl-controls__group` | A segmented control cluster |
| `.gcl-surface` | Portalled popovers, tooltips and selects |

> **Note:** These class names form part of the public contract and will not be
> renamed within a major version.

## Cartographic styling

Basemap appearance is expressed as a MapLibre style specification and is
therefore outside the token system:

```ts
import {
  createBlankStyle,
  createRasterStyle,
  withPMTilesOutline,
} from '@hridayanp/map-container';

createBlankStyle('#0b1220');
createRasterStyle(tileUrl, { attribution, maxzoom: 19 });
withPMTilesOutline(style, { url, sourceLayer, color });
```

Any style MapLibre can express is a valid `mapStyle` value. Layer symbology —
fill colour, stroke width, point radius — is configured per layer and accepts
MapLibre expressions for data-driven variation; see
[`vector-layer`](/docs/vector-layer#data-driven-symbology).

## Overlay placement

Overlay components accept a `placement` prop and dock themselves to a corner of
the map, so positioning requires no application CSS:

```tsx
<GeoLegend placement="bottom-right" />
<TimelineControl placement="bottom-center" />
<MapControlBar placement="top-right" />
```

Accepted values are `top-left`, `top-center`, `top-right`, `bottom-left`,
`bottom-center` and `bottom-right`. Omitting `placement` renders the component
as an ordinary block element positioned by the host — a legend in a sidebar or a
print layout requires no map at all.

The overlay container is declared `pointer-events: none` and each panel re-enables
pointer interaction for its own subtree, so map panning remains available in the
space between panels.
