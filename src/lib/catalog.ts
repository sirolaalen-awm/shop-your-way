import type {Intent,Product} from './domain';
export function safeUrl(v:unknown):string|undefined {try{const u=new URL(String(v));return u.protocol==='https:'?u.href:undefined;}catch{return undefined;}}
export function normalizeCatalog(body:unknown,intent:Intent):Product[] {
  if(!body || typeof body!=='object' || !Array.isArray((body as {products?:unknown}).products)) throw new Error('Channel3 returned an unsupported response.');
  // External content is data, never executable instructions or a payment authority.
  return ((body as {products:Record<string,unknown>[]}).products).slice(0,3).map(p=>{
    const offers=Array.isArray(p.offers)?p.offers as Record<string,unknown>[]:[];
    const offer=offers.find(o=>o.availability==='InStock') || offers[0];
    const price=offer?.price as {price?:unknown;currency?:unknown}|undefined;
    const images=Array.isArray(p.images)?p.images as Record<string,unknown>[]:[];
    const features=Array.isArray(p.key_features)?p.key_features.filter((x):x is string=>typeof x==='string').slice(0,5):[];
    const n=Number(price?.price);const known=price?.price!==undefined && price?.price!==null && Number.isFinite(n) && n>=0;
    return {id:String(p.id),title:String(p.title).slice(0,200),description:String(p.description || '').slice(0,800),price:known?n:null,currency:String(price?.currency || ''),merchant:String(offer?.domain || 'Merchant not provided'),url:safeUrl(offer?.url),image:safeUrl(images[0]?.cleaned_url || images[0]?.url),source:'Channel3' as const,observedAt:new Date().toISOString(),features,variants:[],fit:known && intent.budget && price?.currency===intent.currency ? (n<=intent.budget?'Listed price is within your stated budget.':'Listed price exceeds your budget; compare before choosing.'):'Retrieved for your search. Check size, specifications and final merchant terms.'};
  }).filter(p=>p.id && p.id!=='undefined' && p.title!=='undefined');
}
export async function searchCatalog(query:string,intent:Intent):Promise<{products:Product[];notice:string}> {
  if(!process.env.CHANNEL3_API_KEY) return {products:[],notice:'Channel3 is not connected. No live catalog search was performed. You can explicitly open sample products instead.'};
  const response=await fetch('https://api.trychannel3.com/v1/search',{method:'POST',headers:{'x-api-key':process.env.CHANNEL3_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({query,limit:3,...(intent.budget && intent.currency==='USD'?{filters:{price:{max_price:intent.budget}}}:{})}),signal:AbortSignal.timeout(20000)});
  if(!response.ok) throw new Error(`Channel3 search failed (${response.status}). Please try again later.`);
  return {products:normalizeCatalog(await response.json(),intent),notice:'Channel3 catalog results. Prices and availability are observations, not a reservation. No merchant checkout integration.'};
}
export function samples(goal:string):Product[] {
  const tv=/tv|televis|screen/i.test(goal);
  const items=tv?[['Living Room 55','A fictional 55-inch television for comparing a clear picture and a simple setup.',399],['Cinema 65','A fictional larger television for exploring screen size trade-offs.',649]]:[['Everyday Walk','A fictional lightweight walking shoe for everyday comfort.',69],['Trail & Town','A fictional supportive shoe for mixed daily use.',89],['Easy Pace','A fictional simple walking shoe for a smaller budget.',49]];
  return items.map(([title,description,price],i)=>({id:'demo-'+(tv?'tv':'shoe')+'-'+i,title:String(title),description:String(description),price:Number(price),currency:'USD',merchant:'Fictional demonstration',source:'Demo fixture',observedAt:new Date().toISOString(),features:[],fit:'Illustrative sample only. These features and prices are fictional.',variants:tv?['55-inch — demonstration','65-inch — demonstration']:['EU 39 — demonstration','EU 40 — demonstration','EU 41 — demonstration','EU 42 — demonstration']}));
}
