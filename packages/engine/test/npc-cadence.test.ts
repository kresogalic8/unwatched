import { expect,it } from 'vitest';
import { salience } from '../src/salience.ts';
import type { AgentState } from '../src/types.ts';
it('spaces routine NPC plans without throttling subscribers or urgent decisions',()=>{
 const a={budget:{planningIncluded:false},owner:null,brainKind:'hosted',asleep:false,thinkEvery:null,lastThought:0,lastHungerThought:0,needs:{hunger:0},letters:[],plan:{day:1,steps:[{hour:8,do:'work',place:null}]},location:'market'} as unknown as AgentState;
 const v={hour:8,t:5,day:1,nearby:[],jobsOpenHere:0,npcThoughtInterval:15};
 expect(salience(a,v)).toBeNull();expect(salience({...a,owner:'subscriber'},v)?.why).toBe('plan: work');
 expect(salience({...a,crossroads:'An urgent decision'},v)?.tier).toBe(2);
 expect(salience(a,{...v,t:15})?.why).toBe('plan: work');
});
