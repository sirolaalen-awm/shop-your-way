import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {transaction} from '../../../lib/store';
import {publicSession,changeSelection,invalidate} from '../../../lib/domain';
import {converse} from '../../../lib/ai';
import {samples} from '../../../lib/catalog';
import {captureOrder,createOrder} from '../../../lib/paypal';
export const runtime='nodejs';
const cookie='syw-session';
const shape=z.discriminatedUnion('action',[
  z.object({action:z.literal('chat'),text:z.string().trim().min(1).max(2000)}),
  z.object({action:z.literal('select'),id:z.string().max(200)}),
  z.object({action:z.literal('variant'),variant:z.string().trim().max(120)}),
  z.object({action:z.literal('journey'),journey:z.enum(['online','try-on','hybrid'])}),
  z.object({action:z.enum(['samples','stop','resume','reset'])}),
  z.object({action:z.enum(['confirm','create']),revision:z.number().int().nonnegative()}),
  z.object({action:z.literal('capture'),orderId:z.string().max(64),revision:z.number().int().nonnegative()}),
]);
function config(){return {aiProvider:process.env.AI_PROVIDER==='openai'?'OpenAI':'Local Ollama',catalog:!!process.env.CHANNEL3_API_KEY,paypal:!!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),clientId:process.env.PAYPAL_CLIENT_ID || '',demoAmount:'1.00'};}
function sessionId(r:NextRequest){const id=r.cookies.get(cookie)?.value;return id && /^[a-f0-9-]{36}$/.test(id)?id:randomUUID();}
function reply(id:string,value:unknown,status=200){const r=NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});r.cookies.set(cookie,id,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production' && (process.env.APP_ORIGIN || '').startsWith('https:'),path:'/',maxAge:86400});return r;}
export async function GET(r:NextRequest){const id=sessionId(r);return transaction(id,async s=>reply(id,{session:publicSession(s),config:config()}));}
export async function POST(r:NextRequest){
  const origin=process.env.APP_ORIGIN || 'http://127.0.0.1:3000';
  if(r.headers.get('origin')!==origin)return NextResponse.json({error:'This request must come from the shopping app.'},{status:403});
  if(Number(r.headers.get('content-length') || 0)>12000)return NextResponse.json({error:'Message too large.'},{status:413});
  const id=sessionId(r);
  try{
    const raw=await r.text();if(raw.length>12000)throw new Error('Message too large.');const a=shape.parse(JSON.parse(raw));
    return await transaction(id,async(s,checkpoint)=>{
      let extra:Record<string,unknown>={};
      if(a.action==='reset'){const n=randomUUID();return reply(n,{reset:true});}
      if(s.receipt && !['capture','stop'].includes(a.action))throw new Error('Your demonstration is complete. Start a new session to shop again.');
      if(s.stopped && !['resume','stop'].includes(a.action))throw new Error('Shopping is paused. Resume whenever you are ready.');
      if('revision' in a && a.revision!==s.revision)throw new Error('Your cart changed in another tab. Refresh and review it before continuing.');
      if(a.action==='chat')extra=await converse(s,a.text);
      if(a.action==='select')changeSelection(s,a.id);
      if(a.action==='variant'){if(!s.selected)throw new Error('Choose a product first.');s.variant=a.variant;invalidate(s);}
      if(a.action==='journey'){s.intent.journey=a.journey;invalidate(s);}
      if(a.action==='samples'){s.products=samples(s.intent.goal || s.originalIntent);extra.notice='Fictional sample products. No external catalog call or merchant purchase.';}
      if(a.action==='stop'){s.stopped=true;invalidate(s);}
      if(a.action==='resume')s.stopped=false;
      if(a.action==='confirm'){if(!s.selected)throw new Error('Choose a product before confirming.');s.confirmed=s.revision;}
      if(a.action==='create')extra.orderId=await createOrder(s,undefined,checkpoint);
      if(a.action==='capture')extra.receipt=await captureOrder(s,a.orderId);
      return reply(id,{session:publicSession(s),config:config(),...extra});
    });
  }catch(e){return reply(id,{error:e instanceof z.ZodError?'Please check the submitted shopping details.':e instanceof Error?e.message:'Something went wrong. Please try again.'},400);}
}
