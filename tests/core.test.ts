import test from 'node:test';
import assert from 'node:assert/strict';
import {newSession,changeSelection,invalidate,assertCheckout,initialIntent} from '../src/lib/domain';
import {samples,normalizeCatalog,safeUrl,searchCatalog} from '../src/lib/catalog';
import {converse,explicitFeedback} from '../src/lib/ai';
import {applyRequestEdit,type RequestEdit} from '../src/lib/shopping-request';
import {createOrder,captureOrder,verifyPayment,type PayPalFetch} from '../src/lib/paypal';
const session=()=>{const s=newSession('12345678-1234-1234-1234-123456789abc');s.originalIntent='Comfortable walking shoes under $100';s.intent.goal='shoes';s.products=samples('shoes');return s;};
const selected=()=>{const s=session();changeSelection(s,s.products[0].id);s.confirmed=s.revision;return s;};
const completed=(s:ReturnType<typeof selected>)=>({id:s.checkout!.orderId,status:'COMPLETED',purchase_units:[{reference_id:'syw-demo',custom_id:s.id,amount:{value:'1.00',currency_code:'USD'},payments:{captures:[{id:'CAPTURE-123',status:'COMPLETED',amount:{value:'1.00',currency_code:'USD'}}]}}]});
const delta=(patch:Partial<RequestEdit>={}):RequestEdit=>({action:'REFINE',product:null,changes:[],budget:null,retainBudgetSource:null,journey:null,question:null,...patch});
test('US price corrections replace the ceiling without changing shoe requirements',()=>{
  const before={...structuredClone(initialIntent),goal:'Safety work shoes',budget:120,requirements:['protective safety toe'],preferences:["US men's size 10"]};
  for(const text of ['My budget is now $90 USD. Keep all my other requirements unchanged.','Show me options under $90.','under 90 USD','up to $90','maximum $90','budget: $90']){
    const after=explicitFeedback(before,text);
    assert.equal(after.budget,90,text);assert.equal(after.currency,'USD');
    assert.deepEqual(after.requirements,before.requirements);assert.deepEqual(after.preferences,before.preferences);
  }
  assert.equal(explicitFeedback(before,'under $89.99').budget,89.99);
  assert.equal(explicitFeedback(before,"US men's size 10. Keep the budget.").budget,120);
  assert.equal(explicitFeedback(before,'under $0').budget,120);
  assert.equal(explicitFeedback(before,'under $100001').budget,120);
  assert.equal(before.budget,120);
});

test('explicit route and pace feedback override mistaken model guesses without resetting goals',()=>{
  const s={...structuredClone(initialIntent),goal:'Walking shoes',budget:100};
  const simple=explicitFeedback(s,'Comfortable shoes under $100. Keep it simple.');
  const hybrid=explicitFeedback(simple,'Actually I need to try them in person first, then buy online. Keep the budget.');
  assert.equal(simple.assistance.quick,.9);assert.equal(hybrid.journey,'hybrid');assert.equal(hybrid.assistance.verify,.9);assert.equal(hybrid.budget,100);assert.equal(hybrid.goal,s.goal);
  assert.equal(explicitFeedback(hybrid,'I do not want to try them in person. Online only.').journey,'online');
  assert.equal(explicitFeedback(simple,'Help me explore a TV, no rush.').assistance.explore,.9);
  assert.equal(explicitFeedback(simple,'I want to try them in a store before deciding online.').journey,'hybrid');
  assert.equal(explicitFeedback(simple,'Želim ih isprobati u trgovini prije odluke.').journey,'try-on');
});
test('selection correction and changed route retain original intent but invalidate checkout',()=>{
  const s=selected();s.checkout={revision:s.revision,requestId:'key',orderId:'ORDER-123'};
  changeSelection(s,s.products[1].id);assert.equal(s.originalIntent,'Comfortable walking shoes under $100');assert.equal(s.selected!.id,s.products[1].id);assert.equal(s.confirmed,undefined);assert.equal(s.checkout,undefined);
  s.intent.journey='hybrid';invalidate(s);assert.equal(s.originalIntent,'Comfortable walking shoes under $100');
});

test('route refinement preserves budget and the exact current requirements',()=>{
 const before={...structuredClone(initialIntent),goal:'shoes',budget:100,requirements:['wide fit']};
 const next=applyRequestEdit(before,undefined,delta({journey:'hybrid'}),'try first, then online');
 assert.equal(next.intent.budget,100);assert.deepEqual(next.intent.requirements,['wide fit']);assert.equal(next.intent.journey,'hybrid');assert.equal(before.journey,'online');
});
test('one editor updates pace and route without a second conversational model',async()=>{
 const s=session();let edits=0;
 const search=async()=>({products:samples('shoes'),notice:'Fixture catalog'});
 await converse(s,'Keep it simple and affordable',async()=>{edits++;return delta();},search);
 assert.equal(s.intent.assistance.quick,.9);assert.equal(s.intent.assistance.price,.9);
 await converse(s,'Actually I need to try them in person first, then buy online',async()=>{edits++;return delta({journey:'hybrid'});},search);
 assert.equal(s.intent.journey,'hybrid');assert.equal(s.intent.assistance.verify,.9);assert.equal(edits,2);
});
test('an invalid model/tool-shaped response cannot search or authorize payment',async()=>{
 const s=selected();const before=structuredClone(s.intent);let searches=0;
 const result=await converse(s,'help',async()=>({name:'capture_payment',arguments:'{}'} as unknown as RequestEdit),async()=>{searches++;return {products:[],notice:''};});
 assert.deepEqual(s.intent,before);assert.equal(searches,0);assert.equal(s.checkout,undefined);assert.deepEqual(s.products,[]);assert.match(result.notice,/update failed/i);
});
test('a turn executes one catalog request and returns a factual summary',async()=>{
 const s=session();let edits=0,searches=0;
 await converse(s,'find shoes',async()=>{edits++;return delta();},async()=>{searches++;return {products:samples('shoes'),notice:'Fixture catalog'};});
 assert.equal(edits,1);assert.equal(searches,1);assert.match(s.messages.at(-1)!.content,/3/);
});
test('a catalog summary does not invent local fitting or store availability',async()=>{
 const s=session();s.intent.journey='hybrid';
 const product={...samples('shoes')[0],source:'Channel3' as const,title:'Walking shoe'};
 await converse(s,'show me comfortable shoes',async()=>delta(),async()=>({products:[product],notice:'Catalog result'}));
 assert.match(s.messages.at(-1)!.content,/have not been checked/);assert.doesNotMatch(s.messages.at(-1)!.content,/available for try-on at stores near you/i);
});
test('Mija size correction uses the same request reducer with no model and one search',async()=>{
 const s=session();let searches=0;
 const editor=async()=>{throw new Error('An explicit size should not call AI');};
 const search=async(_q:string,intent:typeof s.intent,_text?:string,request?:typeof s.shoppingRequest)=>{
  searches++;assert.equal(request?.slots.find(slot=>slot.key==='shoe_size')?.value,searches===1?'EU 43':'EU 44');
  assert.ok([...intent.requirements,...intent.preferences].includes(searches===1?'EU 43':'EU 44'));
  return {products:[],notice:'Fixture catalog'};
 };
 await converse(s,'Eu broj 43',editor,search);await converse(s,'EU 44',editor,search);
 assert.equal(searches,2);assert.ok(![...s.intent.requirements,...s.intent.preferences].includes('EU 43'));
});
test('Channel3 current documented product/offers schema is normalized; unsafe links rejected',()=>{
  const products=normalizeCatalog({products:[{id:'p1',title:'Walking shoe',images:[{url:'https://images.example/shoe.png'}],offers:[{domain:'shop.example',url:'javascript:alert(1)',price:{price:79,currency:'USD'},availability:'InStock'}],key_features:['Soft sole']}]},{...initialIntent,budget:100});
  assert.equal(products[0].price,79);assert.equal(products[0].url,undefined);assert.equal(products[0].source,'Channel3');assert.match(products[0].fit,/within/);assert.equal(safeUrl('http://bad.example'),undefined);
  assert.throws(()=>normalizeCatalog({items:[]},initialIntent));
});
test('Croatian strict budget survives model guess and currency is USD',()=>{
  const next=explicitFeedback({...structuredClone(initialIntent),budget:null,currency:'EUR'},'tražim tenisice do 100 $');
  assert.equal(next.budget,100);assert.equal(next.currency,'USD');
  assert.equal(explicitFeedback(next,'do 80 €').currency,'EUR');
});
test('search enforces shopper budget and currency on provider results',async()=>{
  const oldKey=process.env.CHANNEL3_API_KEY;const oldFetch=globalThis.fetch;
  process.env.CHANNEL3_API_KEY='test-only-placeholder';
  const data={products:[
    {id:'1',title:'Comfortable Running Sneakers',offers:[{domain:'shop.test',price:{price:150,currency:'USD'}}]},
    {id:'2',title:'Everyday Walking Shoes',offers:[{domain:'shop.test',price:{price:89,currency:'USD'}}]},
    {id:'3',title:'Casual Shoe',offers:[{domain:'shop.test',price:{price:70,currency:'EUR'}}]},
    {id:'4',title:'Safety Steel Toe Work Shoe',offers:[{domain:'shop.test',price:{price:95,currency:'USD'}}]}
  ]};
  globalThis.fetch=async(url,init)=>{if(String(url).includes('/api/chat')){const body=JSON.parse(String(init?.body));const data=JSON.parse(body.messages[1].content);return new Response(JSON.stringify({message:{content:JSON.stringify({matches:data.candidates.map((p:{index:number;title:string})=>({index:p.index,productEvidence:p.title,constraints:[]}))})}}));}return new Response(JSON.stringify(String(url).includes('/categories/search')?{categories:[{slug:'shoes',title:'Shoes'}]}:{products:data.products.map(p=>({...p,category:{slug:'shoes',path:[{slug:'shoes'}]}}))}),{status:200});};
  try{
    const intent={...structuredClone(initialIntent),budget:100,currency:'USD' as const};
    const result=await searchCatalog('dnevne cipele',intent);
    assert.deepEqual(result.products.map(p=>p.id),['2','4']);
    assert.ok(result.products.every(p=>p.price!==null&&p.price<=100&&p.currency==='USD'));
    const work=await searchCatalog('radne cipele sa zaštitnom kapicom',intent);
    assert.deepEqual(work.products.map(p=>p.id),['2','4']);
  }finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.CHANNEL3_API_KEY;else process.env.CHANNEL3_API_KEY=oldKey;}
});
test('missing Channel3 credentials never silently substitutes fixtures',async()=>{
  const old=process.env.CHANNEL3_API_KEY;delete process.env.CHANNEL3_API_KEY;
  try{const r=await searchCatalog('shoes',initialIntent);assert.deepEqual(r.products,[]);assert.match(r.notice,/not connected/);}finally{if(old)process.env.CHANNEL3_API_KEY=old;}
});
test('unconfirmed, paused, and paid carts cannot start a payment',()=>{
  const s=session();assert.throws(()=>assertCheckout(s));changeSelection(s,s.products[0].id);assert.throws(()=>assertCheckout(s));s.confirmed=s.revision;s.stopped=true;assert.throws(()=>assertCheckout(s));
});
test('checkout uses server-authoritative fixed demo amount, no catalog price, and stable create idempotency',async()=>{
  const s=selected();let calls=0;let checkpointed=false;
  const fake:PayPalFetch=async(path,body,key)=>{calls++;assert.equal(checkpointed,true);assert.equal(path,'/v2/checkout/orders');assert.equal((body as any).purchase_units[0].amount.value,'1.00');assert.equal((body as any).purchase_units[0].custom_id,s.id);assert.match(key!,/^create-/);return {id:'ORDER-123'};};
  const a=await createOrder(s,fake,async()=>{checkpointed=true;});const b=await createOrder(s,fake);assert.equal(a,b);assert.equal(calls,1);
});
test('lost create response retains key for retry',async()=>{
  const s=selected();let first='';await assert.rejects(createOrder(s,async(_p,_b,k)=>{first=k!;throw new Error('timeout');}));
  await createOrder(s,async(_p,_b,k)=>{assert.equal(k,first);return {id:'ORDER-123'};});
});
test('capture validates ownership and stale cart before external call',async()=>{
  const s=selected();s.checkout={revision:s.revision,requestId:'key',orderId:'ORDER-123'};let calls=0;
  const fake:PayPalFetch=async()=>{calls++;return {};};
  await assert.rejects(captureOrder(s,'OTHER-123',fake));invalidate(s);await assert.rejects(captureOrder(s,'ORDER-123',fake));assert.equal(calls,0);
});
test('verified capture and retry return same receipt without a second capture',async()=>{
  const s=selected();s.checkout={revision:s.revision,requestId:'key',orderId:'ORDER-123'};let captures=0;
  const fake:PayPalFetch=async path=>{if(path.endsWith('/capture')){captures++;return {status:'COMPLETED'};}return captures?completed(s):{status:'APPROVED',payer:{payer_id:'TEST-BUYER'},purchase_units:[{payee:{merchant_id:'TEST-MERCHANT'}}]};};
  const r=await captureOrder(s,'ORDER-123',fake);assert.equal(r.status,'COMPLETED');assert.equal(r.captureId,'CAPTURE-123');await captureOrder(s,'ORDER-123',fake);assert.equal(captures,1);
});
test('capture recovery reads completed order after response loss; pending, mismatched amount/identity rejected',async()=>{
  const s=selected();s.checkout={revision:s.revision,requestId:'key',orderId:'ORDER-123'};let calls=0;
  await captureOrder(s,'ORDER-123',async()=>{calls++;return completed(s);});assert.equal(calls,1);
  for(const mutate of [(b:any)=>b.purchase_units[0].custom_id='other',(b:any)=>b.purchase_units[0].payments.captures[0].amount.value='9.00',(b:any)=>b.purchase_units[0].payments.captures[0].status='PENDING']){const b=completed(s);mutate(b);assert.throws(()=>verifyPayment(b,s));}
});
