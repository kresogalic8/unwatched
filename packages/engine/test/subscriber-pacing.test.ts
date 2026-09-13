import {it,expect} from 'vitest';
import {salience,routineReady} from '../src/salience.ts';
import {Town} from '../src/engine.ts';
import type {Brain} from '../src/types.ts';
const persona={name:'Mira',age:30,origin:'mainland',summary:'worker',want:'work',fear:'hunger',secret:'none',strangers:'polite',advice:'listen',traits:{warmth:.5,pride:.5,caution:.5,honesty:.5,ambition:.5}};
function setup(){const t=new Town({seed:7,brain:{name:'none'} as Brain});const a=t.addAgent({persona,owner:'owner'});a.crossroads=null;a.hint=null;a.budget.planningIncluded=true;a.lastThought=8*60;a.lastConversation=0;a.plan={day:1,mood:'',goals:[],steps:[{hour:8,do:'work',place:null,done:false,missed:false}]};return a;}
it('paces ordinary plan reconsideration but prioritizes afternoon owner letters and urgent stakes',()=>{
 const a=setup();const v={t:8*60+3,hour:8,day:1,nearby:[],jobsOpenHere:0};
 expect(salience(a,v)).toBeNull();expect(salience({...a,crossroads:'Choose a home'},v)?.tier).toBe(2);
 a.lastThought=15*60;a.letters=[{id:1,text:'How are you?',t:15*60,read:false}];
 expect(salience(a,{...v,t:15*60+1,hour:15})?.why).toBe('letter');
});
it('releases remaining daily allowance toward bedtime and does not throttle external brains',()=>{
 const a=setup();a.budget.tier1Left=120;a.lastThought=21*60+58;
 expect(routineReady(a,21*60+59)).toBe(true);
 a.brainKind='own_key';a.lastThought=8*60;expect(routineReady(a,8*60+1)).toBe(true);
});
