import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {intentSchema,type Intent} from './domain';
import {structuredAI} from './structured-ai';

export type RequestSlot={key:string;label:string;value:string;source:string};
export type ShoppingRequest={id:string;product:string;source:string;slots:RequestSlot[];category?:{slug:string;title:string;path:{slug:string;title:string}[];attributes?:{slug:string;values:string[]}[]}|null};
export const requestEditSchema=z.object({
 action:z.enum(['NEW_PRODUCT','REFINE','CLARIFY']),
 product:z.object({name:z.string().min(1).max(160),source:z.string().min(1).max(300)}).nullable(),
 changes:z.array(z.object({key:z.string().min(1).max(40),label:z.string().min(1).max(50),value:z.string().max(120).nullable(),source:z.string().min(1).max(300)})).max(20),
 budget:z.object({amount:z.number().positive().max(100000).nullable(),source:z.string().min(1).max(300)}).nullable(),
 retainBudgetSource:z.string().max(300).nullable(),
 journey:z.enum(['online','try-on','hybrid']).nullable(),
 question:z.string().max(250).nullable(),
});
export type RequestEdit=z.infer<typeof requestEditSchema>;
export function seedRequest(intent:Intent):ShoppingRequest{
 return {id:randomUUID(),product:intent.goal,source:'',slots:[
 ...intent.requirements.map((value,i)=>({key:'requirement_'+i,label:'Requirement',value,source:''})),
 ...intent.preferences.map((value,i)=>({key:'preference_'+i,label:'Preference',value,source:''})),
 ]};
}
export function applyRequestEdit(intent:Intent,current:ShoppingRequest|undefined,edit:RequestEdit,text:string){
 const stated=(source:string)=>source.trim().length>0 && text.toLocaleLowerCase().includes(source.trim().toLocaleLowerCase());
 if(edit.action==='CLARIFY')return {intent,request:current||seedRequest(intent),question:edit.question||'Could you clarify which product or detail you want to change?'};
 if(edit.action==='NEW_PRODUCT' && (!edit.product || !stated(edit.product.source)))throw new Error('The new product was not grounded in your message. Please name the product again.');
 if(edit.action==='REFINE' && !intent.goal)throw new Error('Please name the product first.');
 const isNew=edit.action==='NEW_PRODUCT';
 const request:ShoppingRequest=isNew?{id:randomUUID(),product:edit.product!.name,source:edit.product!.source,slots:[]}:structuredClone(current||seedRequest(intent));
 const slots=new Map(request.slots.map(s=>[s.key,s]));
 for(const change of edit.changes){
  if(!stated(change.source))throw new Error('A changed detail could not be traced to your message. Please clarify it.');
  if(['name','product','product_name'].includes(change.key))continue;
  if(change.value===null){slots.delete(change.key);continue;}
  const numbers=change.value.match(/\d+(?:[.,]\d+)?/g)||[];
  if(numbers.some(n=>!(change.source.match(/\d+(?:[.,]\d+)?/g)||[]).map(v=>v.replace(',','.')).includes(n.replace(',','.'))))continue;
  if(['height','width','length'].includes(change.key)){
   const axes:Record<string,RegExp>={height:/height|visin/i,width:/width|\u0161irin|sirin/i,length:/length|duljin|du\u017ein|duzin/i};
   if(!axes[change.key].test(change.source)){slots.set('dimension_note',{key:'dimension_note',label:'Dimensions',value:change.source,source:change.source});continue;}
  }
    const labels:Record<string,string>={screen_size:'Screen diagonal',shoe_size:'Shoe size',dimension_note:'Dimensions',power_source:'Power source',clothing_size:'Clothing size'};
  let value=change.value;
  if(change.key==='shoe_size' && /\bEU\b/i.test(change.source) && !/\bEU\b/i.test(value))value='EU '+value;
  if(change.key==='shoe_size' && /\bUS\b/i.test(change.source) && !/\bUS\b/i.test(value))value='US '+value;
  slots.set(change.key,{...change,label:labels[change.key]||change.key.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase()),value});
 }
 request.slots=[...slots.values()];
 if(edit.changes.length && request.category===null)delete request.category;
 if(request.slots.length>20)throw new Error('Too many details; please simplify this request.');
 const next=structuredClone(intent);
 if(isNew){next.goal=request.product;next.budget=edit.retainBudgetSource && stated(edit.retainBudgetSource)?intent.budget:null;next.journey='online';}
 next.currency='USD';
 if(edit.budget){if(!stated(edit.budget.source))throw new Error('The budget was not grounded in your message.');if(edit.budget.amount!==null && !(edit.budget.source.match(/\d+(?:[.,]\d+)?/g)||[]).some(n=>Number(n.replace(',','.'))===edit.budget!.amount))throw new Error('The price amount was not stated in your message.');next.budget=edit.budget.amount;}
 if(edit.journey)next.journey=edit.journey;
 next.requirements=request.slots.slice(0,10).map(s=>s.value);
 next.preferences=request.slots.slice(10,20).map(s=>s.value);
 return {intent:intentSchema.parse(next),request,question:null};
}

export const fieldNames=['material','height','width','length','weight','dimension_note','screen_size','technology','resolution','heel','shoe_size','clothing_size','gender','comfort','style','use','power_source','shoe_type','brand','other'] as const;
const fieldsSchema=z.object(Object.fromEntries(fieldNames.map(key=>[key,z.string().max(120).nullable()]))).extend({
 gender:z.enum(['female','male']).nullable(),heel:z.enum(['Flat','Low','Mid','High','Very high']).nullable(),
 power_source:z.enum(['Battery-powered','AC-powered','Manual','USB','Solar','Gasoline']).nullable(),
});
export const shoppingFormSchema=z.object({
 action:z.enum(['NEW_PRODUCT','REFINE','CLARIFY']),product:z.string().min(1).max(160).nullable(),
 fields:fieldsSchema,clear:z.array(z.string().max(40)).max(20),
 budgetAction:z.enum(['KEEP','SET','CLEAR']),budget:z.number().positive().max(100000).nullable(),
 retainBudget:z.boolean(),journey:z.enum(['online','try-on','hybrid']).nullable(),question:z.string().max(250).nullable(),
});
const instructions="Read ONLY latestMessage for new values. currentRequest is context for resolving references, never text to extract again. Fill named shopping form fields from the latest shopper message. JSON only. Every named field must be present; null means not stated now. Never copy old field values or invent a size, gender, purpose or installation. NEW_PRODUCT is used whenever the latest message explicitly requests a product by name; clear old product fields. Do not infer or copy the previous product. REFINE is for attribute-only, comparative, budget or size messages without a new explicit product request. REFINE edits the same product; unmentioned fields remain unchanged automatically. CLARIFY asks one question only if product or meaning is unintelligible; gender is optional. product is a generic English noun (shoes, television, drill, house door); put modifiers into fields. A brand-only or model-range reply refines the current product; never guess a different product from a brand. Croatian prsluk/lajbek=vest (outerwear), pernati prosiveni prsluk=quilted down/puffer vest, grudnjak=bra; never translate prsluk as bra. Croatian cipele na petu=heeled shoes in shoe_type (never on foot and never infer High), salonske cipele=dress pumps, zenske=female, niska peta=Low heel, akumulatorska busilica=drill with Battery-powered power_source. Preserve every stated detail, number and unit. Clothing size M is clothing_size Medium (M), never drop it or use shoe_size. Unclear H/V axes remain dimension_note. TV inches are screen_size, never width. EU size must retain EU. For REFINE product:null. budgetAction KEEP if absent, SET with stated number, CLEAR for no limit. retainBudget false unless explicitly kept on product change. clear removes explicitly abandoned field keys. No extra preferences.";
const emptyFields=Object.fromEntries(fieldNames.map(key=>[key,null]));
const baseForm={action:'REFINE',product:null,fields:emptyFields,clear:[],budgetAction:'KEEP',budget:null,retainBudget:false,journey:null,question:null};
const examples:{role:string;content:string}[]=[];
function example(currentProduct:string,text:string,patch:Record<string,unknown>,fields:Record<string,string>={}){
 examples.push({role:'user',content:JSON.stringify({currentRequest:{product:currentProduct,fields:[],budget:null},hasCurrentProduct:!!currentProduct,latestMessage:text})},{role:'assistant',content:JSON.stringify({...baseForm,...patch,fields:{...emptyFields,...fields}})});
}
example('house door','tra\u017eim tv',{action:'NEW_PRODUCT',product:'television'});
example('shoes','tra\u017eim akumulatorsku bu\u0161ilicu',{action:'NEW_PRODUCT',product:'drill'},{power_source:'Battery-powered'});
example('work shoes','haj - \u017eenske cipele za svaki dan sa niskom petom',{action:'NEW_PRODUCT',product:'shoes'},{gender:'female',use:'everyday',heel:'Low'});
example('work shoes','udobne salonske cipele za ve\u010der, cijena nije bitna',{action:'NEW_PRODUCT',product:'shoes',budgetAction:'CLEAR'},{shoe_type:'dress pumps',comfort:'comfortable',use:'evening'});
example('shoes','malo \u017eenstvenije',{}, {style:'feminine'});
example('shoes','hightheels eu 39',{}, {heel:'High',shoe_size:'EU 39'});
example('shoes','dugi zenski prosiveni pernati prsluk size m',{action:'NEW_PRODUCT',product:'vest'},{gender:'female',material:'down',style:'long quilted puffer',clothing_size:'Medium (M)'});
example('bra','victoria sicrets modeli',{}, {brand:"Victoria's Secret"});
example('vest','victoria sicrets modeli',{}, {brand:"Victoria's Secret"});
export async function extractRequestEdit(intent:Intent,current:ShoppingRequest|undefined,text:string):Promise<RequestEdit>{
 const request=current||seedRequest(intent);
 const currentRequest={product:request.product,fields:request.slots.map(({key,value})=>({key,value})),budget:intent.budget};
 const signal=await structuredAI(z.object({product:z.string().min(1).max(100).nullable(),unclear:z.boolean(),touched:z.array(z.enum([...fieldNames,'budget','journey','product'])).max(22)}),[
 {role:'system',content:"Extract changes ONLY from latestMessage. currentRequest is historical context, NEVER copy its fields into touched. Use currentRequest only to resolve follow-ups. Identify the PRODUCT EXPLICITLY REQUESTED and the fields explicitly mentioned in this message. A brand name or request for its models is an attribute-only refinement of currentRequest.product; it never names a new product by itself. victoria sicrets means Victoria's Secret, touched [brand], product null. Croatian prsluk and lajbek mean vest, not bra; dugi zenski prosiveni pernati prsluk size m means vest, touched [gender,material,style,clothing_size]. Grudnjak means bra. product is the generic English product noun when the shopper names the item being sought, even without a verb: udobne salonske cipele za vecer => product shoes, touched [comfort,shoe_type,use]; zenske cipele za svaki dan sa niskom petom => product shoes, touched [gender,use,heel]; trazim akumulatorsku busilicu => product drill, touched [power_source]; trazim tv or bare TV => product television, touched []. Attribute-only/comparative replies do NOT request a new product: malo zenstvenije => product null, touched [style], NEVER heel/use; hightheels eu 39 when a current product exists => product null, touched [heel,shoe_size]; 55 inca OLED => product null, touched [screen_size,technology]; cijena nije bitna => product null, touched [budget]. The explicit correction ne trazim radne cipele nego zenske cipele na petu => product shoes, touched [gender,shoe_type]. Na petu means heeled shoes, not on foot, and does not specify heel height. Pumps are shoes, not equipment. Never copy the old product. unclear is true only for an unintelligible request. Return JSON only."},
 {role:'system',content:'Historical context only, not a new shopper message: '+JSON.stringify({currentRequest})},
 {role:'user',content:text}
 ],'identify_changed_fields',220);
 const canonical=(value:string)=>value.toLowerCase().trim().replace(/^tv$/,'television').replace(/s$/,'');
 const mentioned=signal.product&&!/^(null|none|unchanged|n\/a)$/i.test(signal.product.trim())?signal.product:null;
 const differentProduct=mentioned!==null&&canonical(mentioned)!==canonical(request.product);
 const action=differentProduct?'NEW_PRODUCT':signal.unclear?'CLARIFY':'REFINE';
 const touched=new Set<string>(signal.touched);
 const schema=shoppingFormSchema.extend({
  action:z.literal(action),
  product:differentProduct?z.literal(mentioned!):z.null(),
  fields:z.object(Object.fromEntries(Object.entries(fieldsSchema.shape).map(([key,field])=>[key,touched.has(key)?field:z.null()]))),
  clear:z.array(z.string().max(40)).max(touched.size?20:0),
  budgetAction:touched.has('budget')?shoppingFormSchema.shape.budgetAction:z.literal('KEEP'),
  budget:touched.has('budget')?shoppingFormSchema.shape.budget:z.null(),
  journey:touched.has('journey')?shoppingFormSchema.shape.journey:z.null(),
 });
 const form=await structuredAI(schema,[
 {role:'system',content:instructions},...examples,
 {role:'system',content:'Historical context only, do not extract these values again: '+JSON.stringify({currentRequest,allowedFields:signal.touched})},
 {role:'user',content:text}
 ],'fill_shopping_form',900);
 const changes:RequestEdit['changes']=[];
 for(const [key,value] of Object.entries(form.fields))if(value!==null)changes.push({key,label:key,value:value as string,source:text});
 for(const key of form.clear.filter(key=>touched.has(key)))changes.push({key,label:key,value:null,source:text});
 return requestEditSchema.parse({
 action:form.action,product:form.product?{name:form.product,source:text}:null,changes,
 budget:form.budgetAction==='KEEP'?null:{amount:form.budgetAction==='CLEAR'?null:form.budget,source:text},
 retainBudgetSource:form.retainBudget?text:null,journey:form.journey,question:form.question,
 });
}
