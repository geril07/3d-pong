# Goal-scored ball disappearance effects

Date: 2026-07-13

> Implementation update: the prototype now follows this note's recommended
> production seam. Score events include the exact integrated `exitBall`
> position and velocity from before reset; the render effect continues from
> that state with linear `velocity × elapsed time` motion. The investigation
> below documents the pre-fix behavior and the reasoning that led to this seam.

## Question

When a shot crosses a scoring plane, the rendered ball appears to vanish rather
than complete its motion. Which disappearance effects would fit the current
Void Pearl / neon-room visual language, remain inexpensive in Three.js, and be
specific enough to prototype without changing gameplay?

This note uses the current repository and primary Three.js documentation,
examples, and source. It does not change production code.

## Short answer

Prototype these two first:

1. **Void Collapse** — freeze the final wake, pull it and the pearl into a tiny
   point at the goal, then release one thin cyan/magenta ring and a few motes.
   This best extends the existing Void Pearl / hollow-smear language and is the
   least risky implementation.
2. **Prismatic Dust** — keep the pearl readable for about 100 ms, then peel it
   into 96–128 cyan/magenta point particles that drift through the goal and
   slightly outward. This is the clearest version of the requested
   “disintegration” effect and can still be one particle draw call.

Keep **Crystal Fracture** as an optional third comparison: 24–32 instanced dark
shards with colored edges. It can be performant, but at the ball's current
on-screen size it may read as noisy pixels rather than intentional fragments.

All prototypes should last **0.55–0.65 seconds**, remain entirely in the
rendering layer, use fixed preallocated objects, and derive animation from
normalized elapsed time. The current serve delay is 0.9 seconds, so this leaves
a quiet beat before the next serve without delaying gameplay.

## Why the current transition is abrupt

The score event does not contain the crossing position; it contains only the
scoring and losing sides ([`GameSimulation.ts`](../../src/simulation/GameSimulation.ts#L117-L131)).
In the same simulation step that emits that event, `applyScore` replaces the
ball with a reset ball at room center
([`GameSimulation.ts`](../../src/simulation/GameSimulation.ts#L448-L484)).

Rendering then makes the discontinuity stronger:

- it handles the score event first and immediately deletes the stored trail and
  last trail position ([`GameScene.ts`](../../src/rendering/GameScene.ts#L208-L210),
  [`GameScene.ts`](../../src/rendering/GameScene.ts#L235-L257));
- it then copies the already-reset snapshot position to the visible ball
  ([`GameScene.ts`](../../src/rendering/GameScene.ts#L212-L214)).

Therefore the effect needs a render-owned snapshot of the last visible ball
position and trail. For a throwaway prototype, capture them **before** clearing
feedback state and spawn the effect there. This is preferable to changing the
simulation contract while choosing an art direction. If the effect is promoted,
including the crossing position and incoming velocity in the score event would
be the cleanest deterministic contract.

## Relevant capabilities in the current renderer

The existing ball already has three layers (dark standard-material pearl,
additive Fresnel rim, white core) and an eight-segment additive wake
([`BallVisual.ts`](../../src/rendering/BallVisual.ts#L31-L84)). That makes reuse
or visual matching straightforward. The renderer is already WebGL-based and
uses custom `ShaderMaterial`s, a half-float composer, and an additive selective
bloom composite ([`GameScene.ts`](../../src/rendering/GameScene.ts#L44-L49),
[`GameScene.ts`](../../src/rendering/GameScene.ts#L111-L172)).

Three.js officially supports the main low-cost building blocks:

- `ShaderMaterial` accepts per-frame uniforms, and changed uniform values are
  refreshed without rebuilding the material; it is specifically intended for
  effects not provided by built-in materials
  ([Three.js `ShaderMaterial`](https://threejs.org/docs/pages/ShaderMaterial.html)).
- `PointsMaterial` renders point primitives, supports alpha maps, and attenuates
  size with perspective; point size does have a hardware-dependent maximum
  ([Three.js `PointsMaterial`](https://threejs.org/docs/pages/PointsMaterial.html)).
  The official custom-attribute particle example demonstrates a single
  `BufferGeometry` with per-particle color and size attributes
  ([live example](https://threejs.org/examples/webgl_buffergeometry_custom_attributes_particles.html),
  [official source](https://github.com/mrdoob/three.js/blob/r185/examples/webgl_buffergeometry_custom_attributes_particles.html)).
- `BufferAttribute` supports custom attributes, dynamic usage hints, explicit
  `needsUpdate`, and partial update ranges
  ([Three.js `BufferAttribute`](https://threejs.org/docs/pages/BufferAttribute.html)).
- `InstancedMesh` is designed for many objects sharing geometry/material but
  having different transforms, specifically to reduce draw calls; changed
  matrices or colors require their corresponding `needsUpdate` flags
  ([Three.js `InstancedMesh`](https://threejs.org/docs/pages/InstancedMesh.html)).
- A planar pulse can use built-in `RingGeometry`, while a volumetric ring can
  use `TorusGeometry`
  ([Three.js `RingGeometry`](https://threejs.org/docs/pages/RingGeometry.html),
  [Three.js `TorusGeometry`](https://threejs.org/docs/pages/TorusGeometry.html)).
- Additive transparent materials should generally retain depth testing but not
  write depth, matching the current rim and wake. Three.js documents that
  transparent objects receive special rendering treatment, `depthWrite`
  controls writes to the depth buffer, and `AdditiveBlending` is a supported
  mode ([Three.js `Material`](https://threejs.org/docs/pages/Material.html)).

## Technique comparison

| Technique | What the player sees | Temporary render cost | Fit / risk |
|---|---|---:|---|
| Frozen-wake implosion + ring | The final smear compresses into the pearl; pearl pinches to a point; a thin ring confirms the score | Reuse 8 wake meshes plus 1–2 small rings; no new per-frame allocation | **Best fit, low risk.** Strong continuity with the selected ball; easy to read at small scale |
| Point disintegration | Pearl remains recognizable, then becomes colored dust moving through and away from the goal | 1 `THREE.Points` draw + optional ring; 96–128 particles | **Strong fit, medium shader work.** Most literal requested effect; point size must stay below hardware caps |
| Instanced shard fracture | Dark pieces with cyan/magenta faces split and tumble | 1 instanced draw for 24–32 shards + optional ring | **Medium fit, medium risk.** Geometric and premium if readable; likely too busy at the far goal |
| Procedural shader dissolve | Noise eats across the sphere with a bright erosion boundary | 1–2 sphere draws and uniform updates | **Medium fit, higher integration risk.** Elegant cost, but the current pearl spans three materials; preserving its PBR center, Fresnel rim, and core requires coordinated material changes |
| Sprite flash / afterimage only | Camera-facing flare or ghost fades at the crossing point | 1 sprite draw | **Useful accent, weak primary effect.** Cheap and readable, but still feels like a fade rather than a physical disappearance. A sprite always faces the camera, which is useful for a goal flash ([Three.js `Sprite`](https://threejs.org/docs/pages/Sprite.html)) |

### 1. Frozen-wake implosion and ring

This technique uses the material language already on screen. At the score
event, clone or freeze the last 6–8 sampled wake positions. Instead of deleting
them, interpolate every position toward the captured goal point while reducing
thickness. Simultaneously scale a render-only copy of the ball down nonlinearly.

Suggested timing (total 600 ms):

| Time | Motion |
|---:|---|
| 0–90 ms | One-frame visual hold, then rim brightens and pearl compresses slightly along the shot axis |
| 90–300 ms | Wake samples pull toward the goal point from oldest to newest; pearl scales from `1` to `0.08` |
| 220–420 ms | A thin goal-facing ring contracts from `2.4 × radius` to almost zero, reinforcing suction |
| 300–560 ms | A second faint ring expands from `0.2 × radius` to `4 × radius` and fades; 8–12 tiny fixed motes follow it |
| 560–600 ms | All effect objects become invisible and reset for reuse |

The first ring should face the room rather than the camera: its normal aligns to
the scoring direction (`+Z` at the player's goal, `-Z` at the opponent's). A
low-segment `RingGeometry` gives the desired flat graphic shape with one mesh.
The second ring is deliberately faint; the dominant read should be “swallowed
by the void”, not “explosion”.

Why this is likely to work:

- the user already selected the pearl and hollow smear, so no new visual
  vocabulary is introduced;
- most geometry and materials already exist;
- the moving objects are few enough that simple CPU transforms are adequate;
- it remains legible when the ball scores at either near or far goal.

Main failure mode: if the wake collapses uniformly, it can resemble rewinding.
Avoid that by adding a slight spiral/twist around the shot axis and an asymmetric
delay from oldest to newest segment.

### 2. Point disintegration / Prismatic Dust

Build a single `BufferGeometry` with 96–128 points. Static attributes can hold:

- `origin`: deterministic point on or just inside the ball surface;
- `direction`: normalized radial direction biased 55–65% along the incoming
  shot direction so dust continues through the goal;
- `delay`: fixed stagger in `[0, 0.18]` seconds;
- `size`: small fixed range, roughly `1.5–5` CSS pixels at reference depth;
- `colorBias`: cyan-to-magenta mix, with about 10% near-white sparks.

Animate them entirely in a custom vertex shader from one normalized `progress`
uniform: hold until each point's delay, accelerate outward, add a gentle curl,
and shrink point size near the end. The fragment shader should draw a soft disc
from `gl_PointCoord` and fade its edge. The official Three.js particle example
uses the same custom-attribute pattern, including per-point size and color
([example source](https://github.com/mrdoob/three.js/blob/r185/examples/webgl_buffergeometry_custom_attributes_particles.html)).

Suggested timing (total 640 ms):

| Time | Motion |
|---:|---|
| 0–110 ms | Pearl holds, rim overexposes, core expands from `1` to `1.4` |
| 80–320 ms | Points peel off in staggered bands; pearl opacity/scale falls to zero |
| 180–520 ms | Dust continues through the goal, curls 10–20 degrees around the shot axis, and spreads to at most `3.5 × radius` |
| 420–640 ms | Dust sizes and opacity fall to zero; a small residual white spark dies last |

Use one preallocated points object, not one sprite or mesh per particle. Static
attributes need no per-frame buffer upload; only the progress, direction, and
origin uniforms change. `PointsMaterial.size` can be hardware-capped, so the
custom point shader should keep sizes intentionally small rather than relying on
large glow quads ([Three.js `PointsMaterial`](https://threejs.org/docs/pages/PointsMaterial.html)).

Main failure mode: additive particles over the cosmic backdrop can become
visual confetti. Keep most particles dark cyan/magenta, use a short travel
distance, and preserve the strong forward bias so the silhouette reads as one
disintegrating object.

### 3. Instanced Crystal Fracture (optional)

Create 24–32 very small tetrahedral or triangular shards sharing one geometry
and material. Store deterministic initial positions, directions, spin axes, and
delays. Update their matrices from elapsed progress and upload
`instanceMatrix.needsUpdate = true` once per frame. `InstancedMesh` exists for
exactly this shared-geometry/different-transform case and reduces the fragments
to one draw call ([Three.js `InstancedMesh`](https://threejs.org/docs/pages/InstancedMesh.html)).

Art direction: nearly black shard bodies, alternate cyan/magenta emissive edges,
forward-biased motion, and a fast inward pinch before the break. Avoid a broad
radial explosion. This is worth prototyping only if the point version feels too
soft; at the current ball radius (`0.13`) individual shards at the far goal may
not remain legible.

### 4. Shader dissolve (not first choice)

A dissolve is possible with a deterministic object-space threshold and a bright
narrow band around the threshold. `ShaderMaterial` exposes a per-frame progress
uniform and full fragment control
([Three.js `ShaderMaterial`](https://threejs.org/docs/pages/ShaderMaterial.html)).
Built-in materials also expose `alphaTest` and `alphaHash`; Three.js describes
alpha hashing as grainy threshold-based transparency that avoids conventional
sorting issues ([Three.js `Material`](https://threejs.org/docs/pages/Material.html)).

However, the current pearl is not one material: it combines a standard material,
an additive shader rim, and a white additive core. A convincing dissolve must
coordinate all three and add an erosion edge, or it will look like unrelated
layers switching off. Using `onBeforeCompile` to retain the standard material is
possible but is WebGLRenderer-specific and tightly coupled to built-in shader
chunks; the Three.js documentation now recommends node materials for new
customization work ([Three.js `Material.onBeforeCompile`](https://threejs.org/docs/pages/Material.html#onBeforeCompile)).
That is too much architecture for the first visual prototype.

## Recommended prototype specifications

### Prototype A — Void Collapse

- **Anchor:** last rendered ball position before score reset.
- **Direction:** from the last two trail samples; fall back to `+Z`/`-Z` from
  `lostSide`.
- **Duration:** 600 ms.
- **Objects:** render-only ball copy, frozen copy of last wake, two rings, 8–12
  motes.
- **Palette:** current pearl black, `0x55e7ff`, `0xff55dd`, tiny white endpoint.
- **Motion character:** inward, forward, slightly helical; no broad explosion.
- **Acceptance read:** at both goals, a viewer should be able to point to the
  exact place where the ball was consumed; no teleport to room center is visible.

### Prototype B — Prismatic Dust

- **Anchor / direction:** same as A.
- **Duration:** 640 ms.
- **Objects:** render-only ball copy, one 112-point buffer, one very faint ring.
- **Palette:** 45% cyan, 45% magenta, 10% white; dark centers and short additive
  edges so it remains coherent with the pearl.
- **Motion character:** staged surface peel, 60% forward bias, small curl, tight
  maximum spread.
- **Acceptance read:** the ball visibly becomes particles rather than simply
  fading; the far-goal version remains a single clustered event.

### Optional Prototype C — Crystal Fracture

- **Duration:** 560 ms.
- **Objects:** render-only ball copy, one 28-instance shard mesh, one ring.
- **Motion character:** 80 ms pinch, then compact forward fracture with tumbling.
- **Kill criterion:** discard if shards are not individually readable at the far
  goal at the normal camera and viewport.

## Deterministic, repeatable prototype harness

The visual choice can be made repeatable even without a screenshot baseline:

1. Add a development-only query parameter such as `?goalEffect=A` / `B` / `C`.
2. Add a key or small overlay control that triggers the effect without waiting
   for a rally, alternating the two goals and cycling fixed X/Y anchors (center,
   four corners).
3. Use fixed attribute arrays. Do not call `Math.random()` while spawning or
   updating the effect. A fixed Fibonacci-sphere distribution or a tiny seeded
   PRNG initialized from `(variant, goal side, anchor index)` is sufficient.
4. Store `startedAtSeconds` and compute
   `progress = clamp((now - startedAt) / duration, 0, 1)`. Do not integrate
   particle positions by per-frame delta; this makes the pose at a given elapsed
   time independent of frame count.
5. Preallocate every geometry, material, typed array, and temporary vector at
   scene construction. Toggle `visible` and reset uniforms/matrices between
   runs. Three.js does not automatically release GPU resources when a mesh is
   removed, so repeated creation requires explicit disposal
   ([Three.js disposal guide](https://threejs.org/manual/en/how-to-dispose-of-objects.html)).
6. In the prototype harness, expose a paused normalized time slider (`0..1`) or
   accept `?goalEffectTime=0.35`. This makes comparisons and later regression
   screenshots possible at exact effect phases.
7. Compare at a fixed viewport and device pixel ratio, with one capture each at
   the near goal and far goal. The far goal is the stricter readability test.

For real score events, keep the animation clock in rendering rather than using
`snapshot.activeTimeSeconds`: active simulation time can pause or jump between
phases, while the effect should finish smoothly during `serve-delay`. A render
timestamp mapped to normalized progress also naturally survives variable frame
rates.

## Integration guardrails

- The effect is feedback, not simulation. It must not postpone scoring, change
  collision, or alter the 0.9-second serve delay.
- Hide or delay the reset-center production ball while the goal copy animates;
  otherwise the viewer sees two balls. Reveal the center ball after roughly
  350–450 ms, preferably with a subtle 120 ms scale-in.
- A second score cannot normally arrive during `serve-delay`, so one reusable
  effect instance is enough. Restart it cleanly on match restart.
- Keep depth testing enabled so fragments remain spatially grounded; use
  `depthWrite: false` on transparent/additive dust and rings, matching the
  current ball rim and trail.
- Do not route temporary goal particles onto `ARENA_BLOOM_LAYER` unless a
  prototype proves it is necessary. Their additive material can be bright
  without adding another wide screen-space halo, and the current bloom composer
  is deliberately selective to the arena layer.
- Measure temporary cost with `renderer.info.render.calls`. Target no more than
  **3 extra draw calls** for Prismatic Dust / Crystal Fracture and no more than
  **12** for the deliberately reused wake-based Void Collapse. Three.js exposes
  renderer statistics specifically for monitoring draw and memory behavior
  ([Three.js `WebGLRenderer.info`](https://threejs.org/docs/pages/WebGLRenderer.html#info)).

## Recommendation

Build A and B side by side with identical anchor, duration controls, camera,
and goal positions. A is the likely production winner because it completes the
existing Void Pearl visual idea; B is the important contrasting prototype
because it tests whether a more literal, detailed disintegration feels better.
Only build C if A feels too subtle and B feels too soft.

The key technical correction is independent of the chosen art direction: retain
the final rendered goal position/trail long enough to animate a render-only copy.
Without that seam, every effect starts at the reset center or loses the motion
context that would make the disappearance feel intentional.
