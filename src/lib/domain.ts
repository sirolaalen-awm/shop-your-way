import { z } from 'zod';
import type {ShoppingRequest} from './shopping-request';

export const intentSchema = z.object({
  goal: z.string().max(400), requirements: z.array(z.string().max(120)).max(10),
  budget: z.number().positive().max(100000).nullable(), currency: z.enum(['USD','EUR','GBP']),
  preferences: z.array(z.string().max(120)).max(10),
  assistance: z.object({ need: z.number().min(0).max(1), price: z.number().min(0).max(1), verify: z.number().min(0).max(1), quick: z.number().min(0).max(1), explore: z.number().min(0).max(1) }),
  journey: z.enum(['online','try-on','hybrid']),
});
export type Intent = z.infer<typeof intentSchema>;
export type Product = { id:string; title:string; description:string; price:number|null; currency:string; image?:string; url?:string; merchant:string; source:'Channel3'|'Demo fixture'; observedAt:string; features:string[]; fit:string; variants:string[]; attributes?:Record<string,string[]> };
export type Receipt = { orderId:string; captureId:string; status:'COMPLETED'; amount:string; currency:'USD' };
export type Session = {
  id:string; createdAt:number; updatedAt:number; revision:number; originalIntent:string; intent:Intent;
  messages:{role:'user'|'assistant';content:string}[]; products:Product[];
  shoppingRequest?:ShoppingRequest; pendingQuestion?:string;
  channel3?:{conversationId:string;query:string};
  selected?:Product; variant:string; stopped:boolean; confirmed?:number;
  checkout?:{revision:number;requestId:string;orderId?:string;captureAttempted?:boolean;approvalUrl?:string}; receipt?:Receipt;
};
export const initialIntent:Intent = { goal:'', requirements:[],budget:null,currency:'USD',preferences:[],assistance:{need:.7,price:.3,verify:.3,quick:.3,explore:.3},journey:'online' };
export const DEMO_AMOUNT='1.00';
export function newSession(id:string):Session {return {id,createdAt:Date.now(),updatedAt:Date.now(),revision:0,originalIntent:'',intent:structuredClone(initialIntent),messages:[],products:[],variant:'',stopped:false};}
export function assertNoUnresolvedCapture(s:Session) {
  if(s.checkout?.captureAttempted && !s.receipt)throw new Error('A payment attempt needs verification. Retry the same order before changing or resetting this cart.');
}
export function invalidate(s:Session) { assertNoUnresolvedCapture(s);s.revision++; delete s.confirmed; delete s.checkout; }
export function changeSelection(s:Session,id:string) {
  assertNoUnresolvedCapture(s);
  if(s.receipt) throw new Error('Start a new session to make another selection.');
  const p=s.products.find(p=>p.id===id); if(!p) throw new Error('Choose a product from your current results.');
  s.selected=structuredClone(p);s.variant='';invalidate(s);
}
export function assertCheckout(s:Session) {
  if(s.stopped) throw new Error('Shopping is paused. Resume before checkout.');
  if(!s.selected || s.confirmed!==s.revision) throw new Error('Review and confirm your current demonstration cart first.');
  if(s.receipt) throw new Error('This demonstration cart has already been paid.');
}
export function publicSession(s:Session) {
  return {agentQuery:s.channel3?.query,originalIntent:s.originalIntent,intent:s.intent,shoppingRequest:s.shoppingRequest?{id:s.shoppingRequest.id,product:s.shoppingRequest.product,source:s.shoppingRequest.source,slots:s.shoppingRequest.slots}:undefined,messages:s.messages,products:s.products,selected:s.selected,variant:s.variant,stopped:s.stopped,revision:s.revision,confirmed:s.confirmed===s.revision,receipt:s.receipt,pendingPayment:s.checkout?.captureAttempted && !s.receipt?{orderId:s.checkout.orderId}:undefined,awaitingApproval:s.checkout?.orderId && !s.receipt?{orderId:s.checkout.orderId,approvalUrl:s.checkout.approvalUrl}:undefined};
}
