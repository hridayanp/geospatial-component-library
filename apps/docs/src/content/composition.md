Every package here is a sibling that attaches to the same map context. Stacking
them is ordinary JSX — there is no layer manager, no registry and no
configuration object.

```tsx
<MapContainer center={[92, 25.5]} zoom={6} mapStyle={basemapStyle}>
  <RasterLayer        data={rainfall} colorScale={blues} min={0} max={120} />
  <VectorLayer        data={districts} fill={false} stroke="#94a3b8" />
  <WindParticleLayer  data={windField} particleCount={2200} />

  <GeoLegendStack placement="bottom-right">
    <GeoLegend title="Rainfall" colorScale={blues} min={0} max={120} unit="mm" />
    <GeoLegend title="Wind" colorScale={speeds} min={0} max={40} unit="kt" />
  </GeoLegendStack>

  <GeoHover layerIds={['districts-fill']} raster={rainfall} sections={describe} />
  <TimelineControl frames={frames} index={index} onIndexChange={setIndex} />
  <MapControlBar placement="top-right">
    <ZoomControl />
    <FullscreenControl />
  </MapControlBar>
</MapContainer>
```

## Draw order

MapLibre draws in **insertion order**, and layers insert as they mount. So JSX
order is draw order: later siblings render on top.

When that is not enough — because you want data *under* basemap labels — use
`beforeId`:

```tsx
<RasterLayer data={rainfall} beforeId="basemap-labels" />
```

That is the difference between a legible map and place names buried under a
rainfall field. It works for `VectorLayer` and `DeckOverlay` too.

## A sensible stack, bottom to top

1. **Raster** — continuous fields. The background of the data.
2. **Vector fills** — administrative areas, catchments, zones.
3. **Particles** — motion reads best over a static field.
4. **Vector lines and points** — boundaries and sites stay legible on top.
5. **Basemap labels** — via `beforeId` on everything above.
6. **Overlays** — legends, timeline, controls. Not map layers at all.

Overlays are plain DOM in an absolutely-positioned container that is transparent
to pointer events, so the map stays draggable everywhere except on an actual
control.

## Share one deck instance

More than one deck-based layer means wrapping them:

```tsx
<DeckOverlay beforeId="basemap-labels">
  <WindParticleLayer id="surface" data={surface} />
  <WindParticleLayer id="upper"   data={upper} />
</DeckOverlay>
```

Without the wrapper each layer creates its own deck.gl instance, animation loop
and picking pass. See [`deck-overlay`](/docs/deck-overlay).

## One timeline, many layers

The timeline owns an index. Every layer reads from the same one:

```tsx
const [index, setIndex] = useState(0);
const step = frames[index];

<RasterLayer       data={step.rainfall} frameKey={`rain-${step.id}`} min={0} max={120} />
<WindParticleLayer data={step.wind}    transitionMs={800} />
<VectorLayer       data={step.alerts} />
<TimelineControl   frames={frames} index={index} onIndexChange={setIndex} />
```

Two things make this animate cleanly rather than stutter:

- **`frameKey`** gives the raster cache a stable identity, so scrubbing back to a
  visited frame is instant.
- **Explicit `min`/`max`.** Without them each frame self-scales to its own range
  and the sequence appears to pulse. This is the most common animation mistake.

Prefetch the next frame yourself — retrieval is the host's job:

```tsx
useEffect(() => {
  const next = frames[index + 1];
  if (next) void preloadRasterFrame(next.rainfall, { colorScale: blues, min: 0, max: 120, frameKey: `rain-${next.id}` });
}, [index]);
```

## Hover across layers

One `GeoHover` handles vector picking and raster probing together:

```tsx
<VectorLayer id="sites" data={points} hitRadius={14} />
<GeoHover
  layerIds={['sites-hit']}
  raster={rainfall}
  sections={(s) => [{
    title: s.features[0]?.properties?.name ?? 'Location',
    rows: [{ label: 'Rainfall', value: s.value, unit: 'mm' }],
  }]}
/>
```

Always scope `layerIds`. Unscoped, `queryRenderedFeatures` walks every rendered
layer on every pointer move.

## Opacity: one owner

Wire the control to the layer directly, and let nothing else hold a copy:

```tsx
const [opacity, setOpacity] = useState(0.85);

<RasterLayer data={rainfall} opacity={opacity} />
<OpacityControl value={opacity} onChange={setOpacity} />
```

## Basemap switching

```tsx
const [style, setStyle] = useState(darkStyle);

<MapContainer mapStyle={style}>
  <RasterLayer data={rainfall} />
  <BasemapSwitcher value={style} onChange={setStyle} options={basemaps} />
</MapContainer>
```

`setStyle` discards every source and layer added on top. Every layer in this
library re-attaches automatically on the next `styledata` event — that is the
whole purpose of the `styleVersion` counter in
[`map-container`](/docs/map-container#why-styleversion-exists).

Leave `applyToMap` **off** here. With `mapStyle` controlled by the host, the
switcher calling `setStyle` as well means two writers fighting over the map.

## Two maps, one dataset

```tsx
<MapContainer center={[92, 25.5]} zoom={6}>
  <RasterLayer data={frames[index]} frameKey={frames[index].id} />
</MapContainer>

<MapContainer center={[92, 25.5]} zoom={3}>
  <RasterLayer data={frames[index]} frameKey={frames[index].id} />
</MapContainer>
```

Each map owns its own MapLibre instance and context, so nothing collides. The
raster frame cache is shared by default, so the same `frameKey` colourises once
and both maps use the result.

## Conditional layers

```tsx
{showRainfall && <RasterLayer data={rainfall} />}
```

Unmounting removes the source and layers cleanly. But when a layer toggles
often, prefer `visible`:

```tsx
<RasterLayer data={rainfall} visible={showRainfall} />
```

`visible={false}` keeps the source mounted and the frames cached, so toggling
back is instant instead of re-decoding.

Similarly, prefer `filter` over re-slicing a FeatureCollection: the data stays
on the GPU and only the draw decision changes.

## Performance

- Everything is CSS-sized. Give `MapContainer` a sized parent.
- Prefer `onMoveEnd` to `onMove` for anything expensive.
- Memoise `data` props. A new object identity each render re-uploads the source.
- Particle count dominates GPU cost; `smoothFactor` dominates raster CPU cost.
