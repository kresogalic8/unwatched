import { z } from "zod";

export const ItemInstance = z.object({
  id: z.string(), name: z.string(),
  condition: z.number().min(0).max(100).nullable(),
  madeBy: z.string().optional(),
  history: z.array(z.object({t: z.number(), who: z.string(), what: z.string()})).max(16),
});
export type ItemInstance = z.infer<typeof ItemInstance>;
export const TOOL_NAMES = ["fishing rod", "hammer", "axe", "basket"] as const;
export const CRAFT_RECIPES = [
  {item: "planks", from: ["timber"], why: "Cut timber into a usable plank."},
  {item: "fishing rod", from: ["timber", "rope"], why: "A reusable rod improves the chance of a catch."},
  {item: "hammer", from: ["timber", "stone"], why: "A hammer saves one plank when repairing a building."},
  {item: "axe", from: ["planks", "stone", "rope"], why: "An axe gathers an extra timber when stock and carrying space allow."},
  {item: "basket", from: ["timber", "rope", "rope"], why: "An equipped basket adds six carrying slots."},
] as const;
export const BACKPACK_CAPACITY = 12;
export const STORAGE_CAPACITY = 48;
export const InventoryView = z.object({
  capacity: z.number(), items: z.array(ItemInstance), equipped: z.string().nullable(),
  storage: z.array(z.object({place: z.string(), items: z.array(ItemInstance)})),
  recipes: z.array(z.object({item: z.string(), from: z.array(z.string()), why: z.string()})),
});
export type InventoryView = z.infer<typeof InventoryView>;
