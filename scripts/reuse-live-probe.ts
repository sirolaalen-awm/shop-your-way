import {readFile,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {converse} from '../src/lib/channel3-companion';
import {newSession,type Session} from '../src/lib/domain';
const env=parseEnv(await readFile('.env.local','utf8'));process.env.CHANNEL3_API_KEY=env.CHANNEL3_API_KEY;
const native=globalThis.fetch;let localCalls=0;
globalThis.fetch=async(input,init)=>{if(String(input).includes('/api/chat')||String(input).includes('openai.com'))localCalls++;return native(input,init);};
const records:any[]=[];
async function run(s:Session,label:string,text:string,check:(s:Session)=>boolean){
 const start=Date.now();const out=await converse(s,text);const pass=check(s)&&localCalls===0;
 records.push({label,text,pass,ms:Date.now()-start,query:s.channel3?.query,conversationId:s.channel3?.conversationId,products:s.products.map(p=>({title:p.title,merchant:p.merchant,price:p.price,currency:p.currency,description:p.description})),reply:s.messages.at(-1)?.content,notice:out.notice,localCalls});
 console.log(JSON.stringify({label,pass,query:s.channel3?.query,titles:s.products.map(p=>p.title),ms:Date.now()-start}));await writeFile(process.env.SYW_PROBE_OUTPUT||'evidence/reuse-live.json',JSON.stringify({checkedAt:new Date().toISOString(),records},null,2));
}
const garment=newSession('reuse-garment');
await run(garment,'Croatian down vest','dugi \u017eenski pro\u0161iveni pernati prsluk size m',s=>s.products.length>0&&s.products.every(p=>/vest|gilet|waistcoat/i.test(p.title)&&!/\bbra\b|slipper/i.test(p.title)));
await run(garment,'vest black budget refinement','samo crni modeli, do 150 dolara',s=>/vest|gilet|prsluk/i.test(s.channel3?.query||'')&&s.products.length>0&&s.products.every(p=>p.price!==null&&p.price<=150));
await run(garment,'switch garment to bra','tra\u017eim \u017eenske grudnjake',s=>s.products.length>0&&s.products.every(p=>/bra|bralette/i.test(p.title)&&!/vest|slipper/i.test(p.title)));
await run(garment,'Victoria typo keeps bra','victoria sicrets modeli',s=>s.products.length>0&&s.products.every(p=>/bra|bralette/i.test(p.title)&&/victoria/i.test(p.title+' '+p.merchant)));
const tv=newSession('reuse-tv');
await run(tv,'television with budget','tra\u017eim TV 55 in\u010da do 500 dolara',s=>s.products.length>0&&s.products.every(p=>/tv|television/i.test(p.title)&&p.price!==null&&p.price<=500));
await run(tv,'TV cap correction','do 400 dolara',s=>/TV|television/i.test(s.channel3?.query||'')&&s.products.length>0&&s.products.every(p=>p.price!==null&&p.price<=400));
await run(tv,'remove TV ceiling','cijena nije bitna',s=>/TV|television/i.test(s.channel3?.query||'')&&s.products.length>0);
const shoes=newSession('reuse-shoes');
await run(shoes,'daily low heel shoes','\u017eenske cipele za svaki dan s niskom petom',s=>s.products.length>0&&!s.products.some(p=>/steel toe|safety toe/i.test(p.title)));
await run(shoes,'feminine shoe refinement','malo \u017eenstvenije',s=>s.products.length>0&&!s.products.some(p=>/steel toe|safety toe/i.test(p.title)));
await run(shoes,'switch shoes to cordless drill','tra\u017eim akumulatorsku bu\u0161ilicu',s=>s.products.length>0&&s.products.every(p=>/drill|driver/i.test(p.title)&&!/power bank|laptop|saw/i.test(p.title)));
console.log(JSON.stringify({passed:records.filter(r=>r.pass).length,total:records.length,localCalls}));process.exitCode=records.some(r=>!r.pass)?1:0;
