import { expect, it } from "vitest";
import { Town } from "@unwatched/engine";
import { MockBrain } from "@unwatched/cognition";
import { publicAgent, ownerAgent } from "../src/views.ts";
it("shows public receipts without exposing rejected attempts or private lessons",()=>{
 const town=new Town({seed:7,brain:new MockBrain(7)});
 const a=town.addAgent({persona:{name:"Mira",age:30,origin:"mainland",summary:"curious",want:"eat",fear:"hunger",secret:"PRIVATE",strangers:"polite",advice:"listens",traits:{warmth:.5,pride:.5,caution:.5,honesty:.5,ambition:.5}}});
 a.foodLessons=[{place:"bakery",item:"bread",evidence:[{t:600,success:true,cost:2,eventId:10},{t:660,success:false,cost:0}]},{place:"PRIVATE_PLACE",item:"PRIVATE_ITEM",evidence:[{t:700,success:false,cost:0}]}];
 a.foodAdvice=[{from:"ag_teacher",place:"bakery",item:"bread",confidence:.7,sourceT:600,sharedT:610,eventId:20,tested:{t:700,success:false,matched:false}}];
 a.foodRoutineDecisions=[{t:750,from:"harbor",next:"bakery",baseline:"market",preferred:"bakery"}];
 const view=publicAgent(town,a);
 expect(view.observedPurchases).toHaveLength(1);
 expect(view.observedPurchases[0]!.receipts).toEqual([{t:600,eventId:10,cost:2}]);
 expect(JSON.stringify(view)).not.toContain("PRIVATE");
 expect(view).not.toHaveProperty("foodAdvice");
 expect(view.sharedKnowledge[0]).not.toHaveProperty("tested");
 expect(ownerAgent(town,a).foodAdvice[0]?.tested?.matched).toBe(false);
 expect(view).not.toHaveProperty("foodLessons");
 expect(view).not.toHaveProperty("foodRoutineDecisions");
 expect(ownerAgent(town,a).foodLessons).toHaveLength(2);
});
it("keeps desires and their evidence private to the citizen owner",()=>{
 const town=new Town({seed:7,brain:new MockBrain(7)});
 const a=town.addAgent({persona:{name:"Mira",age:30,origin:"mainland",summary:"curious",want:"learn",fear:"hunger",secret:"none",strangers:"polite",advice:"listens",traits:{warmth:.5,pride:.5,caution:.5,honesty:.5,ambition:.5}}});
 a.desires=[{id:"want-1",title:"PRIVATE_DESIRE",why:"PRIVATE_REASON",state:"active",since:10,updated:10,history:[{t:10,title:"PRIVATE_DESIRE",why:"PRIVATE_REASON",state:"active",evidence:[{id:1,t:5,kind:"agent.say",text:"PRIVATE_EXPERIENCE"}]}],attempts:[]}];
 expect(JSON.stringify(publicAgent(town,a))).not.toContain("PRIVATE");
 expect(ownerAgent(town,a).desires).toEqual(a.desires);
});
