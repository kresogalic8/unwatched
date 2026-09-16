import { BACKPACK_CAPACITY, STORAGE_CAPACITY, CRAFT_RECIPES, TOOL_NAMES, type ItemInstance, type InventoryView, type Action } from "@unwatched/protocol";
import type { AgentState, Place } from "./types.ts";

export function note(item: ItemInstance, t: number, who: string, what: string) {
  item.history.push({t, who, what});
  if (item.history.length > 16) item.history.splice(1, item.history.length - 16);
}
export function newItem(a: AgentState, name: string, t: number, what = "Already carried when the item ledger began"): ItemInstance {
  a.nextItemId = (a.nextItemId ?? 0) + 1;
  return {id: `${a.id}:item:${a.nextItemId}`, name, condition: TOOL_NAMES.some(n => n === name) ? 100 : null, history: [{t, who: a.persona.name, what}]};
}
/** String inventories stay compatible with old brains and saves; instances retain identity. */
export function syncItems(a: AgentState, t: number) {
  const remaining = [...(a.itemInstances ?? [])];
  a.itemInstances = a.inventory.map(name => {
    const i = remaining.findIndex(x => x.name === name);
    return i < 0 ? newItem(a, name, t) : remaining.splice(i, 1)[0]!;
  });
  if (!a.itemInstances.some(i => i.id === a.equippedItem)) a.equippedItem = null;
}
export function equipped(a: AgentState) { return a.itemInstances?.find(i => i.id === a.equippedItem && (i.condition ?? 0) > 0); }
export function capacity(a: AgentState) { return BACKPACK_CAPACITY + (equipped(a)?.name === "basket" ? 6 : 0); }
export function recipe(name: string) { return CRAFT_RECIPES.find(r => r.item === name); }
export function bagView(a: AgentState, t: number, compact = false): InventoryView {
  syncItems(a, t);
  return {capacity: capacity(a), equipped: a.equippedItem ?? null, items: a.itemInstances!.map(i => ({...structuredClone(i), history: structuredClone(compact ? i.history.slice(-2) : i.history)})), storage: (a.storage ?? []).map(box => ({place: box.place, items: box.items.map(i => ({...structuredClone(i), history: compact ? [] : structuredClone(i.history)}))})), recipes: CRAFT_RECIPES.map(r => ({...r, from: [...r.from]}))};
}
export function wearTool(a: AgentState, t: number, amount: number) {
  const tool = equipped(a); if (!tool || tool.condition === null) return;
  tool.condition = Math.max(0, tool.condition - amount);
  if (tool.condition === 0) { note(tool, t, a.persona.name, "Worn out; needs repair"); a.equippedItem = null; }
}
export function removeInstance(a: AgentState, id: string) {
  const index = a.itemInstances!.findIndex(i => i.id === id);
  const item = a.itemInstances!.splice(index, 1)[0]!;
  a.inventory.splice(index, 1);
  if (a.equippedItem === id) a.equippedItem = null;
  return item;
}
export function addInstance(a: AgentState, item: ItemInstance) { a.inventory.push(item.name); (a.itemInstances ??= []).push(item); }
export function syncShelf(place: Place) {
  const remaining = {...place.stock};
  place.stockItems = (place.stockItems ?? []).filter(item => {
    if ((remaining[item.name] ?? 0) <= 0) return false;
    remaining[item.name]!--; return true;
  });
}

export function itemVerdict(a: AgentState, action: Action, here: Place, places: Map<string, Place>): string | null {
  const own = a.itemInstances?.find(i => "item" in action && i.id === action.item);
  switch(action.kind) {
    case "craft": {
      const r = recipe(action.recipe); if (!r) return "unknown craft recipe";
      const counts = [...a.inventory];
      for (const n of r.from) { const i = counts.indexOf(n); if (i < 0) return `crafting ${r.item} requires ${r.from.join(", ")}`; counts.splice(i, 1); }
      return null;
    }
    case "equip": return action.item === null || own && own.condition !== null && own.condition > 0 ? null : "equip a usable tool from your backpack, using its item id";
    case "repair_tool": return own && own.condition !== null && own.condition < 100 && a.inventory.includes("planks") ? null : "repair a worn carried tool with one plank";
    case "drop": return own && (here.looseItems?.length ?? 0) < 48 ? null : "choose a carried item; this place can hold 48 loose items";
    case "pickup": return here.looseItems?.some(i => i.id === action.item) && a.inventory.length < capacity(a) ? null : "no such loose item here or your backpack is full";
    case "stow": {
      if (!own) return "choose a carried item id";
      if (here.owner !== a.id && a.home?.place !== here.id) return "store belongings at your home or a place you own";
      return (a.storage?.find(s => s.place === here.id)?.items.length ?? 0) < STORAGE_CAPACITY ? null : "your storage here is full";
    }
    case "retrieve": return a.storage?.find(s => s.place === here.id)?.items.some(i => i.id === action.item) && places.has(here.id) && a.inventory.length < capacity(a) ? null : "visit your stored item and make room in the backpack";
    default: return null;
  }
}

/** Reconcile legacy actions, keeping the same item when it moves between people or a counter. */
export function reconcileItems(people: AgentState[], before: Map<string, ItemInstance[]>, actor: AgentState, action: Action, here: Place, t: number) {
  const removed: ItemInstance[] = [];
  const missing: {a: AgentState; index: number; name: string}[] = [];
  for (const a of people) {
    const old = [...(before.get(a.id) ?? [])];
    const current = [...(a.itemInstances ?? [])];
    a.itemInstances = a.inventory.map((name, index) => {
      // Explicit instance actions have already placed the intended instance at this index.
      const explicit = current[index];
      const match = old.findIndex(i => i.name === name && (!explicit || i.id === explicit.id));
      const fallback = match >= 0 ? match : old.findIndex(i => i.name === name);
      if (fallback >= 0) return old.splice(fallback, 1)[0]!;
      if (explicit?.name === name && !before.get(a.id)?.some(i => i.id === explicit.id)) return explicit;
      missing.push({a, index, name}); return null as unknown as ItemInstance;
    });
    removed.push(...old);
  }
  for (const m of missing) {
    let source = removed.findIndex(i => i.name === m.name);
    let item = source >= 0 ? removed.splice(source, 1)[0] : undefined;
    if (!item && m.a === actor && (action.kind === "take" && !action.from || action.kind === "trade" && action.buy && (!action.with || action.with === here.id))) {
      source = here.stockItems?.findIndex(i => i.name === m.name) ?? -1;
      if (source >= 0) item = here.stockItems!.splice(source, 1)[0];
    }
    if (item) note(item, t, m.a.persona.name, action.kind === "give" ? `Received as a gift from ${actor.persona.name}` : `Acquired at ${here.name}`);
    m.a.itemInstances![m.index] = item ?? newItem(m.a, m.name, t, `Acquired at ${here.name}`);
  }
  if (action.kind === "trade" && action.sell && (!action.with || action.with === here.id)) {
    const item = removed.find(i => i.name === action.sell);
    if (item) { note(item, t, actor.persona.name, `Sold at ${here.name}`); (here.stockItems ??= []).push(item); }
  }
  for (const a of people) if (!a.itemInstances?.some(i => i.id === a.equippedItem)) a.equippedItem = null;
}
