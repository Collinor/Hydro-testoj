# Sixth UI

`@hydrooj/sixth-ui` is the isolated hexagonal interface package for SixthOJ. It keeps Hydro's routes, permissions, data contracts, and translations while supplying its own theme configuration, homepage composition, and responsive presentation layer.

## Configuration

The system settings page exposes `sixth-ui.brand`, `sixth-ui.palette`, `sixth-ui.allowUserPalette`, and the optional `sixth-ui.customBackground`, `sixth-ui.customTheme`, `sixth-ui.customTitle`, `sixth-ui.customText`, and `sixth-ui.customAccent` color overrides. Empty custom color values inherit from the selected preset.

The `cheese` preset is defined in `presets.ts`. Add future presets there so component styles continue to consume semantic CSS properties instead of direct color values.

## Homepage tree

The central homepage navigation is configured in `homepage-tree.json`. The file uses a versioned tree so layout changes do not require editing templates or TypeScript.

- `version` must be `1`.
- `root` is the central hexagon.
- Every node requires a unique `id`, either `label` or `labelKey`, and an `action`.
- `action.type` is `route` for a link or `expand` for a branch that reveals all descendants beneath the central-ring parent.
- A `route` action requires the exact registered Hydro navigation route in `action.name`.
- `side` is the preferred initial parent edge, numbered `0` through `5` clockwise from the top edge. It does not fix the final position.
- `childSector: "bottom-right"` constrains every expanded descendant center to the parent's visual `-120deg` through `0deg` lower sector while retaining collision checks and dense packing.
- `requiresAuth` shows a node only to authenticated users; `requiresGuest` shows a node only to unauthenticated users.
- The root contains at most six visible first-level nodes after authentication conditions are applied. Expanded branches may contain more descendants because the packing search adds rings as needed. First-level nodes use scale `1.4` against the root scale `1.7` (about 17.6% smaller). Expanded descendants use scale `1.15` against their first-level parent scale `1.4` (about 17.9% smaller) and a seeded rotation within `gr - 2deg` through `gr + 2deg`.

Exactly one central-ring parent can be expanded. Every visible node is placed by a responsive dense-packing search that checks rotated hexagon clearance against all previously placed nodes. All descendants revealed by one first-level parent are packed around that parent instead of starting additional nested orbits. The root node stays on the anchor computed from the always-visible first-level cluster, so expanding or collapsing descendants does not move it. The search samples directions from the current parent and child sizes and advances outward in one-gap increments, preserving clearance while avoiding coarse empty rings. It starts at the preferred edge, explores the full circle, expands outward only when the inner ring is full, and strongly penalizes horizontal overflow around the fixed root so narrow screens naturally form taller clusters. Viewport resizing reruns the placement search with the current node dimensions without scaling the whole tree. Newly revealed descendants start at the first-level parent's position, then move outward while fading in.

First-level nodes use their configured `side` as fixed 60-degree slots on one shared radius. The radius expands only when required to preserve hexagon clearance, keeping all six center-to-center intervals equal instead of passing the first level through the free-form packing score.

The six descendants in the `bottom-right` sector use the nearest six sites of a triangular lattice. One spacing value is solved from every rotated-hexagon pair, so adjacent child centers stay evenly spaced while the whole lattice expands only when another visible node requires more clearance. The first-level shared radius includes one additional tree-gap unit to separate the six-node ring from the root.

## User palette API

When `sixth-ui.allowUserPalette` is enabled, integrations can call `window.SixthUI.applyPalette(colors, true)` to validate and save browser-local overrides. `window.SixthUI.resetPalette()` removes them and restores the server palette.

The supported color keys are `background`, `theme`, `title`, `text`, and `accent`. `background` fills the page background, while `theme` fills regular hexagonal navigation blocks.
