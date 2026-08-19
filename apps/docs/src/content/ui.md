The shared primitives and the single stylesheet behind every visual package in
the library — a floating panel, a button, a slider, a popover, a select, a dialog
and a small icon set.

```bash
npm install @hridayanp/ui react react-dom
```

```ts
import '@hridayanp/ui/styles.css';
```

## Why it exists

Eleven packages that each shipped their own button would not look like one
product. This package is what makes a legend, a timeline and a control bar share
a visual language **without any of them depending on each other**.

It is also the only place a Radix dependency lives, so a consumer who installs
`geo-utils` alone gets none of it.

## No Tailwind, no CSS-in-JS

Class names are namespaced `gcl-` and shipped as one plain stylesheet.

A consumer needs **no build configuration** — no PostCSS plugin, no Tailwind
preset, no runtime style injection, no `styled-components` version to match. It
works in a Vite app, a Next.js app, a CRA leftover and a plain `<script>` tag
identically.

And because every selector is prefixed, the library cannot leak styles into your
components, and your global `button { … }` rule cannot silently restyle a map
control.

There is exactly one stylesheet for the whole library. Import it once, anywhere.

## Components

```tsx
import {
  Button, Panel, Popover, Select, Slider, Tooltip, Dialog,
} from '@hridayanp/ui';

<Panel
  title="Layer"
  placement="top-right"
  actions={<Button variant="ghost" aria-label="Close">×</Button>}
  footer={<span>Updated 12:40</span>}
>
  <Slider aria-label="Opacity" value={opacity} onValueChange={setOpacity} />
</Panel>
```

| Component | Notes |
| --- | --- |
| `Panel` | The floating surface behind legends, timelines and popovers. `placement` docks it to a corner |
| `Button` | `variant`: `'solid' \| 'ghost' \| 'subtle'`; `size`: `'sm' \| 'md'` |
| `Slider` | Radix Slider; single value or range |
| `Popover` | Radix Popover, portalled |
| `Select` | Radix Select, portalled |
| `Tooltip` | Radix Tooltip, portalled |
| `Dialog` | Radix Dialog with focus trap and scroll lock |

`Slider`, `Popover`, `Select`, `Tooltip` and `Dialog` wrap **Radix primitives**,
so keyboard interaction, focus management, escape handling and ARIA wiring are
correct without this library re-implementing any of it.

## Everything floating is portalled

To `document.body`, always.

A popover rendered inside a map container gets clipped by the first ancestor with
`overflow: hidden` — and map containers essentially always have one. It is the
most common failure in map UIs, and portalling is the only reliable fix. The same
reasoning drives the [`geo-hover`](/docs/geo-hover#why-the-card-is-portalled)
card.

## Icons

```tsx
import { PlayIcon, PauseIcon, PlusIcon, TargetIcon } from '@hridayanp/ui';
```

Twelve glyphs inlined as SVG components. Bundling twelve paths is far cheaper
than an icon-library dependency, and it means a consumer never ends up with two
icon sets because they installed a map control.

They take `size` and inherit `currentColor`, so they restyle with the surrounding
text.

## Theming

Every colour, radius, shadow and font in the library is a CSS custom property.
Override them anywhere in your cascade:

```css
:root {
  --gcl-accent: #22d3ee;
  --gcl-bg-elevated: rgba(2, 6, 23, 0.9);
  --gcl-border: rgba(148, 163, 184, 0.24);
  --gcl-text: #e2e8f0;
  --gcl-text-muted: #94a3b8;
  --gcl-radius: 4px;
  --gcl-font: 'Inter', system-ui, sans-serif;
  --gcl-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
```

Because they are custom properties rather than a JavaScript theme object, they
cascade: scoping a block to one map is a selector, not a second provider.

```css
.compact-map { --gcl-radius: 2px; --gcl-font-size: 11px; }
```

## Light and dark

```html
<div data-gcl-theme="light">…</div>
<div data-gcl-theme="dark">…</div>
```

With **no** `data-gcl-theme` set anywhere, the library follows
`prefers-color-scheme`. The attribute is an override, not a requirement — the
default behaviour is already correct for most applications.

The attribute works at any depth, so an inset map can be dark inside a light
page.

Full details in [Theming](/docs/theming).

## Using it directly

Nothing stops you building application UI from these primitives, and doing so is
the way to make a custom map control look identical to the shipped ones:

```tsx
import { Panel, Select } from '@hridayanp/ui';
import { MapControlBar } from '@hridayanp/map-controls';

<MapControlBar placement="top-left">
  <Panel title="Model">
    <Select value={model} onValueChange={setModel} options={models} />
  </Panel>
</MapControlBar>
```

That said, this is a **support package**, not a general design system. It ships
what the map packages needed and no more — there is no table, no form layout, no
typography scale. Reach for a real design system if you need one.
