import { randomUUID } from "node:crypto";
import { Town } from "@unwatched/engine";
import { MockBrain } from "@unwatched/cognition";
import type { Persona } from "@unwatched/protocol";
import type { BrainRow } from "@unwatched/store";
import { OwnBrain, newToken } from "./brains.ts";

export async function verifyBoardingKey(key: string, models: Record<string,string>, fetcher: typeof fetch = fetch) {
  // Verify that inference works, not merely that a credential exists. No world data is sent.
  for (const model of new Set(Object.values(models))) {
    let response: Response;
    try { response = await fetcher("https://openrouter.ai/api/v1/chat/completions", {
      method:"POST", headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},
      body:JSON.stringify({model,messages:[{role:"user",content:"Reply OK."}],max_tokens:1,stream:false}),
      signal:AbortSignal.timeout(20000),
    }); } catch { throw new Error("The model connection timed out. Your character is still a draft. Try again."); }
    const data = await response.json().catch(()=>null) as {choices?:unknown[];error?:unknown}|null;
    if(!response.ok || data?.error || !data?.choices?.length) throw new Error(`The key could not run ${model}. Check your model access and provider balance. Your character has not boarded.`);
  }
}

export class BoardingConnections {
  private tickets = new Map<string,{owner:string;expires:number;verified:number;verifying?:boolean;brain:OwnBrain;preview:Town;persona:Persona}>();
  constructor(private now=Date.now) {}
  private prune() { for(const [id,t] of this.tickets) if(t.expires<this.now()){t.brain.socket?.close(4001,"Boarding test expired");this.tickets.delete(id);} }
  create(owner:string,persona:Persona) {
    this.prune();
    for(const [id,t] of this.tickets) if(t.owner===owner){t.brain.socket?.close(4000,"New boarding test");this.tickets.delete(id);}
    if(this.tickets.size>=200)throw new Error("The boarding desk is busy. Try again shortly.");
    const id=randomUUID();const agentId=`ag_${id.replaceAll("-","")}`;
    const row:BrainRow={agent_id:agentId,kind:"own_brain",provider:"openrouter",api_key:null,models:null,think_every:5,daily_cap_usd:0,token:newToken(),memory:"lease"};
    const brain=new OwnBrain(row,()=>{});const preview=new Town({seed:1,brain:new MockBrain(1)});
    preview.addAgent({persona,owner,funded:true},agentId);
    this.tickets.set(id,{owner,expires:this.now()+20*60000,verified:0,brain,preview,persona});
    return {id,token:row.token,agentId,expiresAt:this.now()+20*60000};
  }
  get(id:string,owner:string) {this.prune();const t=this.tickets.get(id);return t?.owner===owner?t:null;}
  byToken(token:string) {this.prune();return [...this.tickets.values()].find(t=>t.brain.row.token===token)?.brain??null;}
  async verify(id:string,owner:string) {
    const t=this.get(id,owner);if(!t)throw new Error("Connection test expired. Start a new test.");
    if(t.verifying)throw new Error("A connection test is already running.");
    t.verifying=true;t.verified=0;
    try {
    const a=t.preview.agents.get(t.brain.row.agent_id)!;
    const ok=await t.brain.verify(t.preview.perceive(a));
    if(!ok)throw new Error("No valid action received. Connect your process and answer the test perception within eight seconds.");
    t.verified=this.now();return true;
    } finally {t.verifying=false;}
  }
  ready(id:string,owner:string) {const t=this.get(id,owner);return t && t.brain.connected && t.verified>0 && this.now()-t.verified<5*60000?t:null;}
  consume(id:string) {this.tickets.delete(id);}
}
