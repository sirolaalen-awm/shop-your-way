import test from 'node:test';
import assert from 'node:assert/strict';
import {initialIntent} from '../src/lib/domain';
import {extractRequestEdit,applyRequestEdit,seedRequest,fieldNames} from '../src/lib/shopping-request';
test('brand follow-up receives current product and constraints in both model stages and preserves them',async()=>{
 const intent={...structuredClone(initialIntent),goal:'vest',requirements:['down','Medium (M)'],budget:120};
 const current=seedRequest(intent);const calls:any[]=[];const oldFetch=globalThis.fetch,oldProvider=process.env.AI_PROVIDER;
 process.env.AI_PROVIDER='ollama';
 globalThis.fetch=async(_input,init)=>{
  const body=JSON.parse(String(init?.body));calls.push(body);
  const input=JSON.parse(body.messages.at(-2).content.replace(/^[^{]+/,''));
  assert.equal(input.currentRequest.product,'vest');
  assert.equal(input.currentRequest.budget,120);
  assert.deepEqual(input.currentRequest.fields.map((f:any)=>f.value),['down','Medium (M)']);
  const result=calls.length===1?{product:null,unclear:false,touched:['brand']}:{action:'REFINE',product:null,fields:{...Object.fromEntries(fieldNames.map(k=>[k,null])),brand:"Victoria's Secret"},clear:[],budgetAction:'KEEP',budget:null,retainBudget:false,journey:null,question:null};
  return new Response(JSON.stringify({message:{content:JSON.stringify(result)},done_reason:'stop'}));
 };
 try{
  const text='victoria sicrets modeli';const edit=await extractRequestEdit(intent,current,text);
  const next=applyRequestEdit(intent,current,edit,text);
  assert.equal(calls.length,2);assert.equal(next.request.id,current.id);assert.equal(next.request.product,'vest');
  assert.equal(next.intent.budget,120);assert.deepEqual(next.request.slots.map(s=>s.value),['down','Medium (M)',"Victoria's Secret"]);
 }finally{globalThis.fetch=oldFetch;if(oldProvider===undefined)delete process.env.AI_PROVIDER;else process.env.AI_PROVIDER=oldProvider;}
});
