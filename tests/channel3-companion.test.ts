import test from 'node:test';
import assert from 'node:assert/strict';
import {converse,type AgentTurn} from '../src/lib/channel3-companion';
import {newSession,publicSession,changeSelection} from '../src/lib/domain';
import {samples} from '../src/lib/catalog';
const result=(text:string,query='bras',products:any[]=[])=>({conversation_id:'conv_fixture',turn_id:'turn_fixture',usage:{credits_charged:2,searches_run:1},message:{role:'assistant' as const,parts:[{type:'tool' as const,tool_name:'search_products',tool_call_id:'call',input:{query},output:{products}},{type:'text' as const,text}]}});
const product=(id:string,currency='USD')=>({id,title:id,offers:[{domain:'merchant.example',url:'https://merchant.example/'+id,availability:'InStock',price:{price:40,currency}}]});
test('native companion delegates each exact message, continues privately, sets context once and US/USD on every turn',async()=>{
 const s=newSession('sdk-test');s.intent.goal='bra';const calls:any[]=[];
 const run:AgentTurn=async request=>{calls.push(request);return result('Here is [B](cp:b).','Victoria Secret bras',[product('a'),product('b'),product('c'),product('d')]);};
 await converse(s,'victoria sicrets modeli',run);
 assert.equal(calls[0].message.parts?.[0].type,'text');assert.equal((calls[0].message.parts?.[0] as any).text,'victoria sicrets modeli');
 assert.match(calls[0].context.application_context,/THREE/);assert.match(calls[0].context.user_context,/bra/);
 assert.deepEqual(s.products.map(p=>p.id),['b']);assert.equal(s.messages.at(-1)?.content,'Here is B.');
 assert.equal((publicSession(s) as any).channel3,undefined);assert.equal(publicSession(s).agentQuery,'Victoria Secret bras');
 const restored=JSON.parse(JSON.stringify(s));await converse(restored,'black only',run);
 assert.equal(calls[1].conversation_id,'conv_fixture');assert.equal(calls[1].context,undefined);
 for(const c of calls){assert.deepEqual(c.config,{country:'US',currency:'USD',language:'en',mode:'default',offer_refresh_timeout_ms:2000});assert.deepEqual(c.filters,{availability:['InStock']});}
});
test('every new agent turn clears old selectable/confirmed state and failed service never calls a fallback',async()=>{
 const s=newSession('failure');s.products=samples('shoes');changeSelection(s,s.products[0].id);s.confirmed=s.revision;
 s.channel3={conversationId:'conv_previous',query:'shoes'};let calls=0;
 const out=await converse(s,'different product',async()=>{calls++;throw new Error('503');});
 assert.equal(calls,1);assert.equal(s.products.length,0);assert.equal(s.selected,undefined);assert.equal(s.confirmed,undefined);
 assert.equal(s.channel3.conversationId,'conv_previous');assert.match(out.notice,/No fallback/);assert.equal(s.checkout,undefined);
});
test('paused or unresolved payment sessions cannot send a turn to the hosted agent',async()=>{
 const s=newSession('paused');let calls=0;const run:AgentTurn=async()=>{calls++;return result('ok');};
 s.stopped=true;await assert.rejects(converse(s,'help',run));s.stopped=false;
 s.checkout={revision:0,requestId:'r',orderId:'o',captureAttempted:true};await assert.rejects(converse(s,'help',run));assert.equal(calls,0);
});
test('no catalog tool means no old cards; unsafe links and foreign-price offers are not exposed as USD',async()=>{
 const s=newSession('clarify');s.products=samples('shoes');
 await converse(s,'help',async()=>({...result('Which product?'),message:{role:'assistant',parts:[{type:'text',text:'Which product?'}]}}));
 assert.equal(s.products.length,0);
 const bad={...product('bad'),offers:[{domain:'x',url:'javascript:alert(1)',price:{price:20,currency:'USD'}}]};
 await converse(s,'show me',async()=>result('Choices [bad](cp:bad)','shoes',[bad,product('eur','EUR')]));assert.deepEqual(s.products.map(p=>p.id),['bad']);assert.equal(s.products[0].url,undefined);
});

test('a broad search pool without an explicit recommendation never fills shortlist slots',async()=>{
 const s=newSession('candidate-pool');const out=await converse(s,'find an exact match',async()=>result('No exact match verified.','vest',[product('unrelated-a'),product('unrelated-b')]));
 assert.equal(s.products.length,0);assert.match(out.notice,/No extra products/);
});
test('native show_products is an explicit shortlist and catalog attributes retain their source values',async()=>{
 const s=newSession('native-show');const chosen:any={...product('selected'),structured_attributes:{'insulation-fill-material':['Goose down'],invalid:'not an array'}};
 await converse(s,'show selected',async()=>({...result('Selected catalog item.','vest'),message:{role:'assistant',parts:[{type:'tool',tool_name:'show_products',tool_call_id:'show',input:{product_ids:['selected']},output:{products:[chosen]}}]}}));
 assert.equal(s.products.length,1);assert.deepEqual(s.products[0].attributes,{'insulation-fill-material':['Goose down']});
});
