import type {Intent} from './domain';
import type {ShoppingRequest} from './shopping-request';
export type CatalogCategory={slug:string;title:string;attributes?:{slug:string;values:string[]}[]};
export function dimensionValue(value:string){
 const match=value.trim().match(/^(\d+(?:[.,]\d+)?)\s*(mm|cm|m|in|inch|inches|ft|feet|kg|g|lb|oz)$/i);
 if(!match)return undefined;
 const units:Record<string,string>={inch:'in',inches:'in',feet:'ft'};
 const n=Number(match[1].replace(',','.'));
 return {min:n,max:n,unit:units[match[2].toLowerCase()]||match[2].toLowerCase()};
}
export function channel3Request(query:string,intent:Intent,category:CatalogCategory|null=null,latestMessage:string='',request?:ShoppingRequest){
 const slots=request?.slots||[];
 const details=slots.length?slots.map(s=>s.key.replace(/_/g,' ')+': '+s.value):[...intent.requirements,...intent.preferences];
 const dimensions:Record<string,ReturnType<typeof dimensionValue>>={};
 for(const slot of slots){
  if(!['height','width','length','weight'].includes(slot.key))continue;
  const value=dimensionValue(slot.value);
  if(value && (slot.key==='weight'?['kg','g','lb','oz'].includes(value.unit):['mm','cm','m','in','ft'].includes(value.unit)))dimensions[slot.key]=value;
 }
 const explicitGender=slots.find(s=>s.key==='gender')?.value.toLowerCase();
 const brief=[intent.goal||query,...details].filter(Boolean).join('; ');
 const attributes:Record<string,string[]>={};
 for(const slot of slots){
  const key=slot.key.replace(/_/g,'-');
  const matches=(category?.attributes||[]).filter(attr=>attr.slug!=='color' && (attr.slug===key||attr.slug.includes(key))).flatMap(attr=>{
   const value=attr.values.find(v=>v.toLowerCase()===slot.value.toLowerCase()||v.toLowerCase().endsWith('('+slot.value.toLowerCase()+')'));
   return value?[{key:attr.slug,value}]:[];
  });
  if(matches.length===1)attributes[matches[0].key]=[matches[0].value];
 }

 const gender=['female','women','woman'].includes(explicitGender||'')?'female':['male','men','man'].includes(explicitGender||'')?'male':undefined;
 return {
  query:brief.slice(0,2000),
  limit:6,
  filters:{...(category?{category_ids:[category.slug]}:{}),...(Object.keys(attributes).length?{attributes}:{}),...(Object.keys(dimensions).length?{dimensions}:{}),...(intent.budget!==null?{price:{max_price:intent.budget}}:{}),...(gender?{gender}:{}),availability:['InStock']},
  config:{mode:'default',language:'en',country:'US',currency:'USD'},
 };
}
