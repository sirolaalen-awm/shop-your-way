import {channel3Request} from './channel3-search';
import type {ShoppingRequest} from './shopping-request';
import {fillCatalogCategory} from './catalog-category';
import type {Intent,Product} from './domain';
export function safeUrl(v:unknown):string|undefined {try{const u=new URL(String(v));return u.protocol==='https:'?u.href:undefined;}catch{return undefined;}}
export function normalizeCatalog(body:unknown,intent:Intent):Product[] {
  if(!body || typeof body!=='object' || !Array.isArray((body as {products?:unknown}).products)) throw new Error('Channel3 returned an unsupported response.');
  // External content is data, never executable instructions or a payment authority.
  return ((body as {products:Record<string,unknown>[]}).products).slice(0,12).map(p=>{
    const offers=Array.isArray(p.offers)?p.offers as Record<string,unknown>[]:[];
    const offer=offers.find(o=>o.availability==='InStock') || offers[0];
    const price=offer?.price as {price?:unknown;currency?:unknown}|undefined;
    const images=Array.isArray(p.images)?p.images as Record<string,unknown>[]:[];
    const features=Array.isArray(p.key_features)?p.key_features.filter((x):x is string=>typeof x==='string').slice(0,5):[];
    const n=Number(price?.price);const known=price?.price!==undefined && price?.price!==null && Number.isFinite(n) && n>=0;
    return {id:String(p.id),title:String(p.title).slice(0,200),description:String(p.description || '').slice(0,800),price:known?n:null,currency:String(price?.currency || ''),merchant:String(offer?.domain || 'Merchant not provided'),url:safeUrl(offer?.url),image:safeUrl(images[0]?.cleaned_url || images[0]?.url),source:'Channel3' as const,observedAt:new Date().toISOString(),features,variants:[],attributes:p.structured_attributes&&typeof p.structured_attributes==='object'?Object.fromEntries(Object.entries(p.structured_attributes).filter(([,value])=>Array.isArray(value)&&value.every(v=>typeof v==='string'))):undefined,fit:known && intent.budget && price?.currency===intent.currency ? (n<=intent.budget?'Listed price is within your stated budget.':'Listed price exceeds your budget; compare before choosing.'):'Retrieved for your search. Check size, specifications and final merchant terms.'};
  }).filter(p=>p.id && p.id!=='undefined' && p.title!=='undefined');
}
export async function searchCatalog(query:string,intent:Intent,latestMessage:string='',request?:ShoppingRequest):Promise<{products:Product[];notice:string}> {
  if(!process.env.CHANNEL3_API_KEY) return {products:[],notice:'Channel3 is not connected. No live catalog search was performed. You can explicitly open sample products instead.'};
  const headers={'x-api-key':process.env.CHANNEL3_API_KEY,'Content-Type':'application/json'};
  // Agentic search resolves the full brief; the first category hit is not an identity check.
  if(request && request.category===undefined)request.category=await fillCatalogCategory(request,headers);
  if(request && request.category===null)return {products:[],notice:'Channel3 has not provided a suitable category for this product. No related-category substitutes were shown; your request is saved.'};
  const category=request?.category||null;
  const response=await fetch('https://api.trychannel3.com/v1/search',{method:'POST',headers,body:JSON.stringify(channel3Request(query,intent,category,latestMessage,request)),signal:AbortSignal.timeout(60000)});
  if(!response.ok) throw new Error('Channel3 search failed ('+response.status+'). Please try again later.');
  const body=await response.json();
  if(category && Array.isArray(body.products))body.products=body.products.filter((p:{category?:{slug?:string;path?:{slug:string}[]}})=>p.category?.slug===category.slug||p.category?.path?.some(c=>c.slug===category.slug));
  const raw=normalizeCatalog(body,intent);
  const categoryMatches=raw;
  // Search-provider price filters are advisory: the shopper's ceiling is enforced locally too.
  // Unknown or foreign-currency prices are excluded rather than compared as if equivalent.
  const eligible=categoryMatches.filter(p=>intent.budget===null || (p.price!==null && p.currency===intent.currency && p.price<=intent.budget));
  const products=eligible.slice(0,3);
  const notice=products.length
    ? 'Channel3 search results for your current request. Check product details, specifications and final availability with the merchant.'
    : categoryMatches.length && intent.budget!==null
      ? `No matching offers with a confirmed price at or below ${intent.budget} ${intent.currency}. Higher-priced or unverified-price items were withheld.`
      : 'Channel3 returned no results for this request. This does not prove the product is unavailable elsewhere.';
  return {products,notice};
}
export function samples(goal:string):Product[] {
  const tv=/tv|televis|screen/i.test(goal);
  const items=tv?[['Living Room 55','A fictional 55-inch television for comparing a clear picture and a simple setup.',399],['Cinema 65','A fictional larger television for exploring screen size trade-offs.',649]]:[['Everyday Walk','A fictional lightweight walking shoe for everyday comfort.',69],['Trail & Town','A fictional supportive shoe for mixed daily use.',89],['Easy Pace','A fictional simple walking shoe for a smaller budget.',49]];
  return items.map(([title,description,price],i)=>({id:'demo-'+(tv?'tv':'shoe')+'-'+i,title:String(title),description:String(description),price:Number(price),currency:'USD',merchant:'Fictional demonstration',source:'Demo fixture',observedAt:new Date().toISOString(),features:[],fit:'Illustrative sample only. These features and prices are fictional.',variants:tv?['55-inch — demonstration','65-inch — demonstration']:['EU 39 — demonstration','EU 40 — demonstration','EU 41 — demonstration','EU 42 — demonstration']}));
}
