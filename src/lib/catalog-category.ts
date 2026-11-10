import type {ShoppingRequest} from './shopping-request';
type Category={slug:string;title:string;path:{slug:string;title:string}[];attributes?:{slug:string;values:string[]}[]};
const normalized=(text:string)=>text.toLowerCase().trim().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').replace(/ies$/,'y').replace(/(?<!s)s$/,'');
export async function fillCatalogCategory(request:ShoppingRequest,headers:Record<string,string>):Promise<Category|null>{
 const r=await fetch('https://api.trychannel3.com/v1/categories/search?query='+encodeURIComponent([request.product,...request.slots.map(s=>s.value)].join(' '))+'&limit=5',{headers,signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error('Channel3 category lookup unavailable ('+r.status+').');
 const body=await r.json();if(!Array.isArray(body.categories))throw new Error('Invalid category response.');
 const product=normalized(request.product==='tv'?'television':request.product);
 const head=product.split(' ').at(-1);
 // Match the requested type to a real taxonomy node, never a related leaf's word.
 // "Door Locks" cannot match "door"; a genuine "Shoes" ancestor may match shoes.
 const nodes=new Map<string,{node:{slug:string;title:string};path:Category['path']}>();
 for(const category of body.categories as Category[]){
  if(!Array.isArray(category.path))continue;
  category.path.forEach((node,index)=>{if(typeof node.slug==='string'&&typeof node.title==='string')nodes.set(node.slug,{node,path:category.path.slice(0,index+1)});});
 }
 const exact=[...nodes.values()].filter(({node})=>normalized(node.title)===product);
 const broad=[...nodes.values()].filter(({node})=>normalized(node.title)===head);
 const matches=exact.length?exact:broad;
 if(matches.length!==1)return null;
 const selected=matches[0];
 const detail=await fetch('https://api.trychannel3.com/v1/categories/'+encodeURIComponent(selected.node.slug),{headers,signal:AbortSignal.timeout(15000)});
 if(!detail.ok)throw new Error('Channel3 category metadata unavailable.');
 const metadata=await detail.json();
 return {...selected.node,path:selected.path,attributes:Array.isArray(metadata.attributes)?metadata.attributes.filter((a:{slug:unknown;values:unknown})=>typeof a.slug==='string'&&Array.isArray(a.values)):[]};
}
