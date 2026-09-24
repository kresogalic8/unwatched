# Mara gold master

The source in `source/mara-master-v1.png` is a visual reference candidate for the first production Spine character. It is one complete figure, not a sprite sheet. The chroma source is retained only so the alpha extraction can be reproduced.

**Status: the generated rig has been rejected in visual review.** Its JSON, atlas and animation curves are failed experimental output, not a production starting point. Passing runtime tests does not validate anatomy, seams or movement. See `docs/character-production-brief.md` at the repository root for the replacement art and animation assignment.

Before this artwork may replace a live citizen it must be redrawn into layered source artwork with hidden joint overlap. Do not crop visible body parts out of this file and use those crops as the final rig.

## Required layer structure

- back hair; head/face; front hair; eyes; brows; three mouth shapes
- neck owned by the torso, with the jaw and scarf overlapping it
- torso and pelvis as separate continuous meshes with an overlap below the waistband
- left and right clavicle, upper arm and forearm meshes with 20% hidden overlap
- relaxed, open, grip, point and wave hand attachments for both anatomical sides
- left and right thigh, shin, heel and toe, with 20% hidden overlap at hip, knee and ankle
- scarf tips and hair tips on physics bones

## Acceptance gates

1. Setup pose: no visible seam at neck, shoulder, wrist, hip, knee or ankle at 200% zoom.
2. Walk: feet remain planted during contact, pelvis shifts over the supporting leg, shoulders counter-rotate.
3. Hands: left and right thumbs stay anatomically correct in every attachment.
4. Silhouette: idle, walk, sit, carry and wave read clearly at town scale.
5. Layering: locomotion, upper-body action and expression can play together without replacing one another.
6. Performance: one atlas, pruned weights, and no more than two meaningful bone influences for most mesh vertices.

Generated with the built-in image generation workflow from the established Mara art direction. Final production segmentation and weighting must be authored in Spine Editor 4.2 and exported for the matching `spine-pixi-v8` runtime.
