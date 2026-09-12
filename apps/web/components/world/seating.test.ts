import { expect, it } from "vitest";
import { seatsFor } from "./seating";
it("places terrace occupants on opposite chairs facing the table", () => {
  const [left,right] = seatsFor({sprite:"terrace",x:100,y:200},3);
  expect(left!.x).toBeCloseTo(72.8); expect(right!.x).toBeCloseTo(127.2);
  expect(left!.facing).toBe(1); expect(right!.facing).toBe(-1);
  expect(left!.y+left!.height).toBeCloseTo(200-9*.85);
  expect(left!.key).not.toBe(right!.key);
});
it("only furniture with seats can support a sitting citizen", () => {
  expect(seatsFor({sprite:"tree-small",x:0,y:0},0)).toEqual([]);
  const seats=seatsFor({sprite:"bench",x:0,y:0},1);
  expect(seats).toHaveLength(2); expect(seats[0]!.y+seats[0]!.height).toBeCloseTo(-10.4);
});
