import test from 'node:test';
import assert from 'node:assert/strict';
import {initialIntent} from '../src/lib/domain';
import {searchCatalog} from '../src/lib/catalog';
import {channel3Request} from '../src/lib/channel3-search';
test('filled request goes directly to Channel3 default search without an AI review',async t=>{
 const old=process.env.CHANNEL3_API_KEY;process.env.CHANNEL3_API_KEY='test-key';const requests:{url:string;body:any}[]=[];
 t.mock.method(globalThis,'fetch',async(url:RequestInfo|URL,options?:RequestInit)=>{
  requests.push({url:String(url),body:options?.body?JSON.parse(String(options.body)):null});
  assert.equal(String(url),'https://api.trychannel3.com/v1/search');
  return new Response(JSON.stringify({products:[{id:'drill',title:'Cordless drill',offers:[{price:{price:80,currency:'USD'}}]},{id:'expensive',title:'Cordless drill',offers:[{price:{price:150,currency:'USD'}}]}]}));
 });
 try{const result=await searchCatalog('cordless drill',{...structuredClone(initialIntent),goal:'cordless drill',budget:100},'akumulatorska bušilica');
 assert.deepEqual(result.products.map(p=>p.id),['drill']);assert.equal(requests.length,1);
 assert.equal(requests[0].body.config.mode,'default');assert.equal(requests[0].body.config.country,'US');assert.equal(requests[0].body.query,'cordless drill');assert.equal('category_ids' in requests[0].body.filters,false);
 }finally{if(old===undefined)delete process.env.CHANNEL3_API_KEY;else process.env.CHANNEL3_API_KEY=old;}
});
test('TV screen diagonal stays in query and cannot become physical width',()=>{
 const request={id:'tv',product:'television',source:'tv',slots:[{key:'screen_size',label:'Screen diagonal',value:'55 inches',source:'55 inča'},{key:'technology',label:'Technology',value:'OLED',source:'OLED'}]};
 const body=channel3Request('tv',{...structuredClone(initialIntent),goal:'television'},null,'',request);
 assert.match(body.query,/55 inches/);assert.match(body.query,/OLED/);assert.equal('dimensions' in body.filters,false);assert.equal('attributes' in body.filters,false);
});
test('explicit physical dimensions become unit-aware filters; ambiguous axes remain in query',()=>{
 const request={id:'door',product:'house door',source:'',slots:[{key:'height',label:'Height',value:'200 cm',source:''},{key:'width',label:'Width',value:'100 cm',source:''},{key:'dimension_note',label:'Dimensions',value:'H 200 - V 100 cm',source:''}]};
 const body=channel3Request('door',{...structuredClone(initialIntent),goal:'house door'},null,'',request);
 assert.deepEqual(body.filters.dimensions,{height:{min:200,max:200,unit:'cm'},width:{min:100,max:100,unit:'cm'}});assert.match(body.query,/H 200 - V 100/);
});
test('unspecified budget has no price filter; gender requires a filled field',()=>{
 const request={id:'heels',product:'heeled shoes',source:'',slots:[{key:'gender',label:'Gender',value:'female',source:'ženske'}]};
 const body=channel3Request('heels',{...structuredClone(initialIntent),goal:'heeled shoes'},null,'',request);
 assert.equal(body.filters.gender,'female');assert.equal('price' in body.filters,false);
});

test('category filling refuses a similar word in the wrong full taxonomy path',async t=>{
 const old=process.env.CHANNEL3_API_KEY;process.env.CHANNEL3_API_KEY='test';
 const seen:string[]=[];
 t.mock.method(globalThis,'fetch',async(url:RequestInfo|URL)=>{
  seen.push(String(url));
  if(String(url).includes('/categories/search'))return new Response(JSON.stringify({categories:[{slug:'fences-gates',title:'Fences & Gates',path:[{slug:'pet-supplies',title:'Pet Supplies'}]}]}));
  if(String(url).includes('/api/chat'))return new Response(JSON.stringify({message:{content:'{"slug":null}'}}));
  throw new Error('No product search should follow an unresolved category.');
 });
 try{const request={id:'door',product:'house door',source:'house door',slots:[]};const result=await searchCatalog('house door',{...structuredClone(initialIntent),goal:'house door'},'house door',request);
 assert.deepEqual(result.products,[]);assert.match(result.notice,/category/);assert.equal(seen.length,1);
 }finally{if(old===undefined)delete process.env.CHANNEL3_API_KEY;else process.env.CHANNEL3_API_KEY=old;}
});
test('a selected real category and its supported attribute constrain search and are reused',async t=>{
 const old=process.env.CHANNEL3_API_KEY;process.env.CHANNEL3_API_KEY='test';
 let modelCalls=0;let searches=0;
 t.mock.method(globalThis,'fetch',async(url:RequestInfo|URL,init?:RequestInit)=>{
  const address=String(url);
  if(address.includes('/categories/search'))return new Response(JSON.stringify({categories:[{slug:'televisions',title:'Televisions',path:[{slug:'electronics',title:'Electronics'},{slug:'televisions',title:'Televisions'}]}]}));
  if(address.includes('/categories/'))return new Response(JSON.stringify({attributes:[{slug:'display-technology',values:['OLED','QLED']}]}));
  if(address.includes('/api/chat')){modelCalls++;return new Response(JSON.stringify({message:{content:'{"slug":"televisions"}'}}));}
  searches++;const body=JSON.parse(String(init?.body));assert.deepEqual(body.filters.category_ids,['televisions']);assert.deepEqual(body.filters.attributes,{'display-technology':['OLED']});
  return new Response(JSON.stringify({products:[{id:'tv',title:'OLED Television',category:{slug:'televisions'}},{id:'stand',title:'TV Stand',category:{slug:'tv-stands'}}]}));
 });
 try{const request={id:'tv',product:'television',source:'tv',slots:[{key:'technology',label:'Technology',value:'OLED',source:'OLED'}]};const intent={...structuredClone(initialIntent),goal:'television'};
 assert.deepEqual((await searchCatalog('television',intent,'OLED',request)).products.map(p=>p.id),['tv']);
 await searchCatalog('television',intent,'OLED',request);assert.equal(modelCalls,0);assert.equal(searches,2);
 }finally{if(old===undefined)delete process.env.CHANNEL3_API_KEY;else process.env.CHANNEL3_API_KEY=old;}
});
