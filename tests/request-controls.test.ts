import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {converse} from '../src/lib/ai';
import {initialIntent,newSession,changeSelection,type Session} from '../src/lib/domain';
import {samples} from '../src/lib/catalog';
import {seedRequest,type RequestEdit} from '../src/lib/shopping-request';
import {immediateRequestEdit} from '../src/lib/request-controls';

test('atomic budget updates skip AI, retain the TV size, and search only once',async()=>{
 const s=newSession('budget');s.intent={...structuredClone(initialIntent),goal:'television',requirements:['55 inches']};s.shoppingRequest=seedRequest(s.intent);
 let calls=0;const editor=async()=>{throw new Error('No AI needed for this control');};
 const search=async(_q:string,intent:typeof s.intent)=>{calls++;assert.deepEqual(intent.requirements,['55 inches']);return {products:[],notice:'Fixture catalog'};};
 await converse(s,'do 500 dolara',editor,search);assert.equal(s.intent.budget,500);
 await converse(s,'cijena nije bitna',editor,search);assert.equal(s.intent.budget,null);assert.equal(calls,2);
});
test('mixed requests and physical dimensions cannot be mistaken for budget-only controls',()=>{
 const intent={...structuredClone(initialIntent),goal:'television'};
 for(const text of ['do 500 dolara, ali sada tra\u017eim bu\u0161ilicu','do 200 cm','EU 39','under $0','under $100001']){
  assert.equal(immediateRequestEdit(intent,undefined,text),null,text);
 }
});
test('repeating an unchanged ceiling keeps the current selection and avoids AI and catalog calls',async()=>{
 const s=newSession('same-budget');s.intent={...structuredClone(initialIntent),goal:'television',budget:500};s.shoppingRequest=seedRequest(s.intent);s.products=samples('tv');
 changeSelection(s,s.products[0].id);s.confirmed=s.revision;const revision=s.revision;
 await converse(s,'do 500 dolara',async()=>{throw new Error('No AI');},async()=>{throw new Error('No new search');});
 assert.equal(s.selected?.id,s.products[0].id);assert.equal(s.revision,revision);assert.equal(s.confirmed,revision);
});
test('a failed editor response is saved as a failure, not an old selectable shortlist',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'syw-failure-'));const prior=process.env.DATA_DIR;process.env.DATA_DIR=dir;
 try{
  const {transaction}=await import('../src/lib/store');const id=randomUUID();
  await transaction(id,async s=>{s.intent.goal='shoes';s.products=samples('shoes');s.selected=s.products[0];});
  let searches=0;
  await transaction(id,async s=>converse(s,'a different product',async()=>({} as RequestEdit),async()=>{searches++;return {products:[],notice:''};}));
  await transaction(id,async(s:Session)=>{assert.deepEqual(s.products,[]);assert.equal(s.selected,undefined);assert.match(s.messages.at(-1)!.content,/nije izvr\u0161ena/);});
  assert.equal(searches,0);
 }finally{if(prior===undefined)delete process.env.DATA_DIR;else process.env.DATA_DIR=prior;}
});
