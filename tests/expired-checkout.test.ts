import test from 'node:test';
import assert from 'node:assert/strict';
import {newSession,changeSelection} from '../src/lib/domain';
import {samples} from '../src/lib/catalog';
import {replaceExpiredOrder,PayPalApiError,captureOrder,approvalUrlFromResponse,type PayPalFetch} from '../src/lib/paypal';
const ready=()=>{const s=newSession('12345678-1234-1234-1234-123456789abc');s.products=samples('shoes');changeSelection(s,s.products[0].id);s.confirmed=s.revision;s.checkout={revision:s.revision,requestId:'old-key',orderId:'ORDER-OLD'};return s;};
test('replace only a confirmed 404 order; new order includes actual return/cancel URLs',async()=>{
  const s=ready();let posts=0;const call:PayPalFetch=async(p,body,key)=>{if(p.includes('ORDER-OLD'))throw new PayPalApiError(404);posts++;assert.equal((body as any).purchase_units[0].amount.value,'1.00');const ctx=(body as any).payment_source.paypal.experience_context;assert.equal(new URL(ctx.return_url).searchParams.get('paypal'),'return');assert.equal(new URL(ctx.cancel_url).searchParams.get('paypal'),'cancel');assert.notEqual(key,'create-old-key');return {id:'ORDER-NEW'};};
  assert.equal(await replaceExpiredOrder(s,call),'ORDER-NEW');assert.equal(posts,1);assert.equal(s.confirmed,s.revision);
});
test('available order and temporary HTTP failure do not create another order',async()=>{
  for(const exists of [true,false]){const s=ready();let posts=0;const call:PayPalFetch=async(_p,b)=>{if(b)posts++;if(!exists)throw new PayPalApiError(503);return {status:'PAYER_ACTION_REQUIRED'};};await assert.rejects(replaceExpiredOrder(s,call));assert.equal(posts,0);assert.equal(s.checkout!.orderId,'ORDER-OLD');}
});
test('same or unidentified buyer and merchant block capture before the POST',async()=>{
  for(const payer of [{payer_id:'SAME'},undefined]){const s=ready();let posts=0;const call:PayPalFetch=async(_p,b)=>{if(b)posts++;return {status:'APPROVED',payer,purchase_units:[{payee:{merchant_id:'SAME'}}]};};await assert.rejects(captureOrder(s,'ORDER-OLD',call),/identities|different accounts/);assert.equal(posts,0);}
});
test('approval URL is the unchanged API link and only a Sandbox HTTPS destination is accepted',()=>{
  const href='https://www.sandbox.paypal.com/checkoutnow?token=TEST-ORDER&x=1';assert.equal(approvalUrlFromResponse({links:[{rel:'payer-action',href}]}),href);assert.equal(approvalUrlFromResponse({links:[]}),undefined);
  for(const bad of ['https://www.paypal.com/checkoutnow','https://other.example/','http://www.sandbox.paypal.com/'])assert.throws(()=>approvalUrlFromResponse({links:[{rel:'approve',href:bad}]}));
});
