import {it,expect} from 'vitest';
import {ShuffleBag} from './music';
it('plays each track once per round without consecutive repeats',()=>{
 const bag=new ShuffleBag(['a','b','c'],()=>0.2);let prev='';
 for(let round=0;round<20;round++){
  const group=[];
  for(let i=0;i<3;i++){const t=bag.next()!;expect(t).not.toBe(prev);group.push(t);prev=t;}
  expect(new Set(group).size).toBe(3);
 }
});
it('handles a single track and an empty list',()=>{
 const one=new ShuffleBag(['a']);expect(one.next()).toBe('a');expect(one.next()).toBe('a');
 expect(new ShuffleBag([]).next()).toBeUndefined();
});
