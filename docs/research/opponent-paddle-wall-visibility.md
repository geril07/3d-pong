# Opponent paddle: room containment vs wall visibility

Date: 2026-07-13

> Implementation update: the current worktree now defines the rim width in
> `PaddleConfig`, derives both movement areas from the larger of the collision
> and rendered footprints, and guards the real Three.js mesh bounds with a
> deterministic Vitest test. The investigation below documents the pre-fix
> state that motivated those changes.

## Question

There are two potentially independent symptoms:

1. the opponent paddle may reach or cross the visual room boundary;
2. the opponent paddle may be composited visibly over/through a wall even when its gameplay position is valid.

This note investigates the current worktree only. It does not change product code.

## Short answer

- The normal simulation **does clamp the opponent paddle center** in X/Y and fixes its Z. The rounded-box body remains inside the room's *nominal logical volume*, exactly touching its X/Y boundaries at the extreme positions.
- The complete visible paddle is not contained: its shader rim extends `0.14` world units beyond the body on every X/Y edge. At an extreme center position it therefore extends `0.14` beyond the nominal room.
- In arena variant A, the wall is a box centered on the nominal boundary. Consequently, even the rounded-box body overlaps the inward half of a side/top wall by `0.01875` at the extreme position.
- Independently, the wall, paddle body, paddle rim, and rails are transparent and have `depthWrite: false`. The rim has `renderOrder = 10`, above the rails' `5` and the walls' default `0`. This deliberately permits the rim to be painted after the transparent room geometry.
- Variants A and C also apply full-scene screen-space bloom. Bloom can spread an already-rendered bright pixel across a geometric silhouette without consulting scene depth.

Therefore, making the paddle footprint fit inside the room is likely to fix an edge/corner intersection, but it is **not statically provable that it fixes the reported visual symptom**. One screenshot or deterministic visual reproduction is needed to distinguish body intersection, shader rim, bloom halo, and intentional visibility through translucent glass.

## Primary sources

The project declares Three.js `^0.185.1` and locks `0.185.1` ([`package.json`](../../package.json#L13-L20), [`package-lock.json`](../../package-lock.json#L1089-L1094)). Claims below are based on the project's source/tests and the matching installed Three.js source. The corresponding official Three.js API references are [Material](https://threejs.org/docs/#api/en/materials/Material) and [Object3D.renderOrder](https://threejs.org/docs/#api/en/core/Object3D.renderOrder).

## Problem 1: does the opponent paddle leave the room?

### Simulation constraint

The default arena and paddle values are defined together in [`GameSimulation.ts`](../../src/simulation/GameSimulation.ts#L154-L191):

| Quantity | Value |
|---|---:|
| Arena width / half-width | `9.36` / `4.68` |
| Arena height | `4.608` |
| Arena depth / half-depth | `9.2` / `4.6` |
| Paddle visible size | `0.9 × 0.6 × 0.12` |
| Opponent center X | `[-4.23, 4.23]` |
| Opponent center Y | `[0.3, 4.308]` |
| Opponent center Z | `-4.35` |

The bot first clamps its desired target to `opponentArea` ([`chooseBotTarget`](../../src/simulation/GameSimulation.ts#L607-L637)). Its actual movement independently clamps X/Y to the paddle state's movement area and resets Z to `movementArea.z` on every running step ([`movePaddle`](../../src/simulation/GameSimulation.ts#L640-L668)). Rendering then copies the snapshot position directly to the Three.js meshes ([`GameScene.render`](../../src/rendering/GameScene.ts#L263-L270)).

For a state produced by the normal `GameRuntime`, there is no unbounded opponent movement path: `GameRuntime` owns its state, initializes it through the simulation, and updates it only through `stepGame` ([`GameRuntime.ts`](../../src/simulation/GameRuntime.ts#L16-L42)).

Existing tests exercise bot speed and upper position limits and separately all four target limits ([`GameSimulation.test.ts`](../../src/simulation/GameSimulation.test.ts#L752-L805)). They do not yet assert the full rendered footprint or all four limits of the actual opponent position. The targeted simulation suite currently passes: 57/57 tests on 2026-07-13.

### Exact body bounds

The rounded-box half-size is `(0.45, 0.30, 0.06)`. At the allowed center limits:

```text
body X = [-4.23 - 0.45, 4.23 + 0.45] = [-4.68, 4.68]
body Y = [ 0.30 - 0.30, 4.308 + 0.30] = [0, 4.608]
body Z = [-4.35 - 0.06, -4.35 + 0.06] = [-4.41, -4.29]
```

Compared with the nominal room `X = [-4.68, 4.68]`, `Y = [0, 4.608]`, `Z = [-4.6, 4.6]`, the body is contained, but X/Y clearance is exactly zero.

### The visible rim does leave the nominal room

The paddle is not just the rounded box. `createPaddleRim` sets `glowWidth = 0.14` and creates a plane whose width and height are the visible body size plus twice that amount ([`GameScene.ts`](../../src/rendering/GameScene.ts#L348-L415)). Its half-size is therefore:

```text
rim half-width  = 0.9 / 2 + 0.14 = 0.59
rim half-height = 0.6 / 2 + 0.14 = 0.44
```

At the movement limits:

```text
rim X = [-4.23 - 0.59, 4.23 + 0.59] = [-4.82, 4.82]
rim Y = [ 0.30 - 0.44, 4.308 + 0.44] = [-0.14, 4.748]
```

Thus the rim plane exceeds each nominal side/floor/ceiling boundary by exactly `0.14`. This is statically confirmed and does not need a screenshot.

### Variant A body/wall overlap

Variant A builds side, ceiling, and rear walls as boxes of thickness `0.0375`, centered on the nominal boundary ([`ArenaRoom.ts`](../../src/rendering/ArenaRoom.ts#L5-L7), [`createGlassVolume`](../../src/rendering/ArenaRoom.ts#L175-L210)). The inward face of the right wall is:

```text
4.68 - 0.0375 / 2 = 4.66125
```

At maximum X the paddle body reaches `4.68`, so it overlaps the visual wall's inward half by:

```text
4.68 - 4.66125 = 0.01875
```

The same calculation applies to the left wall and ceiling. The floor is an infinitely thin plane at Y=0, so the body touches it while the rim crosses it. Variants B/C use infinitely thin glass planes on the nominal boundary ([`ArenaRoom.ts`](../../src/rendering/ArenaRoom.ts#L133-L171)); their body touches rather than penetrates those planes, but their rim still crosses them.

### Static verdict for containment

| Claim | Verdict |
|---|---|
| Opponent center can escape its movement area during normal running updates | **No**, statically ruled out |
| Rounded-box body can escape the nominal logical room | **No**, but it touches X/Y boundaries with zero clearance |
| Rounded-box body can intersect variant A's visual wall volume | **Yes**, by `0.01875` at side/top extremes |
| Complete visible paddle can escape the nominal room | **Yes**, rim by `0.14` in X/Y |
| Which of the above is the reported visible artifact | Needs a visual reproduction |

## Problem 2: visibility independent of containment

### Transparent/depth/render-order settings

The relevant current settings are:

| Object | Settings | Source |
|---|---|---|
| Glass walls | `transparent: true`, `depthWrite: false`, default `renderOrder = 0` | [`ArenaRoom.ts`](../../src/rendering/ArenaRoom.ts#L215-L261) |
| Paddle body | `transparent: true`, `opacity: 0.08`, `depthWrite: false`, default `renderOrder = 0` | [`GameScene.ts`](../../src/rendering/GameScene.ts#L418-L427) |
| Paddle rim | `transparent: true`, `depthWrite: false`, `renderOrder = 10` | [`GameScene.ts`](../../src/rendering/GameScene.ts#L348-L415) |
| Frame rails | `transparent: true`, `depthWrite: false`, `renderOrder = 5` | [`ArenaRoom.ts`](../../src/rendering/ArenaRoom.ts#L314-L329), [`ArenaRoom.ts`](../../src/rendering/ArenaRoom.ts#L431-L460) |

No paddle or wall material disables `depthTest`, so the Three.js default `true` applies. However, all of the transparent room/paddle materials above explicitly disable writes to the depth buffer. Three.js documents both defaults and effects in its official [Material API](https://threejs.org/docs/#api/en/materials/Material.depthTest); the matching installed source initializes `transparent = false`, `depthTest = true`, and `depthWrite = true` before project overrides ([Three.js r185 Material source](https://github.com/mrdoob/three.js/blob/r185/src/materials/Material.js#L100-L123), [depth source](https://github.com/mrdoob/three.js/blob/r185/src/materials/Material.js#L204-L230)).

Three.js places `transparent: true` materials in a separate transparent render list and sorts that list by group order, then `renderOrder`, then back-to-front depth ([Three.js r185 WebGLRenderLists source](https://github.com/mrdoob/three.js/blob/r185/src/renderers/webgl/WebGLRenderLists.js#L31-L49), [list classification/sort](https://github.com/mrdoob/three.js/blob/r185/src/renderers/webgl/WebGLRenderLists.js#L122-L166)). The project comment explicitly says the rail ordering was chosen so rails do not paint over the paddle border ([`ArenaRoom.ts`](../../src/rendering/ArenaRoom.ts#L374-L377)).

Consequences:

- The rim (`10`) is drawn after walls (`0`) and rails (`5`).
- Since those earlier transparent surfaces do not write depth, they cannot later reject the rim through the depth buffer.
- The body and walls both use order `0`, so their relative order falls back to object-level depth sorting. Object-level sorting cannot produce a generally correct result for intersecting transparent volumes; appearance can change with camera/position even though the configuration is static.
- The glass itself is intentionally translucent (`faceAlpha` between `0.025` and `0.08`, edge alpha between `0.065` and `0.2`), so seeing an object physically behind it is not automatically a depth bug ([`ArenaRoom.ts`](../../src/rendering/ArenaRoom.ts#L123-L171)).

This is WebGL transparent compositing, not a CSS `z-index`. The code statically confirms that the configuration permits the rim to appear over the room geometry. A screenshot is still needed to decide whether that permitted behavior is the reported defect.

### Bloom can cross silhouettes

Production and the default development URL select variant A ([`ArenaVisualPrototype.ts`](../../src/rendering/ArenaVisualPrototype.ts#L19-L34)). Variants A and C run a full-scene `UnrealBloomPass`; variant B instead renders a selective arena-rail bloom layer ([`GameScene.ts`](../../src/rendering/GameScene.ts#L145-L213), [`GameScene.render`](../../src/rendering/GameScene.ts#L285-L290)). The paddle remains on the default layer, so layers are not a direct visibility cause in variant B.

`UnrealBloomPass` extracts bright pixels from the already-rendered color texture, progressively blurs them, and additively blends the result back ([official Three.js r185 source](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/postprocessing/UnrealBloomPass.js#L282-L368); see also the official [UnrealBloomPass API](https://threejs.org/docs/#examples/en/postprocessing/UnrealBloomPass)). That post-process has no scene-depth input in this pipeline. Therefore a qualifying bright pixel can create a halo across a wall/frame silhouette in A/C even if the original geometry passed a correct depth test.

The mechanism is statically present; whether the magenta opponent rim exceeds the current bloom threshold in the observed pixels, and whether the reported artifact is this broad halo rather than the rim's own `0.14` shader falloff, requires a rendered frame or pixel capture.

## Will a containment fix make the rendering issue disappear?

It depends on the observed shape and location:

| Observation | Most likely mechanism | Would containment alone likely solve it? |
|---|---|---|
| Only at left/right/top/bottom extremes; thin magenta outline | Rim crosses boundary and is ordered above rails | Likely, if containment includes the rim footprint and clearance |
| Only at extremes; translucent rounded body overlaps wall | Body has zero logical clearance / variant A wall intrudes inward | Likely |
| Broad soft halo outside a rail, especially variant A/C | Full-scene bloom | Not guaranteed |
| Paddle/body visible through rear glass while centered | Intentionally translucent glass and transparent ordering | No |
| Artifact changes when the camera/position changes despite no boundary crossing | Intersecting transparent-object sort | Not guaranteed |

A single screenshot/video frame should identify body vs thin SDF rim vs broad bloom. It should include the active `?variant=` value if running in development. A center position and an edge position are sufficient for the first discrimination.

## Minimal red-capable feedback loop

No product fix is needed to establish the loop.

### 1. Fast geometry/config tests (Vitest)

Add two separate invariants rather than conflating simulation and visuals:

1. **Simulation-center invariant (expected green today):** drive an incoming ball/bot toward all four corners with extreme tracking error and assert actual `opponentPaddle.position.x/y` against both min and max limits plus `z === opponentArea.z`. This closes the existing test gap around actual minimum positions.
2. **Rendered-footprint invariant (expected red today):** for every movement-area corner, compare:
   - body AABB against the intended inner room surface; variant A fails by `0.01875` on side/top extremes;
   - rim AABB (`body half-size + glowWidth`) against the nominal room; current code fails by `0.14` on every X/Y edge.

The second test requires `glowWidth` and wall thickness to be available to the test from a shared visual specification or a small rendering-geometry seam. That is preferable to copying magic numbers into a simulation test. Before changing code, decide whether the contract is “inside nominal coordinates” or “clear of the inner visual wall”; those are different assertions.

### 2. Deterministic browser frame (visual discriminator)

Use a test-only scene route/harness that renders a fixed `GameSnapshot` and pauses animation. Capture this small matrix:

```text
positions: center, minX, maxX, minY, maxY, and four corners
variants:  A, B, C
toggles:   normal; bloom strength 0; rim hidden
```

Start with variant A at center and one implicated corner. That is the minimum useful repro. Classify the changed pixels:

- disappears when rim is hidden -> rim extent/order;
- remains without rim but disappears away from the boundary -> body/wall overlap;
- remains with rim but disappears when bloom is zero -> post-process halo;
- remains at center with both rim and bloom removed -> translucent wall/body composition.

For an automated red rather than a subjective screenshot review, define a projected room mask and assert that opponent-colored pixels outside it stay below a tolerance. Keep a normal screenshot alongside it for diagnosis. Run the same capture at a fixed viewport and device-pixel ratio to avoid antialiasing noise.

## Conclusion

The two concerns are real but not equivalent:

- **Containment:** the simulation center/body contract is bounded, while the actual visible rim is not; variant A also has a small body/wall volume overlap at the extremes.
- **Compositing:** transparent no-depth-write materials, explicit rim-over-rail ordering, and possible screen-space bloom can show opponent color across room geometry without any illegal simulation position.

The code is sufficient to prove both risk classes. Visual evidence is needed only to map the user's observed pixels to one of them and decide whether a containment-only fix is sufficient.
