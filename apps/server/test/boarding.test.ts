import {describe,it,expect,vi} from 'vitest';
import {EventEmitter} from 'node:events';
import type {WebSocket} from 'ws';
import {BoardingConnections,verifyBoardingKey} from '../src/boarding.ts';
import {Persona,Perception} from '@unwatched/protocol';
const persona=Persona.parse({name:'QA Citizen',age:30,origin:'Mainland',summary:'Careful and kind.',want:'Build a home',fear:'Storms',secret:'Keeps a diary',strangers:'Polite',advice:'Listens',traits:{warmth:.5,pride:.5,caution:.5,honesty:.5,ambition:.5}});
class Socket extends EventEmitter {readyState=1;valid=true;send(raw:string){const p=JSON.parse(raw);expect(Perception.safeParse(p).success).toBe(true);queueMicrotask(()=>this.emit('message',JSON.stringify({type:'act',request_id:p.request_id,action:this.valid?{kind:'wait'}:{kind:'invalid'},remember:[]})));} close(){this.readyState=3;this.emit('close');}}
describe('boarding verification',()=>{
 it('requires a valid inference response from each selected model',async()=>{
  const request=vi.fn().mockImplementation(async()=>new Response(JSON.stringify({choices:[{message:{content:'OK'}}]}),{status:200}));
  await verifyBoardingKey('test-key',{routine:'a',stakes:'a',reflect:'b'},request as typeof fetch);
  expect(request).toHaveBeenCalledTimes(2);
 });
 it('rejects auth, provider and empty successful responses',async()=>{
  for(const [status,data] of [[403,{error:'denied'}],[200,{error:'provider failure'}],[200,{choices:[]}] ] as const){
   await expect(verifyBoardingKey('test-key',{routine:'a'},vi.fn().mockResolvedValue(new Response(JSON.stringify(data),{status})) as typeof fetch)).rejects.toThrow('has not boarded');
  }
 });
 it('requires a connected valid action and scopes tickets to their owner',async()=>{
  let now=1000;const connections=new BoardingConnections(()=>now);const ticket=connections.create('owner',persona);
  expect(connections.ready(ticket.id,'owner')).toBeNull();expect(connections.get(ticket.id,'other')).toBeNull();
  const ws=new Socket();connections.byToken(ticket.token!)!.attach(ws as unknown as WebSocket);
  ws.valid=false;await expect(connections.verify(ticket.id,'owner')).rejects.toThrow('No valid action');
  expect(connections.ready(ticket.id,'owner')).toBeNull();
  ws.valid=true;await connections.verify(ticket.id,'owner');expect(connections.ready(ticket.id,'owner')).toBeTruthy();
  now+=5*60000;expect(connections.ready(ticket.id,'owner')).toBeNull();
 });
 it('revokes replaced and expired test tokens',()=>{
  let now=1000;const c=new BoardingConnections(()=>now);const first=c.create('owner',persona);const next=c.create('owner',persona);
  expect(c.byToken(first.token!)).toBeNull();now+=21*60000;expect(c.byToken(next.token!)).toBeNull();
 });
});
