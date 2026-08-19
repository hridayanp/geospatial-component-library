Layer components resolve the enclosing map through React context and register
their own sources and style layers. Composition is therefore expressed as JSX
nesting; there is no layer manager, registry or configuration object.

```tsx
<MapContainer center={[92, 25.5]} zoom={6} mapStyle={basemapStyle}>
  <RasterLayer        data={precipitation} colorScale={blues} min={0} max={120} />
  <VectorLayer        data={districts} fill={false} stroke="#94a3b8" />
  <WindParticleLayer  data={windField} particleCount={2200} />

  <GeoLegendStack placement="bottom-right">
    <GeoLegend title="Precipitation" colorScale={blues}  min={0} max={120} unit="mm" />
    <GeoLegend title="Wind speed"    colorScale={speeds} min={0} max={40}  unit="kt" />
  </GeoLegendStack>

  <GeoHover layerIds={['districts-fill']} raster={precipitation} sections={describe} />
  <TimelineControl frames={frames} index={index} onIndexChange={setIndex}
                   placement="bottom-center" />
  <MapControlBar placement="top-right">
    <ZoomControl />
    <FullscreenControl />
  </MapControlBar>
</MapContainer>
```

## Draw order

MapLibre renders style layers in **registration order**, and layers register as
they mount. JSX order is therefore draw order: later siblings composite above
earlier ones.

Where that is insufficient — because data should sit beneath basemap labels —
use `beforeId`:

```tsx
<RasterLayer data={precipitation} beforeId="basemap-labels" />
```

This is the difference between a legible map and place names obscured by a
thematic overlay. `VectorLayer` and `DeckOverlay` accept the same prop.

### A conventional stack

1. **Raster** — continuous fields, forming the thematic base.
2. **Polygon fills** — administrative areas, catchments, zones.
3. **Particles** — motion reads most clearly over a static field.
4. **Lines and points** — boundaries and sites remain legible above.
5. **Basemap labels** — via `beforeId` on everything above.
6. **Overlays** — legends, timeline, controls. These are DOM, not map layers.

Overlay components render into an absolutely positioned container declared
`pointer-events: none`, so map panning remains available everywhere except over
an actual control.

## Sharing a deck.gl instance

More than one deck-based layer requires the shared host:

```tsx
<DeckOverlay beforeId="basemap-labels">
  <WindParticleLayer id="surface" data={surface} />
  <WindParticleLayer id="upper"   data={upper} />
</DeckOverlay>
```

Without it, each layer provisions its own deck.gl instance, animation loop and
picking pass. See [`deck-overlay`](/docs/deck-overlay).

## One temporal index, many layers

The timeline owns an index; every layer reads the corresponding frame:

```tsx
const [index, setIndex] = useState(0);
const step = frames[index];

<RasterLayer       data={step.meta.precipitation} frameKey={`precip-${step.id}`}
                   min={0} max={120} colorScale={blues} />
<WindParticleLayer data={step.meta.wind} transitionMs={800} />
<VectorLayer       data={step.meta.advisories} />
<TimelineControl   frames={frames} index={index} onIndexChange={setIndex} />
```

Two properties make this animate continuously rather than discontinuously:

- **`frameKey`** establishes cache identity for the colourised raster, so
  returning to a visited frame is a texture swap rather than a re-decode.
- **Explicit `min` and `max`.** Without them each frame is normalised against
  its own range and the sequence appears to pulse. This is the most frequent
  error in temporal composition.

Prefetching the next frame is a host responsibility, because retrieval is a host
responsibility:

```tsx
useEffect(() => {
  const next = frames[index + 1];
  if (!next) return;
  void preloadRasterFrame(next.meta.precipitation, {
    colorScale: blues, min: 0, max: 120, frameKey: `precip-${next.id}`,
  });
}, [index]);
```

## Inspection across layers

One `GeoHover` instance handles vector picking and raster probing together:

```tsx
<VectorLayer id="sites" data={points} hitRadius={14} />
<GeoHover
  layerIds={['sites-hit']}
  raster={precipitation}
  sections={(s) => [{
    title: String(s.features[0]?.properties?.name ?? 'Location'),
    rows: [{ label: 'Accumulation', value: s.value, unit: 'mm' }],
  }]}
/>
```

Always scope `layerIds`. Unscoped, `queryRenderedFeatures` traverses every
rendered style layer on every pointer-move event.

## Single-owner opacity

Wire the control directly to the layer, with no intermediate copy of the value:

```tsx
const [opacity, setOpacity] = useState(0.85);

<RasterLayer data={precipitation} opacity={opacity} />
<OpacityControl value={opacity} onChange={setOpacity} label="Precipitation" />
```

## Basemap exchange

```tsx
const [basemapId, setBasemapId] = useState('dark');
const style = basemaps.find(b => b.id === basemapId)!.style;

<MapContainer mapStyle={style}>
  <RasterLayer data={precipitation} />
  <BasemapSwitcher value={basemapId} options={basemaps}
                   onChange={(id) => setBasemapId(id)} />
</MapContainer>
```

`setStyle` discards every source and style layer added on top of the previous
style. Every layer in this library re-registers automatically on the next
`styledata` event — the purpose of the `styleVersion` counter in
[`map-container`](/docs/map-container#styleversion).

Leave `applyToMap` at its default of `false` here. With `mapStyle` controlled by
the host, enabling it produces two writers contending for the same map state.

## Multiple maps, one dataset

```tsx
<MapContainer center={[92, 25.5]} zoom={6}>
  <RasterLayer data={frames[index].raster} frameKey={frames[index].id} />
</MapContainer>

<MapContainer center={[92, 25.5]} zoom={3}>
  <RasterLayer data={frames[index].raster} frameKey={frames[index].id} />
</MapContainer>
```

Each map owns an independent MapLibre instance and context, so no state
collides. The raster frame cache is shared by default, so an identical
`frameKey` is colourised once and used by both.

## Conditional layers

```tsx
{showPrecipitation && <RasterLayer data={precipitation} />}
```

Unmounting removes the source and its style layers cleanly. For a frequently
toggled layer, prefer `visible`:

```tsx
<RasterLayer data={precipitation} visible={showPrecipitation} />
```

`visible={false}` detaches the source while retaining cached frames, so
re-enabling is immediate rather than requiring a re-decode.

The same reasoning applies to vector data: prefer a `filter` expression to
re-slicing a FeatureCollection, so geometry remains uploaded to the GPU and only
the draw decision changes.

## Performance considerations

- `MapContainer` fills its parent; give it an ancestor with a resolved height.
- Prefer `onMoveEnd` to `onMove` for any handler performing non-trivial work.
- Memoise `data` props. A new object identity on each render triggers a source
  update even when content is unchanged.
- `particleCount` dominates GPU cost; `smoothFactor` dominates raster CPU cost.
- Scope `layerIds` on every `GeoHover`.
