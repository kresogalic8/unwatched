import { sha256 } from './hash.ts';
import type { SkillRecipe } from '@unwatched/protocol';
export interface LearnedSkill {
  id: string; recipe: SkillRecipe; origin: { island: string; author: string; name: string };
  learnedFrom?: string; proposed: number; attempts: number; successes: number;
  evidence: { island: string; event: number; t: number; success: boolean }[];
  trial?: { day: number; success: boolean; accepted: number; total: number };
}
export interface SkillMeasure { hunger: number; coins: number; items: number; damage: number; stock: number }
export interface SkillPractice { id: string; step: number; before: SkillMeasure; accepted: number; started: number }
export function skillId(recipe: SkillRecipe) { return sha256(JSON.stringify({name:recipe.name,goal:recipe.goal,steps:recipe.steps.map(s=>Object.fromEntries(Object.entries(s).sort(([a],[b])=>a.localeCompare(b))))})).slice(0,20); }
export function achieved(goal: SkillRecipe['goal'], before: SkillMeasure, after: SkillMeasure) {
  switch(goal) {
    case 'eat': return after.hunger < before.hunger - .15;
    case 'earn': return after.coins > before.coins;
    case 'repair': return after.damage < before.damage;
    case 'produce': return after.stock > before.stock && after.coins >= before.coins;
  }
}
/** Imported successes are provenance claims, never firsthand verification on this island. */
export function importedSkill(s: LearnedSkill, from: string): LearnedSkill {
  return {id:skillId(s.recipe),recipe:structuredClone(s.recipe),origin:{...s.origin},learnedFrom:from,proposed:s.proposed,attempts:0,successes:0,evidence:[]};
}
