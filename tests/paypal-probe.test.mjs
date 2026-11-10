import test from 'node:test';
import assert from 'node:assert/strict';
import {probeSandbox,endpoint} from '../scripts/paypal-sandbox-probe.mjs';
const id='fictional_client_canary';const secret='fictional_secret_canary';const token='fictional_token_canary';
test('authentication goes only to fixed Sandbox OAuth endpoint; receipt contains no credentials or token',async()=>{
  let calls=0;const receipt=await probeSandbox(id,secret,async(url,options)=>{calls++;assert.equal(url,endpoint);assert.equal(options.method,'POST');assert.equal(options.redirect,'error');assert.equal(options.body,'grant_type=client_credentials');return new Response(JSON.stringify({access_token:token,token_type:'Bearer',expires_in:3600}),{status:200});});
  assert.equal(calls,1);assert.equal(receipt.status,'PASS');assert.equal(receipt.paymentOperations,0);for(const value of [id,secret,token,Buffer.from(id+':'+secret).toString('base64')])assert.ok(!JSON.stringify(receipt).includes(value));
});
test('401 is FAIL and raw response is never included',async()=>{
  const r=await probeSandbox(id,secret,async()=>new Response(JSON.stringify({error:secret,access_token:token}),{status:401}));assert.equal(r.status,'FAIL');assert.equal(r.reason,'CREDENTIALS_REJECTED');assert.ok(!JSON.stringify(r).includes(secret));assert.ok(!JSON.stringify(r).includes(token));
});
test('missing credentials and network errors are UNKNOWN, not evidence of invalid credentials',async()=>{
  let n=0;assert.equal((await probeSandbox('',secret,async()=>{n++;})).status,'UNKNOWN');assert.equal(n,0);const r=await probeSandbox(id,secret,async()=>{throw new Error(secret);});assert.equal(r.status,'UNKNOWN');assert.ok(!JSON.stringify(r).includes(secret));
});
test('an HTTP 200 without a valid bearer token is not PASS',async()=>{
  assert.equal((await probeSandbox(id,secret,async()=>new Response('{}',{status:200}))).status,'UNKNOWN');
});
