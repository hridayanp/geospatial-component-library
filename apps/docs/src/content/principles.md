Five rules decided what became a package, what became a prop, and what was
thrown away. They are worth knowing before you extend the library, because they
are what keeps twelve packages from collapsing back into one application.

## 1. Props in, callbacks out

No component fetches, transforms or retrieves business data. There is no API
client, no request cache, no retry policy and no authentication anywhere in the
source.

Where a generic GIS component legitimately takes a URL — a Cloud-Optimised
GeoTIFF is designed to be read over HTTP range requests — the host supplies a
URL it has already authorised:

```tsx
<RasterLayer data={{ kind: 'geotiff', source: signedUrl }} />
```

The library decodes. It never decides how the URL was signed, when to refresh
it, or what to do when it 403s.

**Why it matters:** the moment a component knows how to fetch, it knows about
your auth, your error handling and your loading states — and it stops being
reusable outside the application it was written for.

## 2. No application state

No Redux, no persisted store, no `localStorage`, no URL state. React context
appears in exactly one place — `map-container` — and only so that a layer can
find the map it is inside.

Everything else is props, local state and callbacks. Components support
controlled and uncontrolled patterns where both are reasonable (the timeline's
`index` and `playing`, for instance), because a host frequently drives the same
state from two places at once.

**Why it matters:** the old code read the colour palette from a Redux slice.
That single line made every raster component untestable in isolation and
unusable in a second application.

## 3. One capability per package

A raster layer does not require the wind layer. A legend works with no map at
all. `geo-utils` imports nothing.

The dependency graph is a DAG with `geo-utils` at the bottom and the layer
packages at the top, and **no edges between siblings**. See the
[dependency graph](/docs/dependency-graph).

**Why it matters:** it is what lets someone install an 8 KB legend for a report
without pulling in MapLibre, and what stops a change to particles from being
able to break rasters.

## 4. Generalise, do not rename

This is the rule that did the most work.

Six weather-specific raster components were **not** turned into six renamed
packages. They were collapsed into one generic layer whose differences are two
props:

```tsx
<RasterLayer data={rain}    colorScale={bluePalette}  min={0} max={120} />
<RasterLayer data={thunder} colorScale={plasma}       min={0} max={100} />
```

The test applied to every candidate: *if two components differ only in their
data and their configuration, they are the same component.*

The same reasoning produced one `VectorLayer` instead of per-feature-type
overlays, one `GeoLegend` instead of per-variable legends, and one `GeoHover`
instead of per-layer hover cards.

**Why it matters:** a refactor that moves duplication into packages leaves you
with the same duplication and more `package.json` files.

## 5. Peer dependencies for the heavy things

React, MapLibre, deck.gl and WeatherLayers GL are never bundled into a package.
They are declared as peers with wide ranges:

```jsonc
"peerDependencies": {
  "react": "^18.2.0 || ^19.0.0",
  "maplibre-gl": "^4.0.0 || ^5.0.0"
}
```

**Why it matters:** two copies of React in one tree produces `Invalid hook call`
or hooks that silently return null. deck.gl and MapLibre keep module-level
registries and behave just as badly. Peers guarantee one instance, supplied by
whoever is at the top.

It also means the library never forces a major version bump on you.

---

## What these rules excluded

Applying them consistently meant deliberately **not** building things that
looked useful:

| Not included | Why |
| --- | --- |
| Layer picker / overlay toggles | Encodes what an application *is*, not what a map does |
| Site or region selector | Application domain |
| Model / run switcher | Application domain |
| Alert or notification panels | Application domain |
| A data-fetching hook | Would drag auth, caching and error policy into the library |
| A `<WeatherMap>` preset | Would bake one product's composition into a package |

Each of those is ten lines in a host application, and none of them is reusable
across two different products.

## Applying them to new code

When you add something, ask in order:

1. **Does it fetch, cache or authenticate?** Then it belongs in the host.
2. **Does it name a domain concept** — a variable, a product, a site? Then it is
   a prop, not a component.
3. **Does it duplicate an existing package with different configuration?**
   Then it is a prop on that package.
4. **Does it need another layer package to work?** Then the boundary is wrong.

See [Adding a Package](/docs/adding-a-package) for the mechanics once the
answers point at a genuine new capability.
