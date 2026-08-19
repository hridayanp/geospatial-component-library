# @hridayanp/map-controls

The genuinely reusable map controls, and only those.

## Installation

```bash
npm install @hridayanp/map-controls @hridayanp/map-container maplibre-gl react
```



This package renders UI, so import the stylesheet once anywhere in your app:

```ts
import '@hridayanp/ui/styles.css';
```

Every colour, radius and font is a CSS custom property — override the variables
to retheme, and set `data-gcl-theme="light"` or `"dark"` on any ancestor to
switch modes.


## Usage

```tsx
<MapContainer>
  <MapControlBar placement="top-right">
    <ZoomControl />
    <OpacityControl value={opacity} onChange={setOpacity} />
    <ResetViewControl bounds={bounds} />
    <FullscreenControl />
  </MapControlBar>
</MapContainer>
```

## What is here, and what is not

Zoom, reset view, fullscreen, opacity and basemap switching.

**Not** layer pickers, site selectors, model switchers or alert panels. Those
encode what an application *is*, not what a map does — a component library that
shipped them would be shipping someone else's product.

## Controlled by design

`OpacityControl` and `BasemapSwitcher` are controlled. Opacity almost always
belongs to the layer the host already manages; a control holding its own copy
would immediately disagree with it.

## Components

| Component | Notes |
| --- | --- |
| `MapControlBar` | Docks and groups controls; transparent to pointer events so the map stays draggable between groups |
| `ZoomControl` | Disables itself at the map's zoom limits rather than clicking with no effect |
| `ResetViewControl` | Takes a `view` or a `bounds` |
| `FullscreenControl` | Expands the map container by default, and resizes the map after the transition |
| `OpacityControl` | Popover by default; `inline` for embedding in a legend footer |
| `BasemapSwitcher` | `applyToMap` optional — leave it off when the host passes `mapStyle` itself, or the two fight |

## A note on basemap switching

Swapping a style discards every source and layer added on top of it. Layer
packages in this library re-attach themselves automatically on the next
`styledata` event; anything you added by hand has to do the same.

## Documentation

Interactive examples for every prop live in the workspace Storybook:

```bash
npm run storybook
```

## License

MIT
