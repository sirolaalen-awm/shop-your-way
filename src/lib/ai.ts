import {intentSchema,invalidate,type Session,type Intent} from './domain';
import {searchCatalog} from './catalog';
import {immediateRequestEdit} from './request-controls';
import {extractRequestEdit,applyRequestEdit,requestEditSchema} from './shopping-request';
export function explicitFeedback(intent:Intent,text:string):Intent {
  // Explicit shopper controls override model guesses. This is a small parsing guard,
  // not a second AI or a claim of general semantic understanding.
  const next=structuredClone(intent);const t=text.toLowerCase();
  const physical=/in[- ]person|try (?:them|it|the shoes) (?:on|first|in (?:a |the )?store)|try[- ]on|try (?:before|at) (?:buying|choosing)|probati uživo|isprobati uživo|probati (?:ih |to )?(?:u trgovini|u dućanu)|isprobati (?:ih |to )?(?:u trgovini|u dućanu)/.test(t);
  const rejectsPhysical=/(?:don't|do not|no|not) (?:want |need )?(?:to )?(?:try|visit)|online only|samo online/.test(t);
  if(/hybrid|hibrid/.test(t) || (physical && /online/.test(t) && !rejectsPhysical))next.journey='hybrid';
  else if(physical && !rejectsPhysical)next.journey='try-on';
  else if(/online only|samo online/.test(t))next.journey='online';
  if(/keep it simple|keep (?:the )?options simple|no fuss|quick (?:purchase|decision)|jednostavno|bez komplikacija/.test(t)){next.assistance.quick=.9;next.assistance.explore=.1;next.assistance.verify=Math.min(next.assistance.verify,.3);}
  if(/explor(?:e|ing)|compar(?:e|ing)|no (?:hurry|rush)|not in a hurry|istraživ|uspored/.test(t)){next.assistance.explore=.9;next.assistance.quick=.2;}
  if(physical && !rejectsPhysical){next.assistance.verify=.9;next.assistance.quick=.2;}
  if(/under \$|budget|affordable|cheapest|budžet|povoljno/.test(t))next.assistance.price=.9;
  // The buyer's explicit price ceiling overrides model inference, including Croatian 'do 100 $'.
  const maxPrice=text.match(/(?:\bdo\s*|\bunder\s*|\bup to\s*|\bmax(?:imum)?\s*|\bbudget\s*(?:(?:is|of)\s*)?(?:now\s*)?(?:[:=]\s*)?)(\$|€|£)?\s*(\d{1,6}(?:[.,]\d{1,2})?)(?!\d|[.,]\d)\s*(usd|dolara|eur|eura|gbp|\$|€|£)?/i);
  const amount=maxPrice?Number(maxPrice[2].replace(',','.')):null;
  if(amount!==null && amount>0 && amount<=100000){
    next.budget=amount;
    const token=(maxPrice![1]||maxPrice![3]||'').toLowerCase();
    if(token==='$'||token==='usd'||token==='dolara')next.currency='USD';
    if(token==='€'||token==='eur'||token==='eura')next.currency='EUR';
    if(token==='£'||token==='gbp')next.currency='GBP';
  }
  if(/cijena\s+nije\s+bitna|bez\s+(?:cjenovnog\s+)?(?:limita|ograničenja)|price\s+(?:does\s*not|doesn't)\s+matter|no\s+budget\s+limit|budget\s+is\s+(?:unlimited|not\s+important)/i.test(text)){
    next.budget=null;next.assistance.price=.1;
  }
  return next;
}
export async function extractIntent(s:Session,editor:typeof extractRequestEdit=extractRequestEdit) {
 const text=s.messages.at(-1)?.content||'';
 const oldRequestId=s.shoppingRequest?.id;
 const edit=requestEditSchema.parse(immediateRequestEdit(s.intent,s.shoppingRequest,text)||await editor(s.intent,s.shoppingRequest,text));
 const result=applyRequestEdit(s.intent,s.shoppingRequest,edit,text);
 if(result.question){s.pendingQuestion=result.question;s.products=[];delete s.selected;s.variant='';invalidate(s);return;}
 delete s.pendingQuestion;
 const behavior=explicitFeedback(result.intent,text);
 const priceControl=/(?:\$|dolara|usd|bud\u017eet|budget|price|cijena|limita|limit)/i.test(text)||/^(?:do|under|up to)\s*\d+(?:[.,]\d+)?\s*$/i.test(text.trim());
 const next=intentSchema.parse({...result.intent,...(priceControl?{budget:behavior.budget}:{}),assistance:behavior.assistance,journey:behavior.journey});
 s.shoppingRequest=result.request;
 if(oldRequestId!==result.request.id||JSON.stringify(next)!==JSON.stringify(s.intent)){s.intent=next;invalidate(s);}
}

export type RequestEditor=typeof extractRequestEdit;
export async function converse(s:Session,text:string,editor:RequestEditor=extractRequestEdit,search:typeof searchCatalog=searchCatalog){
 if(s.stopped)throw new Error('Resume shopping before sending a message.');
 if(s.messages.length>=80)throw new Error('This session is full. Start a new session to continue.');
 if(!s.originalIntent)s.originalIntent=text;
 s.messages.push({role:'user',content:text});
 const before=JSON.stringify([s.intent.goal,s.intent.requirements,s.intent.preferences,s.intent.budget,s.intent.currency]);
 const oldId=s.shoppingRequest?.id;
 try{await extractIntent(s,editor);}catch{
  s.products=[];delete s.selected;s.variant='';delete s.pendingQuestion;invalidate(s);
  s.messages.push({role:'assistant',content:'Nisam uspio pouzdano obraditi novu poruku. Pretraga nije izvršena; pokušajte ponovno ili pojasnite zahtjev.'});
  return {notice:'Request update failed. No search or payment was performed.'};
 }
 if(s.pendingQuestion){s.messages.push({role:'assistant',content:s.pendingQuestion});return {notice:'Please clarify the request; no search of the old product was performed.'};}
 if(!s.intent.goal){s.messages.push({role:'assistant',content:'Koji proizvod tražite?'});return {notice:''};}
 const changed=before!==JSON.stringify([s.intent.goal,s.intent.requirements,s.intent.preferences,s.intent.budget,s.intent.currency])||oldId!==s.shoppingRequest?.id;
 const retry=/(?:tražim|trazim|pronađi|pronadi|nađi|potraži|pokaži|pokazi|ponovi|looking for|find|search|show|retry|try again)/i.test(text);
 if(!changed&&!retry&&s.products.length){s.messages.push({role:'assistant',content:'Detalji su sačuvani. Možete ih dopuniti ili stati ovdje.'});return {notice:''};}
 if(changed){s.products=[];delete s.selected;s.variant='';}
 const query=[s.intent.goal,...s.intent.requirements,...s.intent.preferences].join(' ').slice(0,500);
 try{
  const found=await search(query,s.intent,text,s.shoppingRequest);
  s.products=found.products;
  if(s.selected&&!s.products.some(p=>p.id===s.selected!.id)){delete s.selected;s.variant='';invalidate(s);}
  const reply=s.products.length
   ? 'Pronašao sam '+s.products.length+' ponude u katalogu. Pogledajte ih ispod razgovora; specifikacije i dostupnost provjerite kod trgovca.'
   : found.notice.includes('not connected')?'Katalog nije spojen. Vaš zahtjev je sačuvan.'
   : found.notice.includes('suitable category')?'Nisam uspio povezati taj proizvod s odgovarajućom kategorijom kataloga. Vaš zahtjev je sačuvan.'
   : 'Katalog nije vratio ponude za ovaj zahtjev. Detalji su sačuvani; možete ih promijeniti ili stati ovdje.';
  s.messages.push({role:'assistant',content:reply+(s.products.length&&s.intent.journey!=='online'?' Store stock and in-person availability have not been checked.':'')});
  return {notice:found.notice};
 }catch{
  s.products=[];delete s.selected;s.variant='';invalidate(s);
  s.messages.push({role:'assistant',content:'Katalog trenutačno nije odgovorio. Zahtjev je sačuvan; možete ponoviti pretragu.'});
  return {notice:'Catalog currently unavailable; no result claimed.'};
 }
}
