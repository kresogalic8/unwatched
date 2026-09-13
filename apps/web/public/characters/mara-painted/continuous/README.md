# Mara continuous artwork

Source generation: `6d960d0a-777e-4009-9727-af0289cb3702`.
Original unmodified sheet: `../../art-direction/mara-continuous-v2.png`.

The near and far arms are distinct painted images with opposite thumb placement.
The far-arm region includes a neighbouring shoe above it in the original extraction;
the rig generator defines `arm-far-clean` by cropping 42 pixels from the left and
84 from the top, to 114 × 540 pixels. Never substitute the near arm for both sides.

The pelvis texture has an alpha overlap mask: smoothstep fade from 66% to 86%
of the body image height. RGB artwork is unchanged. The atlas and body.png both
contain this mask. It blends the body into the upper trouser meshes; it does not
replace the anchored hip weights. The source sheet retains the unmasked artwork.

Leg root rows bind to the hip before gradually transferring influence to the thigh.
The pelvis's outside lower vertices follow the corresponding thigh while its
centre remains anchored. The regression test checks root stability over a full stride.

Screen-side assignment (review correction): the near/right screen arm uses
`arm-far-clean`; the far/left screen arm uses `arm-near`. Source sheet names are
not anatomical side labels. The test locks the reviewed assignment.

All four head expressions fade their lower neck alpha using smoothstep over
84–100% of image height. The body neck extends to y=33 beneath that overlap.
This removes the straight cut edge without exposing a gap when the head tilts.

Joint review: the torso mesh now trims its central closed neck cap, while the
head mesh extends and narrows its lower neck into the collar. The torso draws
over the lower neck and the right-screen shoulder.

The wave palm comes from job `c9fb1628-1439-4bb9-973d-faeb0a3ee44a`.
Its atlas region excludes the painted forearm cap. Proximal mesh rows bind to
`fore-near`, transitioning to `hand-near` over the first 22% of the region.
The wave arm ends before the relaxed hand, avoiding two overlapping wrists.
Use the local study's Inspect joints camera and pose slider to review seams.
