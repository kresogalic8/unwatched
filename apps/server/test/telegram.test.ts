import { afterEach, expect, it, vi } from 'vitest';
import type { TownEvent } from '@unwatched/protocol';
import { TelegramLetters } from '../src/telegram.ts';
afterEach(() => vi.unstubAllGlobals());
const e = { id: 1, kind: 'agent.letter', actors: ['agent'], text: 'Hello', payload: { text: 'A problem needs your attention.' } } as TownEvent;
const who = () => ({ id: 'agent', owner: 'owner', name: 'Godfather' });
it('delivers only the paired owner and agent letters once, as plain text', async () => {
  const f = vi.fn(async () => new Response('{"ok":true}')); vi.stubGlobal('fetch', f);
  const t = new TelegramLetters({token:'secret',chat:'123',owner:'owner',agent:'agent'},()=>{});
  await t.deliver({...e, id:3},()=>({...who(),owner:'another'}));
  await t.deliver({...e, actors:['other']},who);
  await t.deliver({...e,kind:'agent.work'},who);
  await Promise.all([t.deliver(e,who),t.deliver(e,who)]);
  expect(f).toHaveBeenCalledTimes(1);
  const body=JSON.parse((f.mock.calls[0] as unknown as [string,RequestInit])[1].body as string);
  expect(body.chat_id).toBe('123'); expect(body.text).toContain('A problem needs your attention.'); expect(body.parse_mode).toBeUndefined();
  expect(t.status()).toEqual({configured:true,sent:1,failed:0});
});
it('contains failures without leaking credentials or blocking subsequent letters', async () => {
  const f=vi.fn().mockRejectedValueOnce(new Error('secret URL')).mockResolvedValue(new Response('{"ok":true}'));vi.stubGlobal('fetch',f);
  const log=vi.fn();const t=new TelegramLetters({token:'secret',chat:'123',owner:'owner',agent:'agent'},log);
  await t.deliver(e,who);await t.deliver({...e,id:2},who);
  expect(t.status()).toEqual({configured:true,sent:1,failed:1}); expect(JSON.stringify(log.mock.calls)).not.toContain('secret');
});
