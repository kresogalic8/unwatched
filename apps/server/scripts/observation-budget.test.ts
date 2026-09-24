import {describe,it,expect} from 'vitest';
import {ObservationBudget} from './observation-budget.ts';
describe('local observation spending guard',()=>{
  it('reserves before sending, settles actual cost, and caps every HTTP attempt',()=>{
    const b=new ObservationBudget(.000001,.000005,0,.1,2);
    b.reserve('{}',100);expect(b.attempts).toBe(1);
    expect(()=>b.reserve('{}',100)).toThrow('settled');
    b.settle(.01);b.reserve('{}',100);b.settle(.01);
    expect(()=>b.reserve('{}',100)).toThrow('budget');expect(b.attempts).toBe(2);
  });
  it('rejects a request whose estimated upper cost will not fit',()=>{
    const b=new ObservationBudget(.001,.001,0);
    expect(()=>b.reserve('{}',100)).toThrow('budget');expect(b.attempts).toBe(0);
  });
  it('stops on unknown cost and uncertain requests',()=>{
    for(const cost of [null,undefined,NaN,-1]) {
      const b=new ObservationBudget(.000001,.000005,0);b.reserve('{}',100);b.settle(cost);
      expect(()=>b.reserve('{}',100)).toThrow('unknown');
    }
    const b=new ObservationBudget(.000001,.000005,0);b.reserve('{}',100);b.fail();
    expect(()=>b.reserve('{}',100)).toThrow('no retry');
  });
});
