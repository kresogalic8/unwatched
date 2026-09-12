import { describe, expect, it } from "vitest";
import { Citizen, type Look } from "./citizen";

const look: Look = { build: "Average", hair: "Short dark", top: "Teal", bottom: "Kelp", hat: "None", carrying: "Nothing", coral: "None" };

describe("citizen pose continuity", () => {
  it("uses quieter conversation gestures when tired and broader ones when joyful", () => {
    const movement = (mood: { tired?: number; joy?: number }) => {
      const c=new Citizen(look,0);
      try { c.mood(mood); c.setPose("talk"); c.update(.2); return Math.abs(c["foreR"].rotation+.9); }
      finally { c.destroy({children:true}); }
    };
    expect(movement({tired:1})).toBeLessThan(movement({}));
    expect(movement({joy:1})).toBeGreaterThan(movement({}));
  });
  it("settles glances consistently across refresh rates", () => {
    const results: number[][]=[];
    for (const hz of [30,60,120]) {
      const c=new Citizen(look,0);
      try {
        c.update(0); c.glance(-.2,100);
        for(let frame=1;frame<=hz;frame++) c.update(frame/hz);
        results.push([c["glanceTilt"],c["eyeGaze"]]);
      } finally { c.destroy({children:true}); }
    }
    for(const result of results) {
      expect(result[0]).toBeCloseTo(results[0]![0]!,6);
      expect(result[1]).toBeCloseTo(results[0]![1]!,6);
    }
  });
  it("keeps the bowl in one hand while the spoon reaches the mouth", () => {
    for (const facing of [-1,1] as const) {
      const c=new Citizen(look,0); c.face(facing); c.setPose("eat");
      try {
        c.update(1/(4*.55));
        const tip=c["spoon"].toGlobal({x:-10,y:-8});
        const mouth=c["head"].toGlobal({x:6,y:4.5});
        expect(Math.hypot(tip.x-mouth.x,tip.y-mouth.y)).toBeLessThan(1);
        expect(c["bowl"].parent).toBe(c["foreL"]);
        expect(c["spoon"].parent).toBe(c["foreR"]);
        c.setPose("walk",true); c.update(2);
        expect(c["spoon"].visible).toBe(false);
      } finally { c.destroy({children:true}); }
    }
  });
  it("supports the page at both edges and writes on its surface", () => {
    const c=new Citizen(look,0);
    try {
      for (const pose of ["read","write"] as const) {
        c.setPose(pose,true); c.update(1);
        if (pose === "read") {
          const edge=c["letter"].toGlobal({x:6,y:5});
          const hand=c["foreR"].toGlobal({x:0,y:c["foreH"]});
          expect(Math.hypot(edge.x-hand.x,edge.y-hand.y)).toBeLessThan(1);
        } else {
          const tip=c["pen"].toGlobal({x:-3,y:3});
          const onPage=c["letter"].toLocal(tip);
          expect(onPage.x).toBeGreaterThan(-6); expect(onPage.x).toBeLessThan(6);
          expect(onPage.y).toBeGreaterThan(-2); expect(onPage.y).toBeLessThan(7);
        }
      }
    } finally { c.destroy({children:true}); }
  });
  it("turns through a front view without restarting on repeated world updates", () => {
    const c = new Citizen(look, 0);
    try {
      c.age(78); c.setPose("walk"); c.update(1);
      c.face(-1, true); c.update(1);
      expect(c["facingMode"]).toBe("right");
      c.face(-1, true); c.update(1.08);
      expect(c["facingMode"]).toBe("front");
      for (let frame = 1; frame <= 20; frame++) {
        c.face(-1, true); c.update(1.08 + frame / 60);
        const left = c["footL"].getGlobalPosition(), right = c["footR"].getGlobalPosition();
        expect(Math.max(left.y, right.y) + 1.5 * .94).toBeCloseTo(0, 5);
      }
      expect(c["facingMode"]).toBe("left");
      expect(c["turn"]).toBeNull();
      expect(c["torso"].skew.x).toBeCloseTo(0);
    } finally { c.destroy({ children: true }); }
  });
  it("allows an immediate preview direction to cancel an unfinished turn", () => {
    const c = new Citizen(look, 0);
    try {
      c.update(1); c.face(-1, true); c.update(1.08);
      c.facing4("back"); c.update(1.08);
      expect(c["turn"]).toBeNull();
      expect(c["facingMode"]).toBe("back");
      expect(c["eyes"].visible).toBe(false);
    } finally { c.destroy({ children: true }); }
  });
  it("advances steps by distance, regardless of elapsed animation time", () => {
    const a = new Citizen(look, 0), b = new Citizen(look, 0);
    try {
      a.setPose("walk"); b.setPose("walk");
      a.travel(5); a.update(1);
      b.travel(2); b.update(10); b.travel(3); b.update(10.1);
      expect(a["legL"].rotation).toBeCloseTo(b["legL"].rotation);
      const before = a["legL"].rotation;
      a.travel(0); a.update(2);
      expect(a["legL"].rotation).toBeCloseTo(before);
    } finally { a.destroy({ children: true }); b.destroy({ children: true }); }
  });
  it("blends seat changes even when the action stays the same", () => {
    const c = new Citizen(look, 0);
    try {
      c.setPose("talk"); c.update(1);
      const before = c["body"].y;
      c.seatAt(-18); c.update(1);
      expect(c["body"].y).toBeCloseTo(before);
      c.update(1.1);
      expect(c["legL"].rotation).toBeLessThan(0);
      expect(c["legL"].rotation).toBeGreaterThan(-1.5);
      for (let i = 2; i <= 6; i++) c.update(1 + i / 10);
      expect(c["body"].y - c["legH"]).toBeCloseTo(-18);
      c.seatAt(null); c.update(1.6);
      expect(c["legL"].rotation).toBeCloseTo(-1.5);
      for (let i = 1; i <= 6; i++) c.update(1.6 + i / 10);
      expect(c["legL"].rotation).toBeCloseTo(0);
    } finally { c.destroy({ children: true }); }
  });

  it("keeps seated hips at the furniture surface during conversation", () => {
    for (const age of [6,30,78]) {
      const c=new Citizen(look,0); c.age(age); c.seatAt(-18); c.setPose("talk");
      try {
        const scale=age<16?.62+age/16*.3:age>=70?.94:1;
        for(let i=0;i<60;i++) {
          c.update(i/60);
          expect(c["body"].y-c["legH"]*scale).toBeCloseTo(-18,5);
          expect(c["legL"].rotation).toBeCloseTo(-1.5);
        }
      } finally {c.destroy({children:true});}
    }
  });
  it("brings an upright cup to the mouth without sitting in mid-air", () => {
    const c=new Citizen(look,0); c.setPose("drink");
    try {
      c.update(1/(4*.7));
      expect(c["legL"].rotation).toBe(0);
      expect(c["cup"].rotation+c["armR"].rotation+c["foreR"].rotation).toBeCloseTo(0);
      const rim=c["cup"].toGlobal({x:0,y:-3});
      const lips=c["head"].toGlobal({x:6,y:4.5});
      expect(Math.hypot(rim.x-lips.x,rim.y-lips.y)).toBeLessThan(3);
    } finally {c.destroy({children:true});}
  });
  it("keeps a level sole on the ground throughout walking for children and adults", () => {
    for (const facing of [-1, 1] as const) for (const age of [6, 30, 78]) for (const build of ["Average", "Tall"] as const) {
      const c = new Citizen({ ...look, build }, 0);
      try {
        c.age(age); c.face(facing); c.setPose("walk");
        const scale = age < 16 ? .62 + age / 16 * .3 : age >= 70 ? .94 : 1;
        for (let frame = 0; frame < 60; frame++) {
          c.update(frame / 60);
          const left = c["footL"].getGlobalPosition(), right = c["footR"].getGlobalPosition();
          expect(Math.max(left.y, right.y) + 1.5 * scale).toBeCloseTo(0, 5);
          expect(c["legL"].rotation + c["shinL"].rotation + c["footL"].rotation + c["body"].rotation * facing).toBeCloseTo(0, 8);
        }
      } finally { c.destroy({ children: true }); }
    }
  });
  it("blends into sleep instead of rotating the whole body in one frame", () => {
    const c = new Citizen(look);
    try {
      c.update(1);
      const previous = c["body"].rotation;
      c.setPose("sleep"); c.update(1);
      expect(c["body"].rotation).toBe(previous);
      c.update(1.06);
      expect(c["body"].rotation).toBeGreaterThan(previous);
      expect(c["body"].rotation).toBeLessThan(Math.PI / 2);
      for (const t of [1.12, 1.18, 1.25]) c.update(t);
      expect(c["body"].rotation).toBeCloseTo(Math.PI / 2);
      // Changing the action again begins at the currently rendered pose.
      c.setPose("walk"); c.update(1.25);
      expect(c["body"].rotation).toBeCloseTo(Math.PI / 2);
      for (const t of [1.31, 1.37, 1.43, 1.50]) c.update(t);
      expect(c["body"].rotation).toBeCloseTo(0);
    } finally { c.destroy({ children: true }); }
  });
  it("can inspect a new static pose while animation time is paused", () => {
    const c = new Citizen(look);
    try {
      c.update(1); c.setPose("sleep", true); c.update(1);
      expect(c["body"].rotation).toBeCloseTo(Math.PI / 2);
    } finally { c.destroy({ children: true }); }
  });
  it("keeps tired eyes between blinks and preserves tall proportions during sleep", () => {
    const c = new Citizen({ ...look, build: "Tall" });
    try {
      c.mood({ tired: 1 });
      const eyeScales = new Set<number>();
      for (let t = 0; t < 2; t += 0.1) { c.update(t); eyeScales.add(c["eyes"].scale.y); }
      expect(eyeScales.has(0.5)).toBe(true);
      expect(eyeScales.has(1)).toBe(false);
      c.setPose("sleep", true); c.update(2.1);
      expect(c["eyes"].scale.y).toBe(0.12);
      expect(c["mouth"].visible).toBe(false);
      expect(c["torso"].scale.y).toBeGreaterThan(1.1);
    } finally { c.destroy({ children: true }); }
  });
});
