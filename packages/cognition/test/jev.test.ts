import { expect,it,vi } from 'vitest';
import { JevDecider } from '../src/jev.ts';
const choices=[{key:'wait',description:'Wait'}];
const reply=(choice='wait')=>new Response(JSON.stringify({model:'jev-1.13.0',answers:{reaction:{type:'choice',choice,confidence:.9}},usage:{input_tokens:100}}));
it('counts usage and refuses calls beyond the session cap',async()=>{const fetcher=vi.fn(async()=>reply());const j=new JevDecider('secret',fetcher,1);await j.choose({},choices);expect(j.inputTokens).toBe(100);await expect(j.choose({},choices)).rejects.toThrow('budget');expect(fetcher).toHaveBeenCalledTimes(1);});
it('rejects invented actions and does not retry failed calls',async()=>{const f=vi.fn(async()=>reply('invent'));await expect(new JevDecider('x',f).choose({},choices)).rejects.toThrow('unavailable');expect(f).toHaveBeenCalledTimes(1);const fail=vi.fn(async()=>new Response('',{status:429}));await expect(new JevDecider('x',fail).choose({},choices)).rejects.toThrow('429');expect(fail).toHaveBeenCalledTimes(1);});
it('rejects oversized context before making a request',async()=>{const f=vi.fn();await expect(new JevDecider('x',f).choose('x'.repeat(17000),choices)).rejects.toThrow('Context');expect(f).not.toHaveBeenCalled();});
