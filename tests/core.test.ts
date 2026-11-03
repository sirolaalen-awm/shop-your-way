import test from 'node:test';
import assert from 'node:assert/strict';
import {newSession,changeSelection,invalidate,assertCheckout,initialIntent} from '../src/lib/domain';
import {samples,normalizeCatalog,safeUrl,searchCatalog} from '../src/lib/catalog';
import {converse,finalText,mergeIntent,intentPatchSchema,explicitFeedback,type ModelTurn} from '../src/lib/ai';
import {createOrder,captureOrder,verifyPayment,type PayPalFetch} from '../src/lib/paypal';
const session=()=>{const s=newSession('12345678-1234-1234-1234-123456789abc');s.originalIntent='Comfortable walking shoes under $100';s.products=samples('shoes');return s;};
const selected=()=>{const s=session();changeSelection(s,s.products[0].id);s.confirmed=s.revision;return s;};
const reply=(text:string,calls:ModelTurn['calls']=[]):ModelTurn=>({text,calls,raw:{role:'assistant',content:text}});
const completed=(s:ReturnType<typeof selected>)=>({id:s.checkout!.orderId,status:'COMPLETED',purchase_units:[{reference_id:'syw-demo',custom_id:s.id,amount:{value:'1.00',currency_code:'USD'},payments:{captures:[{id:'CAPTURE-123',status:'COMPLETED',amount:{value:'1.00',currency_code:'USD'}}]}}]});
test('local model reasoning delimiters cannot become shopper-facing text',()=>{assert.equal(finalText('private scratch text</think>\nHello.'),'Hello.');assert.equal(finalText('<think>incomplete'),'');assert.equal(finalText('Hello.'),'Hello.');});
test('sparse intent patch preserves budget and exact requirement strings during route change',()=>{
  const before={...structuredClone(initialIntent),goal:'Walking shoes',budget:100,requirements:['under $100']};
  const patch=intentPatchSchema.parse({goal:null,requirements:null,budget:null,currency:null,preferences:null,journey:'hybrid',assistance:{need:null,price:null,verify:.9,quick:.2,explore:null}});
  const next=mergeIntent(before,patch);assert.equal(next.budget,100);assert.deepEqual(next.requirements,['under $100']);assert.equal(next.journey,'hybrid');assert.equal(next.assistance.verify,.9);assert.equal(before.journey,'online');
});
test('explicit route and pace feedback override mistaken model guesses without resetting goals',()=>{
  const s={...structuredClone(initialIntent),goal:'Walking shoes',budget:100};
  const simple=explicitFeedback(s,'Comfortable shoes under $100. Keep it simple.');
  const hybrid=explicitFeedback(simple,'Actually I need to try them in person first, then buy online. Keep the budget.');
  assert.equal(simple.assistance.quick,.9);assert.equal(hybrid.journey,'hybrid');assert.equal(hybrid.assistance.verify,.9);assert.equal(hybrid.budget,100);assert.equal(hybrid.goal,s.goal);
  assert.equal(explicitFeedback(hybrid,'I do not want to try them in person. Online only.').journey,'online');
  assert.equal(explicitFeedback(simple,'Help me explore a TV, no rush.').assistance.explore,.9);
});
test('selection correction and changed route retain original intent but invalidate checkout',()=>{
  const s=selected();s.checkout={revision:s.revision,requestId:'key',orderId:'ORDER-123'};
  changeSelection(s,s.products[1].id);assert.equal(s.originalIntent,'Comfortable walking shoes under $100');assert.equal(s.selected!.id,s.products[1].id);assert.equal(s.confirmed,undefined);assert.equal(s.checkout,undefined);
  s.intent.journey='hybrid';invalidate(s);assert.equal(s.originalIntent,'Comfortable walking shoes under $100');
});
test('same model changes assistance and retains constraints across a correction using tool calls',async()=>{
  const s=session();let round=0;
  const updated={...initialIntent,goal:'Walking shoes',budget:100,requirements:['Comfortable'],assistance:{need:.8,price:.9,verify:.2,quick:.8,explore:0}};
  await converse(s,'Keep it simple and affordable',async()=>round++===0?reply('',[{id:'1',name:'update_intent',arguments:JSON.stringify(updated)}]):reply('I’ll keep the options simple.'));
  let second=0;const next={...updated,journey:'hybrid',assistance:{...updated.assistance,verify:1,quick:.2}};
  await converse(s,'Actually I want to try them first',async()=>second++===0?reply('',[{id:'2',name:'update_intent',arguments:JSON.stringify(next)}]):reply('We can plan a try-on. No stock or appointment has been confirmed.'));
  assert.equal(s.intent.budget,100);assert.equal(s.intent.journey,'hybrid');assert.equal(s.intent.assistance.verify,1);assert.equal(s.originalIntent,'Comfortable walking shoes under $100');
});
test('invalid tool arguments and unauthorized payment tool cannot mutate intent or execute payments',async()=>{
  const s=session();let i=0;const before=structuredClone(s.intent);
  await converse(s,'help',async()=>i++===0?reply('',[{id:'x',name:'update_intent',arguments:'{"budget":-1}'},{id:'y',name:'capture_payment',arguments:'{}'}]):reply('Let’s check your needs.'));
  assert.deepEqual(s.intent,before);assert.equal(s.checkout,undefined);
});
test('one catalog search per turn even if model repeats calls',async()=>{
  const s=session();let i=0,calls=0;
  await converse(s,'find shoes',async()=>i++===0?reply('',[1,2,3].map(n=>({id:String(n),name:'search_products',arguments:'{"query":"shoes"}'}))):reply('Here are the results.'),async()=>{calls++;return {products:[],notice:'No results'};});
  assert.equal(calls,1);
});
test('Channel3 current documented product/offers schema is normalized; unsafe links rejected',()=>{
  const products=normalizeCatalog({products:[{id:'p1',title:'Walking shoe',images:[{url:'https://images.example/shoe.png'}],offers:[{domain:'shop.example',url:'javascript:alert(1)',price:{price:79,currency:'USD'},availability:'InStock'}],key_features:['Soft sole']}]},{...initialIntent,budget:100});
  assert.equal(products[0].price,79);assert.equal(products[0].url,undefined);assert.equal(products[0].source,'Channel3');assert.match(products[0].fit,/within/);assert.equal(safeUrl('http://bad.example'),undefined);
  assert.throws(()=>normalizeCatalog({items:[]},initialIntent));
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
  const fake:PayPalFetch=async path=>{if(path.endsWith('/capture')){captures++;return {status:'COMPLETED'};}return captures?completed(s):{status:'APPROVED'};};
  const r=await captureOrder(s,'ORDER-123',fake);assert.equal(r.status,'COMPLETED');assert.equal(r.captureId,'CAPTURE-123');await captureOrder(s,'ORDER-123',fake);assert.equal(captures,1);
});
test('capture recovery reads completed order after response loss; pending, mismatched amount/identity rejected',async()=>{
  const s=selected();s.checkout={revision:s.revision,requestId:'key',orderId:'ORDER-123'};let calls=0;
  await captureOrder(s,'ORDER-123',async()=>{calls++;return completed(s);});assert.equal(calls,1);
  for(const mutate of [(b:any)=>b.purchase_units[0].custom_id='other',(b:any)=>b.purchase_units[0].payments.captures[0].amount.value='9.00',(b:any)=>b.purchase_units[0].payments.captures[0].status='PENDING']){const b=completed(s);mutate(b);assert.throws(()=>verifyPayment(b,s));}
});
