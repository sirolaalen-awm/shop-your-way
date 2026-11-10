import test from 'node:test';
import assert from 'node:assert/strict';
import {newSession,changeSelection,assertNoUnresolvedCapture} from '../src/lib/domain';
import {samples} from '../src/lib/catalog';
import {captureOrder,PayPalApiError,type PayPalFetch} from '../src/lib/paypal';
import {transaction} from '../src/lib/store';
import {randomUUID} from 'node:crypto';
function ready(){const s=newSession(randomUUID());s.products=samples('shoes');changeSelection(s,s.products[0].id);s.confirmed=s.revision;s.checkout={revision:s.revision,requestId:randomUUID(),orderId:'ORDER-123'};return s;}
function completed(s:ReturnType<typeof ready>){return {id:s.checkout!.orderId,status:'COMPLETED',purchase_units:[{reference_id:'syw-demo',custom_id:s.id,amount:{value:'1.00',currency_code:'USD'},payments:{captures:[{id:'CAPTURE-123',status:'COMPLETED',amount:{value:'1.00',currency_code:'USD'}}]}}]};}
test('unapproved real-order state never sends capture',async()=>{const s=ready();let posts=0;const call:PayPalFetch=async(_p,b)=>{if(b)posts++;return {status:'PAYER_ACTION_REQUIRED'};};await assert.rejects(captureOrder(s,'ORDER-123',call),/buyer approval/);assert.equal(posts,0);assert.equal(s.receipt,undefined);});
test('lost capture response preserves the attempted order and blocks cart changes until recovery',async()=>{
  const s=ready();let posts=0;let remoteCompleted=false;let checkpointed=false;
  const call:PayPalFetch=async(p)=>{if(p.endsWith('/capture')){assert.equal(checkpointed,true);posts++;remoteCompleted=true;throw new Error('response lost');}return remoteCompleted?completed(s):{status:'APPROVED',payer:{payer_id:'TEST-BUYER'},purchase_units:[{payee:{merchant_id:'TEST-MERCHANT'}}]};};
  await assert.rejects(captureOrder(s,'ORDER-123',call,async()=>{checkpointed=true;}));
  assert.equal(s.checkout!.captureAttempted,true);assert.throws(()=>changeSelection(s,s.products[1].id),/needs verification/);assert.throws(()=>assertNoUnresolvedCapture(s));
  const r=await captureOrder(s,'ORDER-123',call);assert.equal(r.status,'COMPLETED');assert.equal(posts,1);assert.doesNotThrow(()=>assertNoUnresolvedCapture(s));
});
test('explicit instrument decline is not PASS and permits correction while retaining same order',async()=>{
  const s=ready();const call:PayPalFetch=async p=>{if(p.endsWith('/capture'))throw new PayPalApiError(422,'INSTRUMENT_DECLINED');return {status:'APPROVED',payer:{payer_id:'TEST-BUYER'},purchase_units:[{payee:{merchant_id:'TEST-MERCHANT'}}]};};await assert.rejects(captureOrder(s,'ORDER-123',call),/INSTRUMENT_DECLINED/);assert.equal(s.receipt,undefined);assert.equal(s.checkout!.captureAttempted,false);assert.equal(s.checkout!.orderId,'ORDER-123');
});
test('two concurrent session capture requests cause one remote capture and return the same receipt',async()=>{
  const seed=ready();await transaction(seed.id,async s=>Object.assign(s,seed));let posts=0;
  const call:PayPalFetch=async p=>{if(p.endsWith('/capture')){posts++;return {status:'COMPLETED'};}return posts?completed(seed):{status:'APPROVED',payer:{payer_id:'TEST-BUYER'},purchase_units:[{payee:{merchant_id:'TEST-MERCHANT'}}]};};
  const a=()=>transaction(seed.id,async(s,checkpoint)=>captureOrder(s,'ORDER-123',call,checkpoint));const [r1,r2]=await Promise.all([a(),a()]);assert.deepEqual(r1,r2);assert.equal(posts,1);
});
