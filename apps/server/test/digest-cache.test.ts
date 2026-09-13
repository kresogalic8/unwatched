import { describe,it,expect,vi } from 'vitest';
import { DigestCache } from '../src/digest-cache.ts';
describe('digest generation cost control',()=>{
 it('shares one generation between concurrent reads and caches the result',async()=>{
  const cache=new DigestCache<string>();let finish!:(s:string)=>void;
  const generate=vi.fn(()=>new Promise<string>(r=>{finish=r;}));
  const a=cache.get('citizen:hour',generate),b=cache.get('citizen:hour',generate);
  finish('A quiet morning');expect(await a).toBe('A quiet morning');expect(await b).toBe('A quiet morning');
  expect(await cache.get('citizen:hour',generate)).toBe('A quiet morning');expect(generate).toHaveBeenCalledTimes(1);
 });
 it('backs off failures without caching a fabricated digest',async()=>{
  let now=1000;const cache=new DigestCache<string>(()=>now);const fail=vi.fn(async()=>{throw new Error('provider unavailable');});
  expect(await cache.get('a',fail)).toBeNull();expect(await cache.get('a',fail)).toBeNull();expect(fail).toHaveBeenCalledTimes(1);
  now+=61000;expect(await cache.get('a',async()=>'Recovered')).toBe('Recovered');
 });
 it('changing ranges cannot trigger unlimited calls for one citizen',async()=>{
  const cache=new DigestCache<string>();const generate=vi.fn(async()=>'Summary');
  await cache.get('a:range1',generate,'a');expect(await cache.get('a:range2',generate,'a')).toBeNull();
  expect(await cache.get('b:range1',generate,'b')).toBe('Summary');expect(generate).toHaveBeenCalledTimes(2);
 });
});
