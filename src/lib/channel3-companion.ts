import {Channel3,type Channel3Api} from '@channel3/sdk';
import {assertNoUnresolvedCapture,invalidate,type Session} from './domain';
import {normalizeCatalog} from './catalog';

export type AgentTurn=(request:Channel3Api.CreateTurnConversationsRequest)=>Promise<Channel3Api.TurnResult>;
export const APPLICATION_CONTEXT=`Shop Your Way is a general shopping app for ALL retail categories: clothing, electronics, household products and power tools. It is NOT a fashion-only app. A shopper requesting a drill, a TV or a bra is making an ordinary shopping request. Follow the latest requested product even when it changes category; on a product change discard incompatible old criteria. US market, USD prices. Reply in the shopper's language. Understand their needs before recommending at most THREE genuinely relevant products. Keep replies short. Preserve the product and constraints across attribute/brand refinements; switch product only when requested. Do not replace unavailable items with unrelated products. Never invent size, material, stock or merchant facts. If there is a budget, respect it in each search. If no exact match, explain the missing criterion. Do not upsell, pressure, use pet names, or ask unnecessary follow-ups. The shopper may stop without buying. Recommend only products from your catalog tools. Link EVERY recommended product with its cp ID; the app displays your shortlist, not the wider search pool. This app does NOT sell catalog merchandise. Merchant links are for checking products. PayPal is a separate voluntary $1 USD Sandbox demonstration token, no physical goods, delivery or reservation. You cannot choose, confirm or execute a payment; those are separate explicit user controls.`;

export const channel3Turn:AgentTurn=async request=>{
 if(!process.env.CHANNEL3_API_KEY)throw new Error('Channel3 is not connected.');
 const client=new Channel3({apiKey:process.env.CHANNEL3_API_KEY,timeoutInSeconds:90,maxRetries:0});
 return client.conversations.createTurn(request);
};

export async function converse(s:Session,text:string,runTurn:AgentTurn=channel3Turn){
 if(s.stopped)throw new Error('Resume shopping before sending a message.');
 if(s.receipt)throw new Error('Start a new conversation after the completed demonstration.');
 assertNoUnresolvedCapture(s);
 if(s.messages.length>=80)throw new Error('This session is full. Start a new session to continue.');
 const previous=s.channel3;
 const migration=previous?undefined:JSON.stringify({currentProduct:s.intent.goal,details:[...s.intent.requirements,...s.intent.preferences],journey:s.intent.journey});
 if(!s.originalIntent)s.originalIntent=text;
 s.messages.push({role:'user',content:text});
 s.products=[];delete s.selected;s.variant='';delete s.pendingQuestion;invalidate(s);
 try{
  const result=await runTurn({
   message:{role:'user',parts:[{type:'text',text}]},
   ...(previous?{conversation_id:previous.conversationId}:{context:{application_context:APPLICATION_CONTEXT,user_context:migration}}),
   config:{country:'US',currency:'USD',language:'en',mode:'default',offer_refresh_timeout_ms:2000},
   filters:{availability:['InStock']},
  });
  if(!result.conversation_id||!Array.isArray(result.message?.parts))throw new Error('Incomplete Channel3 answer.');
  const parts=result.message.parts;
  const tools=parts.filter(p=>p.type==='tool');
  const searches=tools.flatMap(p=>p.input&&'query' in p.input&&typeof p.input.query==='string'?[p.input.query]:[]);
  const query=searches.at(-1)||previous?.query||text;
  s.channel3={conversationId:result.conversation_id,query};
  // The native query is the source of this summary. Do not run a second model
  // to manufacture form fields or pretend a structured budget was returned.
  s.intent.goal=query.slice(0,400);s.intent.requirements=[];s.intent.preferences=[];s.intent.budget=null;s.intent.currency='USD';
  delete s.shoppingRequest;
  const raw=tools.flatMap(p=>p.output&&'products' in p.output&&Array.isArray(p.output.products)?p.output.products:[]);
  const answer=parts.filter(p=>p.type==='text').map(p=>p.text).join('\n\n');
  const mentioned=[...answer.matchAll(/\]\(cp:([a-zA-Z0-9_-]+)\)/g)].map(m=>m[1]);
  const displayed=tools.filter(p=>['show_products','compare_products'].includes(p.tool_name)).flatMap(p=>p.output&&'products' in p.output&&Array.isArray(p.output.products)?p.output.products.map(product=>product.id):[]);
  const byId=new Map(raw.map(product=>[product.id,product]));
  const chosen=[...new Set([...mentioned,...displayed])].slice(0,3).flatMap(id=>byId.has(id)?[byId.get(id)!]:[]);
  // Search candidates are not recommendations. Never fill spare card slots
  // with products the native agent did not select.
  s.products=normalizeCatalog({products:chosen},s.intent).filter(p=>p.currency==='USD'||p.price===null);
  const reply=answer.replace(/\[([^\]]+)\]\(cp:[^)]+\)/g,'$1').trim();
  s.messages.push({role:'assistant',content:reply||'Channel3 nije vratio tekstualni odgovor. Možete pojasniti zahtjev ili stati ovdje.'});
  return {notice:s.products.length?'Channel3 recommendations. Check exact options, specifications and final availability with the merchant.':'Channel3 has not supplied a linked shortlist for this turn. No extra products were added.'};
 }catch{
  s.messages.push({role:'assistant',content:'Channel3 trenutačno nije dovršio odgovor. Stare ponude su uklonjene; možete ponovno pokušati ili stati ovdje.'});
  return {notice:'Channel3 did not complete this turn. No fallback search or payment was performed.'};
 }
}
