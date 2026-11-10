import {DEMO_AMOUNT,type Receipt,type Session,assertCheckout,assertNoUnresolvedCapture} from './domain';
import {randomUUID} from 'node:crypto';
// Deliberately no live-mode switch. This app cannot send a production payment.
const BASE='https://api-m.sandbox.paypal.com';
const safeIssues=new Set(['INSTRUMENT_DECLINED','ORDER_NOT_APPROVED','PAYER_ACTION_REQUIRED','ORDER_ALREADY_CAPTURED','TRANSACTION_REFUSED','PAYMENT_DENIED']);
export class PayPalApiError extends Error {
  constructor(public httpStatus:number,public issue?:string){super(`PayPal Sandbox request failed (${httpStatus}${issue?'; '+issue:''}). Retry using the same cart; no success is assumed.`);}
}
async function token() {
  const {PAYPAL_CLIENT_ID:id,PAYPAL_CLIENT_SECRET:secret}=process.env;
  if(!id || !secret)throw new Error('PayPal Sandbox is not configured. No payment was created.');
  const r=await fetch(BASE+'/v1/oauth2/token',{method:'POST',redirect:'error',headers:{Authorization:'Basic '+Buffer.from(id+':'+secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error(`PayPal Sandbox authentication failed (${r.status}).`);return (await r.json()).access_token as string;
}
export type PayPalFetch=(path:string,body?:unknown,requestId?:string)=>Promise<Record<string,any>>;
export const sandboxApi:PayPalFetch=async(path,body,requestId)=>{
  if(!/^\/v2\/checkout\/orders(?:\/[A-Za-z0-9-]{5,64}(?:\/capture)?)?$/.test(path))throw new Error('Unsupported Sandbox API path.');
  const bearer=await token();const r=await fetch(BASE+path,{method:body===undefined?'GET':'POST',redirect:'error',headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json',...(requestId?{'PayPal-Request-Id':requestId}:{}),Prefer:'return=representation'},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
  if(!r.ok){let issue:string|undefined;try{const b=await r.json();const candidate=b.details?.[0]?.issue;if(safeIssues.has(candidate))issue=candidate;}catch{}throw new PayPalApiError(r.status,issue);}
  return r.json();
};
export function approvalUrlFromResponse(b:Record<string,any>):string|undefined {
  const link=b.links?.find((l:{rel:string;href:unknown})=>['approve','payer-action'].includes(l.rel) && typeof l.href==='string');
  if(!link)return undefined;
  const u=new URL(link.href);
  if(u.protocol!=='https:' || !['www.sandbox.paypal.com','sandbox.paypal.com'].includes(u.hostname) || u.username || u.password)throw new Error('PayPal returned an unexpected approval destination.');
  return link.href;
}
export async function createOrder(s:Session,call:PayPalFetch=sandboxApi,checkpoint:()=>Promise<void>=async()=>{}) {
  assertCheckout(s);
  s.checkout ??={revision:s.revision,requestId:randomUUID()};
  if(s.checkout.revision!==s.revision)throw new Error('Your cart changed. Confirm it again.');
  if(s.checkout.orderId)return s.checkout.orderId;
  // Persist the idempotency key BEFORE the external request, including lost responses.
  await checkpoint();
  const origin=process.env.APP_ORIGIN || 'http://127.0.0.1:3000';
  const returnUrl=new URL('/?paypal=return',origin).href;
  const cancelUrl=new URL('/?paypal=cancel',origin).href;
  const b=await call('/v2/checkout/orders',{intent:'CAPTURE',purchase_units:[{reference_id:'syw-demo',custom_id:s.id,description:'Shop Your Way — Sandbox demonstration only. No goods or fulfillment.',amount:{currency_code:'USD',value:DEMO_AMOUNT}}],payment_source:{paypal:{experience_context:{brand_name:'Shop Your Way · Sandbox',shipping_preference:'NO_SHIPPING',user_action:'PAY_NOW',return_url:returnUrl,cancel_url:cancelUrl}}}},'create-'+s.checkout.requestId);
  if(typeof b.id!=='string')throw new Error('PayPal did not return an order ID.');
  s.checkout.orderId=b.id;s.checkout.approvalUrl=approvalUrlFromResponse(b);return b.id;
}
export async function replaceExpiredOrder(s:Session,call:PayPalFetch=sandboxApi,checkpoint:()=>Promise<void>=async()=>{}) {
  assertCheckout(s);assertNoUnresolvedCapture(s);
  if(!s.checkout?.orderId)throw new Error('No existing order to check.');
  try{await call('/v2/checkout/orders/'+s.checkout.orderId);}
  catch(e){
    if(!(e instanceof PayPalApiError) || e.httpStatus!==404)throw e;
    s.checkout={revision:s.revision,requestId:randomUUID()};await checkpoint();
    return createOrder(s,call,checkpoint);
  }
  throw new Error('The existing order is still available. Continue with that order; a new order was not created.');
}
export function assertBuyerMerchantDistinct(b:Record<string,any>) {
  const buyer=b.payer?.payer_id || b.payment_source?.paypal?.account_id;
  const merchant=b.purchase_units?.[0]?.payee?.merchant_id;
  if(!buyer || !merchant)throw new Error('Buyer and merchant identities are not both confirmed. No capture was sent.');
  if(buyer===merchant)throw new Error('Sandbox buyer and merchant must be different accounts. No capture was sent.');
}
export function verifyPayment(b:Record<string,any>,s:Session):Receipt {
  const units=b.purchase_units;
  if(b.id!==s.checkout?.orderId || b.status!=='COMPLETED' || !Array.isArray(units) || units.length!==1)throw new Error('Payment is not verified as completed.');
  const u=units[0];const captures=u.payments?.captures;
  if(u.custom_id!==s.id || u.reference_id!=='syw-demo' || u.amount?.value!==DEMO_AMOUNT || u.amount?.currency_code!=='USD' || !Array.isArray(captures) || captures.length!==1 || captures[0].status!=='COMPLETED' || captures[0].amount?.value!==DEMO_AMOUNT || captures[0].amount?.currency_code!=='USD' || !captures[0].id)throw new Error('Payment evidence does not match this demonstration cart. Contact the demo operator before retrying.');
  return {orderId:b.id,captureId:captures[0].id,status:'COMPLETED',amount:DEMO_AMOUNT,currency:'USD'};
}
export async function captureOrder(s:Session,orderId:string,call:PayPalFetch=sandboxApi,checkpoint:()=>Promise<void>=async()=>{}) {
  if(s.receipt){if(s.receipt.orderId!==orderId)throw new Error('Order mismatch.');return s.receipt;}
  assertCheckout(s);
  if(!/^[A-Za-z0-9-]{5,64}$/.test(orderId) || s.checkout?.orderId!==orderId || s.checkout.revision!==s.revision)throw new Error('This order does not belong to your current confirmed cart.');
  // GET first recovers a completed capture when its HTTP response was lost.
  let b=await call('/v2/checkout/orders/'+orderId);
  if(b.status!=='COMPLETED'){
    if(b.status!=='APPROVED')throw new Error('PayPal buyer approval is required before capture. No capture was sent.');
    assertBuyerMerchantDistinct(b);
    s.checkout.captureAttempted=true;
    await checkpoint();
    let captured;
    try{captured=await call('/v2/checkout/orders/'+orderId+'/capture',{},'capture-'+s.checkout.requestId);}
    catch(e){
      if(e instanceof PayPalApiError && ['INSTRUMENT_DECLINED','ORDER_NOT_APPROVED','PAYER_ACTION_REQUIRED','TRANSACTION_REFUSED','PAYMENT_DENIED'].includes(e.issue || '')){s.checkout.captureAttempted=false;await checkpoint();}
      throw e;
    }
    if(captured.status!=='COMPLETED')throw new Error('PayPal has not reported a completed capture. No success is assumed.');
    // Capture representations can omit original order fields. Read the canonical
    // order before validating its amount, custom_id and completed capture together.
    b=await call('/v2/checkout/orders/'+orderId);
  }
  s.receipt=verifyPayment(b,s);return s.receipt;
}
