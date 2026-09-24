import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AnimationState,
  AnimationStateData,
  AtlasAttachmentLoader,
  Physics,
  Skeleton,
  SkeletonJson,
  TextureAtlas,
} from "@esotericsoftware/spine-pixi-v8";

const folder = resolve(process.cwd(), "public/characters/mara-gold");
const json = JSON.parse(readFileSync(`${folder}/mara.json`, "utf8"));
const atlas = new TextureAtlas(readFileSync(`${folder}/mara.atlas`, "utf8"));
const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(json);

describe("Mara gold rig", () => {
  it("contains only fresh gold-master regions and the first four motions", () => {
    expect(data.skins.map((skin) => skin.name)).toEqual(["mara-gold"]);
    expect(data.animations.map((animation) => animation.name)).toEqual(["idle", "walk", "wave", "think"]);
    const skeleton = new Skeleton(data);
    skeleton.setSkinByName("mara-gold");
    skeleton.setSlotsToSetupPose();
    for (const slot of skeleton.slots) expect(slot.getAttachment(), slot.data.name).not.toBeNull();
  });

  it("keeps every exported bone finite through every motion", () => {
    for (const animation of data.animations) {
      const skeleton = new Skeleton(data);
      skeleton.setSkinByName("mara-gold");
      skeleton.setSlotsToSetupPose();
      const state = new AnimationState(new AnimationStateData(data));
      state.setAnimation(0, animation.name, true);
      for (let frame = 0; frame < 120; frame++) {
        state.update(1 / 60);
        state.apply(skeleton);
        skeleton.updateWorldTransform(Physics.none);
        for (const bone of skeleton.bones) {
          expect(Number.isFinite(bone.worldX)).toBe(true);
          expect(Number.isFinite(bone.worldY)).toBe(true);
          expect(Number.isFinite(bone.getWorldRotationX())).toBe(true);
        }
      }
    }
  });
});
