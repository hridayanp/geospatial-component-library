# @hridayanp/ui

The shared primitives and the single stylesheet behind every visual package in
the library: a floating panel, a button, a slider, a popover, a select, a dialog
and a small icon set.

## Installation

```bash
npm install @hridayanp/ui react react-dom
```



This package renders UI, so import the stylesheet once anywhere in your app:

```ts
import '@hridayanp/ui/styles.css';
```

Every colour, radius and font is a CSS custom property — override the variables
to retheme, and set `data-gcl-theme="light"` or `"dark"` on any ancestor to
switch modes.


## Why it exists

Eleven packages that each shipped their own button would not look like one
product. This package is what makes a legend, a timeline and a control bar
share a visual language without any of them depending on each other.

## No Tailwind, no CSS-in-JS

Class names are namespaced `gcl-` and shipped as one plain stylesheet. A
consumer needs no build configuration, no PostCSS plugin and no runtime style
injection — and the library cannot leak styles into an application's own
components.

## Components

```tsx
import { Button, Panel, Popover, Select, Slider, Tooltip, Dialog } from '@hridayanp/ui';

<Panel title="Layer" placement="top-right" actions={<Button variant="ghost">×</Button>}>
  <Slider aria-label="Opacity" value={opacity} onValueChange={setOpacity} />
</Panel>
```

`Slider`, `Popover`, `Select`, `Tooltip` and `Dialog` wrap Radix, so keyboard
interaction, focus management and ARIA wiring are correct. Floating content is
portalled to `document.body` — a popover clipped by a map container's
`overflow` is the most common failure in map UIs.

## Icons

Twelve glyphs (`PlayIcon`, `PauseIcon`, `PlusIcon`, `TargetIcon`, …) inlined
as SVG. Bundling twelve paths is far cheaper than an icon-library dependency,
and it means a consumer never ends up with two icon sets because they installed
a map control.

## Theming

```css
:root {
  --gcl-accent: #22d3ee;
  --gcl-bg-elevated: rgba(2, 6, 23, 0.9);
  --gcl-radius: 4px;
  --gcl-font: 'Inter', sans-serif;
}
```

With no `data-gcl-theme` attribute set, the library follows
`prefers-color-scheme`.

## Documentation

Interactive examples for every prop live in the workspace Storybook:

```bash
npm run storybook
```

## License

MIT
