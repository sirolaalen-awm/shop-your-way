import {DEMO_AMOUNT,type Receipt,type Session,assertCheckout} from './domain';
import {randomUUID} from 'node:crypto';
// Deliberately no live-mode switch. This app cannot send a production payment.
const BASE='https://api-m.sandbox.paypal.com';
async function token() {
  const {PAYPAL_CLIENT_ID:id,PAYPAL_CLIENT_SECRET:secret}=process.env;
  if(!id || !secret)throw new Error('PayPal Sandbox is not configured. No payment was created.');
  const r=await fetch(BASE+'/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(id+':'+secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error(`PayPal Sandbox authentication failed (${r.status}).`);return (await r.json()).access_token as string;
}
export type PayPalFetch=(path:string,body?:unknown,requestId?:string)=>Promise<Record<string,any>>;
const api:PayPalFetch=async(path,body,requestId)=>{
  const bearer=await token();const r=await fetch(BASE+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json',...(requestId?{'PayPal-Request-Id':requestId}:{}),Prefer:'return=representation'},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
  if(!r.ok)throw new Error(`PayPal Sandbox request failed (${r.status}). Retry using the same cart; no success is assumed.`);
  return r.json();
};
export async function createOrder(s:Session,call:PayPalFetch=api,checkpoint:()=>Promise<void>=async()=>{}) {
  assertCheckout(s);
  s.checkout ??={revision:s.revision,requestId:randomUUID()};
  if(s.checkout.revision!==s.revision)throw new Error('Your cart changed. Confirm it again.');
  if(s.checkout.orderId)return s.checkout.orderId;
  // Persist the idempotency key BEFORE the external request, including lost responses.
  await checkpoint();
  const b=await call('/v2/checkout/orders',{intent:'CAPTURE',purchase_units:[{reference_id:'syw-demo',custom_id:s.id,description:'Shop Your Way — Sandbox demonstration only. No goods or fulfillment.',amount:{currency_code:'USD',value:DEMO_AMOUNT}}],payment_source:{paypal:{experience_context:{brand_name:'Shop Your Way · Sandbox',shipping_preference:'NO_SHIPPING',user_action:'PAY_NOW'}}}},'create-'+s.checkout.requestId);
  if(typeof b.id!=='string')throw new Error('PayPal did not return an order ID.');
  s.checkout.orderId=b.id;return b.id;
}
export function verifyPayment(b:Record<string,any>,s:Session):Receipt {
  const units=b.purchase_units;
  if(b.id!==s.checkout?.orderId || b.status!=='COMPLETED' || !Array.isArray(units) || units.length!==1)throw new Error('Payment is not verified as completed.');
  const u=units[0];const captures=u.payments?.captures;
  if(u.custom_id!==s.id || u.reference_id!=='syw-demo' || u.amount?.value!==DEMO_AMOUNT || u.amount?.currency_code!=='USD' || !Array.isArray(captures) || captures.length!==1 || captures[0].status!=='COMPLETED' || captures[0].amount?.value!==DEMO_AMOUNT || captures[0].amount?.currency_code!=='USD' || !captures[0].id)throw new Error('Payment evidence does not match this demonstration cart. Contact the demo operator before retrying.');
  return {orderId:b.id,captureId:captures[0].id,status:'COMPLETED',amount:DEMO_AMOUNT,currency:'USD'};
}
export async function captureOrder(s:Session,orderId:string,call:PayPalFetch=api) {
  if(s.receipt){if(s.receipt.orderId!==orderId)throw new Error('Order mismatch.');return s.receipt;}
  assertCheckout(s);
  if(!/^[A-Za-z0-9-]{5,64}$/.test(orderId) || s.checkout?.orderId!==orderId || s.checkout.revision!==s.revision)throw new Error('This order does not belong to your current confirmed cart.');
  // GET first recovers a completed capture when its HTTP response was lost.
  let b=await call('/v2/checkout/orders/'+orderId);
  if(b.status!=='COMPLETED'){
    const captured=await call('/v2/checkout/orders/'+orderId+'/capture',{},'capture-'+s.checkout.requestId);
    if(captured.status!=='COMPLETED')throw new Error('PayPal has not reported a completed capture. No success is assumed.');
    // Capture representations can omit original order fields. Read the canonical
    // order before validating its amount, custom_id and completed capture together.
    b=await call('/v2/checkout/orders/'+orderId);
  }
  s.receipt=verifyPayment(b,s);return s.receipt;
}
