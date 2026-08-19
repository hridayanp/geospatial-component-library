Five rules determine what constitutes a package, what constitutes a prop, and
where the boundary between library and application falls. They are the reason
twelve packages remain twelve packages rather than collapsing back into one
application.

## 1. Data flows in through props; events flow out through callbacks

Components accept georeferenced data and configuration through their public
interface and emit view-state and interaction events through callbacks. They do
not perform retrieval, transformation or authorisation of domain data.

Where a component legitimately accepts a resource locator — a Cloud-Optimised
GeoTIFF is designed to be read over HTTP range requests — the host supplies a
URL it has already authorised:

```tsx
<RasterLayer data={{ kind: 'geotiff', source: signedUrl }} />
```

The library performs the decode. Credential lifecycle, refresh policy and
failure handling remain with the host.

**Rationale.** A component that encapsulates retrieval also encapsulates the
application's authentication scheme, error taxonomy and loading semantics. Its
reuse is then bounded by the application it was written for.

## 2. State ownership is explicit and external

The library maintains no global store, no persisted state and no URL-derived
state. React context appears in exactly one package — `map-container` — and
serves a single purpose: resolving the enclosing map instance and its readiness
for descendant layers.

All other state is held in props, local component state and callbacks.
Components support both controlled and uncontrolled operation where both are
meaningful — `TimelineControl` accepts `index` and `playing` independently — because a
host frequently drives the same value from more than one origin: a control, a
keyboard shortcut, a URL parameter.

**Rationale.** In the source this library was consolidated from, colour palettes
were read from a Redux slice. That single coupling made every raster component
untestable in isolation and unusable in a second application.

## 3. One capability per package

A raster layer does not require the particle layer. A legend operates without a
map. `geo-utils` has no runtime dependencies.

The dependency graph is a directed acyclic graph rooted at `geo-utils`, with
**no edges between sibling layer packages**. See
[Dependency Graph](/docs/dependency-graph).

**Rationale.** Granular boundaries make an 8 KB legend installable for a print
report without acquiring MapLibre, and prevent a change in particle rendering
from being able to affect raster rendering.

## 4. Generalise rather than rename

This rule performed the majority of the consolidation work.

Six variable-specific raster components were **not** republished as six renamed
packages. They were reduced to one generic layer whose variation is two props:

```tsx
<RasterLayer data={precipitation} colorScale={bluePalette} min={0} max={120} />
<RasterLayer data={probability}   colorScale={plasma}      min={0} max={100} />
```

The test applied to every candidate: *if two components differ only in the data
they receive and the configuration they apply, they are one component.*

The same reasoning produced a single `VectorLayer` in place of per-geometry
overlays, a single `GeoLegend` in place of per-variable legends, and a single
`GeoHover` in place of per-layer readout cards.

**Rationale.** A refactor that relocates duplication into packages preserves the
duplication and adds manifests.

## 5. Shared runtimes are peer dependencies

React, MapLibre GL, deck.gl and WeatherLayers GL are never bundled into a
package. They are declared as peers with deliberately wide ranges:

```jsonc
"peerDependencies": {
  "react": "^18.2.0 || ^19.0.0",
  "maplibre-gl": "^4.0.0 || ^5.0.0"
}
```

**Rationale.** Two instances of React in one module graph produce
`Invalid hook call` or hooks that resolve to null. MapLibre and deck.gl maintain
module-scoped registries and fail comparably — layers constructed against one
instance are rejected by the other, without a build error. Peer declaration
guarantees a single instance resolved by the consuming application, and prevents
the library from forcing a major-version upgrade.

---

## Capabilities excluded by these rules

Applying the rules consistently required declining to build components that
appear useful in isolation:

| Excluded | Reason |
| --- | --- |
| Layer picker / overlay toggle panel | Encodes an application's information architecture, not a cartographic capability |
| Site or region selector | Application domain |
| Model or forecast-run switcher | Application domain |
| Alert and notification panels | Application domain |
| A data-fetching hook | Would introduce authentication, caching and error policy into the presentation tier |
| A composed `<WeatherMap>` preset | Would fix one product's layer composition inside a package |

Each is a small amount of code in a host application, and none generalises
across two products.

## Applying the rules to new code

Evaluate a proposed addition in order:

1. **Does it retrieve, cache or authorise?** It belongs in the host application.
2. **Does it name a domain concept** — a variable, a product, a site? It is a
   prop, not a component.
3. **Does it duplicate an existing package under different configuration?** It
   is a prop on that package.
4. **Does it require a sibling layer package to function?** The boundary is
   drawn in the wrong place.

See [Adding a Package](/docs/adding-a-package) for the mechanics once a genuine
new capability is established.
