## Purpose

`ui` supplies the interface primitives and the single stylesheet from which
every visual package in the library is composed: an elevated panel, a button, a
slider, a popover, a select, a tooltip, a dialog and an icon set.

```bash
npm install @hridayanp/ui react react-dom
```

```ts
import '@hridayanp/ui/styles.css';
```

## Why it exists

Eleven packages each shipping their own button would not present as one product.
This package is what allows a legend, a timeline and a control bar to share a
visual language **without depending on one another**.

It is also the only package that depends on Radix, so a consumer installing
`geo-utils` alone acquires none of it.

## Distribution model

Class names are scoped to a `gcl-` namespace and shipped as one plain
stylesheet.

A consumer requires **no build integration** — no PostCSS plugin, no preprocessor,
no Tailwind preset, no runtime style injection, no CSS-in-JS version to
reconcile. The stylesheet behaves identically in a Vite application, a Next.js
application and a plain `<script>` page.

Because every selector is namespaced, library rules cannot match application
elements, and an application's global `button { … }` rule cannot restyle a map
control.

There is exactly one stylesheet for the library. Import it once, anywhere.

## Components

```tsx
import {
  Button, Panel, Popover, Select, Slider, Tooltip, Dialog,
} from '@hridayanp/ui';

<Panel
  title="Layer"
  subtitle="Accumulated precipitation"
  placement="top-right"
  actions={<Button variant="icon" aria-label="Close">×</Button>}
>
  <Slider aria-label="Opacity" value={opacity} onValueChange={setOpacity}
          min={0} max={1} step={0.01} />
</Panel>
```

| Component | Notes |
| --- | --- |
| `Panel` | The elevated surface underlying legends, timelines and control groups. `placement` docks it to a map corner |
| `Button` | `variant`: `'ghost' \| 'solid' \| 'outline' \| 'icon'`; `size`: `'sm' \| 'md'`; `active` for toggle state; `asChild` to render as an anchor or a Radix trigger |
| `Slider` | Radix Slider. Controlled, with `onValueCommit` for release |
| `Popover` | Radix Popover, portalled; `side` and `align` control placement |
| `Select` | Radix Select, portalled; generic over the value type |
| `Tooltip` | Radix Tooltip, portalled; `delayMs` controls the open delay |
| `Dialog` | Radix Dialog with focus trap and scroll lock; `title` is required for accessibility |

`Slider`, `Popover`, `Select`, `Tooltip` and `Dialog` wrap **Radix primitives**,
so keyboard interaction, focus management, escape handling and ARIA wiring are
correct without this library re-implementing them.

`PanelPlacement` accepts `top-left`, `top-center`, `top-right`, `bottom-left`,
`bottom-center` and `bottom-right`.

## Portalled floating content

Every floating surface renders into `document.body`.

A popover rendered inside a map container is clipped by the first ancestor
declaring `overflow: hidden`, and map containers essentially always have one. It
is the most common defect in map interfaces, and portalling is the only reliable
remedy. The same reasoning governs the
[`geo-hover`](/docs/geo-hover#card-positioning) readout card.

## Icons

```tsx
import {
  ChevronIcon, CollapseIcon, ExpandIcon, LayersIcon, MinusIcon, NextIcon,
  OpacityIcon, PauseIcon, PlayIcon, PlusIcon, PreviousIcon, TargetIcon,
} from '@hridayanp/ui';
```

Twelve glyphs inlined as SVG components. Inlining twelve paths is substantially
cheaper than an icon-library dependency, and it ensures a consumer never
acquires a second icon set as a consequence of installing a map control.

Icons inherit `currentColor`, so they restyle with the surrounding text.

## Theming

Every colour, radius, shadow and font in the library is a CSS custom property.
Overriding a token anywhere in the cascade propagates to every component that
consumes it:

```css
:root {
  --gcl-accent: #22d3ee;
  --gcl-bg-elevated: rgba(2, 6, 23, 0.9);
  --gcl-border: rgba(148, 163, 184, 0.24);
  --gcl-fg: #e2e8f0;
  --gcl-fg-muted: #94a3b8;
  --gcl-radius: 4px;
  --gcl-font: 'Inter', system-ui, sans-serif;
  --gcl-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
```

Because tokens are custom properties rather than a JavaScript theme object, they
cascade. Scoping a variant to one map is a selector, not a second provider:

```css
.compact-map { --gcl-radius: 2px; --gcl-space: 6px; }
```

## Colour scheme

```html
<div data-gcl-theme="light">…</div>
<div data-gcl-theme="dark">…</div>
```

With no `data-gcl-theme` attribute present, the library resolves the scheme from
`prefers-color-scheme`. The attribute is an override, not a requirement — the
default behaviour is already correct for most applications — and it is honoured
at any depth, so an inset map can present a dark scheme inside a light page.

Full token reference in [Theming](/docs/theming).

## Utilities

```ts
import { cx, placementClass } from '@hridayanp/ui';
import type { PanelPlacement } from '@hridayanp/ui';

cx('gcl-panel', isActive && 'gcl-panel--active');
placementClass('gcl-panel', 'bottom-right');
```

## Integration boundaries

Application interface may be composed from these primitives, and doing so is the
way to make a custom map control visually indistinguishable from the shipped
ones:

```tsx
import { Panel, Select } from '@hridayanp/ui';
import { MapControlBar } from '@hridayanp/map-controls';

<MapControlBar placement="top-left">
  <Panel title="Model">
    <Select value={model} onValueChange={setModel} options={models}
            aria-label="Forecast model" />
  </Panel>
</MapControlBar>
```

That said, this is a **support package rather than a design system**. It ships
what the map packages required and no more: there is no table, no form layout
and no typography scale. An application needing a general component system
should use one.
