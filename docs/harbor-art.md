# Harbor Street artwork

The approved `/harbor-study` establishes the world’s material language: limewashed limestone, individually drawn clay tiles, olive shutters, pale stone paving, weathered timber and muted foliage. `harbor-art.tsx` is shared by the study, building replay and offline atlas generator; `harbor-props.tsx` provides working places and street furniture.

Rebuild the committed atlas after editing either source:

```sh
node --import tsx apps/web/scripts/gen-harbor.tsx
```

The generator writes transparent 3× PNGs into `apps/web/public/harbor` and an anchor/size manifest into `harbor-atlas.ts`. Rasterization preserves nested SVG transforms and avoids repeating complex vector tessellation at runtime. Pixi loads the textures once, with natural map-unit dimensions independent of pixel resolution. Keep every sprite anchored at its front ground corner; selection bounds include the new dimensions.

Citizen animation remains an articulated rig in `citizen.ts`; portraits and interiors use that same rig. `person-art.ts` shares the approved torso and hair paths, head dimensions and base colors with the original SVG person. The production rig uses taller human proportions, retaining the Harbor profile and articulated arms and legs for simulation actions. `/harbor-characters` is the approved character standard: all appearance components, fourteen poses, four directions, ages and weather can be inspected alongside the portrait. The live rig is authoritative; the original SVG person is retained only as an archival drawing. `RigPerson.tsx` renders production-rig snapshots inside the Harbor study SVG, preserving scene depth without maintaining a second character drawing. Do not substitute staged people for simulation state. Inventory stays a live overlay; occupied buildings switch to their lit texture, while sails, bells and laundry remain separate moving parts.

Public construction records and citizen-authored stored illustrations are not rewritten by the visual upgrade. Construction drawings reconstruct the recorded labor stage.

Interiors apply the same age and trade styling as the town. Portrait framing compensates for age and height, while portrait cache keys include exact age so children retain the correct proportions.

`/harbor-reference` compares the original SVG with a production Citizen at a deterministic walking phase. Shoes articulate separately from shins; walking ground contact is checked across a full cycle for children, adults, elders and tall builds. Hair, hat bands, profile eyewear and beards must leave the eye area visible.

`CITIZEN_BODY` now defines the more natural production proportions separately from the original Harbor drawing: 22-unit legs and torso, head centered at -55 with a 0.9 scale. The reference page deliberately shows that silhouette change at equal map scale. Portraits and interiors compensate for the taller body.

World locomotion uses distance-driven steps, acceleration and braking. Furniture anchors come from `seating.ts`; `/harbor-contact` is an explicitly staged inspection of the production seating and drinking poses. Run `pnpm --filter @unwatched/web test` for contact, locomotion and camera regression checks.
