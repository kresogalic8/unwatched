# Unwatched — Mara character production brief

## Assignment

Create one production-quality painted 2D citizen for our existing PixiJS + Spine runtime. Mara is the pilot character: prove the artwork and animation pipeline with her before producing other citizens or variations.

The current automated rigs have been rejected. Do not polish, reuse or trace their segmented parts, bone placement or motion curves. The complete Mara illustration is a visual reference candidate, not approved production anatomy or ready-to-rig artwork.

## Visual direction

Warm, hand-painted island resident: ivory linen shirt, coral neck scarf, blue-green trousers, worn brown shoes, short brown hair. Preserve the approachable face, fabric texture and natural proportions. Movement should feel relaxed and grounded, with restrained gestures rather than exaggerated puppet motion.

Reference: `apps/web/public/characters/mara-gold/source/mara-master-v1.png`.

Review the character at close-up and inside the actual `/town` renderer. A separate mock background is not proof of production scale or perspective compatibility.

## First milestone — layered art and setup pose

Deliver a layered PSD or Krita source and an editable Spine project. Start with one three-quarter view, matching the reference direction. Agree the silhouette and joint anatomy before animation.

Draw the surfaces that become visible when a limb moves. Cropping the visible silhouette from the flat reference is insufficient. Overlap depth must cover the intended motion range; a fixed percentage is not an acceptance criterion.

| Area | Required construction |
| --- | --- |
| Head and neck | Continuous neck beneath jaw, collar and scarf; no detached head or exposed straight cut during head turns. |
| Shoulders | Complete shoulder caps and underarm material; sleeve volume preserved when the arm rises. |
| Arms | Distinct anatomical left/right upper arms, forearms and hands; elbow bends keep volume. |
| Wrists | Hand bases and forearms overlap naturally without cuffs of skin, steps or abrupt colour changes. |
| Torso and pelvis | Separate deformable areas; continuous waistband and hidden trouser material during weight shifts. |
| Legs | Separate left/right thighs, shins and feet; knee and hip surfaces remain covered through the stride. |
| Feet | Heel and toe articulation or equivalent deformation for contact, roll and push-off. |
| Face | Separate eyes/lids, brows and mouth attachments for blink and restrained expressions. |
| Secondary motion | Hair and scarf elements that can move subtly without breaking the main silhouette. |

Use anatomical left/right names throughout; screen-left is not the character's left. Deliver relaxed and open hands for the first milestone. Grip and pointing variants follow after the rig is accepted.

## Second milestone — idle and walk only

Idle: subtle breathing, occasional blinking, small gaze/head movement and natural weight distribution. Feet must stay on the ground. Avoid scaling or bobbing the entire painting to simulate breathing.

Walk: a complete looping cycle with contact, down, passing and up poses. Pelvis shifts with support, torso counter-rotates and arms swing in opposition. Knees bend in the correct direction. The far leg must remain in its proper depth lane. Supporting feet must not skate, sink or float.

Deliver an in-place cycle with its intended travel speed documented, plus a moving demonstration using that speed. The application controls actual world movement; animation must synchronize with distance travelled. Confirm smooth transitions between idle and walk.

Do not start wave, sitting, carrying or additional viewing angles until these two animations pass review.

## Review and acceptance

Supply a browser-playable export, editable source and a short contact sheet covering eight evenly spaced walk poses. Review both slow playback and normal speed, including the loop boundary.

- Setup pose matches the approved layered drawing when overlaid; no missing pixels, duplicated limb edges or visible cut seams.
- Neck, shoulders, elbows, wrists, waistband, hips, knees and ankles stay connected throughout the entire cycle.
- Joint volume and clothing folds remain plausible at close range; texture does not visibly stretch into thin strips.
- Left/right hands are anatomically correct and consistent in size and lighting.
- Walk clearly transfers weight and maintains foot contact during support.
- Character remains readable at actual town zoom levels and against day/night environments.
- Idle/walk transitions introduce no snapping, attachment flashes or sudden scale changes.
- Runtime export loads without missing attachments or console errors. Code tests supplement visual review; they cannot approve visual quality.

Capture specific failed poses with animation name and timestamp. Review the corrected cycle against those same poses before acceptance.

## Technical handoff

The repository currently uses Spine 4.2 with `@esotericsoftware/spine-pixi-v8` 4.2.120 and PixiJS 8. Verify the installed versions before final export; do not upgrade the runtime as part of artwork delivery.

Deliver:

1. Layered source artwork with meaningful names and retained hidden surfaces.
2. Editable `.spine` project, source images and any required export settings.
3. Spine JSON, atlas and PNG textures compatible with the installed runtime.
4. `idle` and `walk` animations with duration, loop behaviour and intended walk speed documented.
5. A README explaining skeleton scale/origin, facing direction, draw order, animation tracks and attachment names.
6. Close-up and actual-town recordings, eight-pose walk contact sheet and known limitations.
7. Asset authorship and licence information allowing inclusion and redistribution in this open-source repository.

Use a ground origin consistently. Keep the rig efficient, but choose mesh density and weights based on visible deformation quality. Measure atlas memory, draw calls and frame timing on desktop and mobile in the existing renderer before defining a population budget.

Reserve independent tracks for locomotion, upper-body actions and expressions where technically appropriate. Document the actual track contract rather than assuming every combination is compatible.

## Later milestones

After idle/walk approval: open-palm wave, conversation gestures, sitting, carrying, facial expressions, then additional directions and customisable appearances. Each needs its own visual review. No production replacement until the pilot passes inside the real world renderer.

## Message to a prospective artist / animator

We are building Unwatched, an open-source island simulation inhabited by autonomous AI citizens. We need a 2D character artist and Spine animator to turn our painted Mara concept into a polished, editable production character for Spine 4.2 + PixiJS 8.

Our first paid milestone would be layered production artwork, a clean setup pose, and convincing idle/walk cycles in one three-quarter view. Natural shoulder, hip and knee deformation and planted feet are central to acceptance. Please share comparable painted-character work, explain your art/rig workflow, and quote this limited milestone with source-file delivery, revision terms and open-source redistribution rights. We will review the result inside our actual browser renderer before expanding scope.

This is a prepared outreach draft. It has not been sent and no contractor has been commissioned.
