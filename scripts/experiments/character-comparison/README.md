# Character renderer comparison

Local page: `/experiments/characters/compare` (returns 404 outside development).
Existing procedural Pixi rig: `/experiments/characters`.

## Spine + PixiJS

Uses the official `@esotericsoftware/spine-pixi-v8` 4.2 runtime, added as a development dependency. The official Spineboy 4.2 sample skeleton and atlas load from Esoteric Software's own server. Internet access is required for that panel. These are reference assets, not Unwatched artwork. Preserve the runtime's license notice and resolve editor/runtime licensing before adopting or distributing an integration; installing an npm package does not grant a Spine Editor license.

- https://esotericsoftware.com/spine-pixi
- https://esotericsoftware.com/spine-examples-spineboy
- https://esotericsoftware.com/spine-runtimes-license

## Blender + Three.js

Original early character blockout built with `blender-citizen.py` in Blender 5.2, through Higgsfield's Blender worker. It uses a 15-bone armature, weighted component meshes, an authored motion timeline and a Smile shape key. It is intentionally not a finished production asset or a crowd performance benchmark.

Files: `apps/web/public/studies/blender-citizen.blend` and `.glb`. The Blender source is editable; the GLB runs in the existing Three.js dependency. No model calls occur during playback. The browser replaces exported lights with its comparison studio lighting. The facial shape key is controlled separately from the skeletal animation.

Authored timeline at 24 fps: idle 0–2 seconds, walk 2–6 seconds, wave 6–10 seconds. The viewer isolates the steady middle of the walk for repeat playback. Camera orbit, zoom, playback speed, scale and skeleton overlays are preview controls only.

Remote source project: https://higgsfield.ai/3d-jutsu/78b21f68-93e2-4fa2-9c25-2415b2d92c26

The comparison does not change town rendering or agent behavior. Both renderers pause offscreen and when the tab is hidden, respect reduced-motion on initial playback, and clean up their GPU resources on unmount.
