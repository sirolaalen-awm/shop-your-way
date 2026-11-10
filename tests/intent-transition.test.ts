import test from 'node:test';
import assert from 'node:assert/strict';
import {initialIntent,newSession} from '../src/lib/domain';
import {converse} from '../src/lib/ai';
import {applyRequestEdit,seedRequest,fieldNames,type RequestEdit} from '../src/lib/shopping-request';
import {samples} from '../src/lib/catalog';
const edit=(fields:Partial<RequestEdit>):RequestEdit=>({action:'REFINE',product:null,changes:[],budget:null,retainBudgetSource:null,journey:null,question:null,...fields});

const response=(change:RequestEdit,init?:RequestInit)=>{
 const body=init?.body?JSON.parse(String(init.body)):{};
 if(body.format?.properties?.touched)return new Response(JSON.stringify({message:{content:JSON.stringify({product:change.product?.name||null,unclear:change.action==='CLARIFY',touched:[...change.changes.map(c=>c.key),...(change.product?['product']:[]),...(change.budget?['budget']:[])]})}}));
 const fields:Record<string,string|null>=Object.fromEntries(fieldNames.map(key=>[key,null]));
 for(const c of change.changes)if(c.value!==null)fields[c.key]=c.value;
 return new Response(JSON.stringify({message:{content:JSON.stringify({action:change.action,product:change.product?.name||null,fields,clear:change.changes.filter(c=>c.value===null).map(c=>c.key),budgetAction:change.budget?(change.budget.amount===null?'CLEAR':'SET'):'KEEP',budget:change.budget?.amount||null,retainBudget:false,journey:change.journey,question:change.question})}}));
};
const doors=()=>({...structuredClone(initialIntent),goal:'house door',budget:500,requirements:['PVC','height 200 cm','width 100 cm']});
test('NEW_PRODUCT clears all door fields and product-scoped budget before TV search',async t=>{
 const s=newSession('door-tv');s.intent=doors();s.products=samples('shoes');s.selected=s.products[0];
 t.mock.method(globalThis,'fetch',async(_url:RequestInfo|URL,init?:RequestInit)=>response(edit({action:'NEW_PRODUCT',product:{name:'television',source:'tra\u017eim tv'}}),init));
 let calls=0;await converse(s,'tražim tv',undefined,async(query,intent,_text,request)=>{calls++;assert.equal(query,'television');assert.equal(intent.budget,null);assert.deepEqual(intent.requirements,[]);assert.deepEqual(intent.preferences,[]);assert.deepEqual(request?.slots,[]);assert.equal(s.selected,undefined);return {products:[],notice:'No offers'};});
 assert.equal(calls,1);
});
test('REFINE keeps compatible heel/comfort and replaces style, without old original size',async t=>{
 const s=newSession('style');s.originalIntent='work shoes EU 43';s.intent={...structuredClone(initialIntent),goal:"women's everyday shoes",budget:100,requirements:['comfortable','low heel']};
 s.shoppingRequest={id:'current',product:s.intent.goal,source:'',slots:[{key:'comfort',label:'Comfort',value:'comfortable',source:''},{key:'heel',label:'Heel',value:'low heel',source:''}]};
 t.mock.method(globalThis,'fetch',async(_url:RequestInfo|URL,init?:RequestInit)=>response(edit({changes:[{key:'style',label:'Style',value:'feminine style',source:'malo \u017eenstvenije'}]}),init));
 await converse(s,'malo ženstvenije',undefined,async(query,intent)=>{assert.match(query,/feminine style/);assert.match(query,/low heel/);assert.doesNotMatch(query,/EU 43|work/);assert.equal(intent.budget,100);return {products:[],notice:'No offers'};});
});
test('budget and heel edits replace a single field; unlimited explicitly clears ceiling',()=>{
 const current=doors();const request=seedRequest(current);
 const capped=applyRequestEdit(current,request,edit({budget:{amount:300,source:'do 300 dolara'}}),'do 300 dolara');
 assert.equal(capped.intent.budget,300);assert.deepEqual(capped.intent.requirements,current.requirements);
 const unlimited=applyRequestEdit(capped.intent,capped.request,edit({budget:{amount:null,source:'cijena nije bitna'}}),'cijena nije bitna');
 assert.equal(unlimited.intent.budget,null);assert.deepEqual(unlimited.intent.requirements,current.requirements);
 const r={id:'shoes',product:'heeled shoes',source:'',slots:[{key:'heel',label:'Heel',value:'low heel',source:''}]};
 const heels=applyRequestEdit({...structuredClone(initialIntent),goal:'heeled shoes'},r,edit({changes:[{key:'heel',label:'Heel',value:'high heel',source:'hightheels'},{key:'shoe_size',label:'Size',value:'EU 39',source:'eu 39'}]}),'hightheels eu 39');
 assert.deepEqual(heels.intent.requirements,['high heel','EU 39']);
});
test('unsupported source quotes cannot silently create a product or attribute',()=>{
 assert.throws(()=>applyRequestEdit(doors(),undefined,edit({action:'NEW_PRODUCT',product:{name:'garden gate',source:'garden'}}),'kućna vrata'),/grounded/);
 assert.throws(()=>applyRequestEdit(doors(),undefined,edit({changes:[{key:'use',label:'Use',value:'garden',source:'garden'}]}),'PVC'),/traced/);
});
test('CLARIFY does not search or leave stale products selectable',async t=>{
 const s=newSession('unclear');s.intent=doors();s.products=samples('shoes');s.selected=s.products[0];
 t.mock.method(globalThis,'fetch',async(_url:RequestInfo|URL,init?:RequestInit)=>response(edit({action:'CLARIFY',question:'Koji proizvod tražite?'}),init));
 let calls=0;await converse(s,'nešto drugo',undefined,async()=>{calls++;return {products:[],notice:''};});
 assert.equal(calls,0);assert.equal(s.products.length,0);assert.equal(s.selected,undefined);assert.equal(s.messages.at(-1)?.content,'Koji proizvod tražite?');
});
test('invalid model edit fails without displaying old product results',async t=>{
 const s=newSession('invalid');s.intent=doors();s.products=samples('shoes');
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({message:{content:'{}'}})));
 const result=await converse(s,'tv');assert.match(result.notice,/update failed/i);assert.deepEqual(s.products,[]);
});

test('a numeric field absent from the shopper message is dropped, not guessed',()=>{
 const result=applyRequestEdit(doors(),undefined,edit({action:'NEW_PRODUCT',product:{name:'television',source:'tv'},changes:[{key:'screen_size',label:'Screen size',value:'55 inches',source:'tv'}]}),'tv');
 assert.deepEqual(result.request.slots,[]);assert.deepEqual(result.intent.requirements,[]);
});

test('an inferred mention of the current TV cannot reset its budget during a size refinement',async t=>{
 const s=newSession('tv-size');s.intent={...structuredClone(initialIntent),goal:'television',budget:500};
 t.mock.method(globalThis,'fetch',async(_url:RequestInfo|URL,init?:RequestInit)=>{
  const body=JSON.parse(String(init?.body));
  if(body.format.properties.touched)return new Response(JSON.stringify({message:{content:JSON.stringify({product:'television',unclear:false,touched:['screen_size']})}}));
  return response(edit({changes:[{key:'screen_size',label:'Screen diagonal',value:'55 inches',source:'55 inches'}]}),init);
 });
 await converse(s,'55 inches',undefined,async(_q,intent)=>{assert.equal(intent.goal,'television');assert.equal(intent.budget,500);assert.deepEqual(intent.requirements,['55 inches']);return {products:[],notice:''};});
});
test('textual null from the model is never treated as a new product',async t=>{
 const s=newSession('tv-style');s.intent={...structuredClone(initialIntent),goal:'television',budget:500,requirements:['55 inches']};
 t.mock.method(globalThis,'fetch',async(_url:RequestInfo|URL,init?:RequestInit)=>{
  const body=JSON.parse(String(init?.body));
  if(body.format.properties.touched)return new Response(JSON.stringify({message:{content:JSON.stringify({product:'null',unclear:false,touched:['style']})}}));
  return response(edit({changes:[{key:'style',label:'Style',value:'simple',source:'make it simpler'}]}),init);
 });
 await converse(s,'make it simpler',undefined,async(_q,intent)=>{assert.equal(intent.goal,'television');assert.equal(intent.budget,500);assert.deepEqual(intent.requirements,['55 inches','simple']);return {products:[],notice:''};});
});
