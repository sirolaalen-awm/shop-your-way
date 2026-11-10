import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {parseEnv} from 'node:util';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const endpoint='https://api-m.sandbox.paypal.com/v1/oauth2/token';
// Authentication only. No order, capture, refund, webhook or Live request exists here.
export async function probeSandbox(clientId,secret,fetcher=fetch) {
  const start=performance.now();
  const base={checkedAt:new Date().toISOString(),environment:'SANDBOX',operation:'OAuth client_credentials',endpoint,paymentOperations:0};
  const result=(status,reason,extra={})=>({...base,status,reason,elapsedMs:Math.round(performance.now()-start),...extra});
  if(!clientId || !secret)return result('UNKNOWN','MISSING_LOCAL_CREDENTIALS');
  try{
    const response=await fetcher(endpoint,{method:'POST',redirect:'error',headers:{Authorization:'Basic '+Buffer.from(clientId+':'+secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(25000)});
    // Never print or persist headers, raw response, credentials, app_id or token.
    if(!response.ok)return result(response.status===401?'FAIL':'UNKNOWN',response.status===401?'CREDENTIALS_REJECTED':'SANDBOX_HTTP_ERROR',{httpStatus:response.status});
    const body=await response.json();
    if(response.status!==200 || typeof body.access_token!=='string' || !body.access_token.length || String(body.token_type).toLowerCase()!=='bearer' || typeof body.expires_in!=='number' || body.expires_in<=0)return result('UNKNOWN','INVALID_TOKEN_RESPONSE',{httpStatus:response.status});
    return result('PASS','SANDBOX_AUTHENTICATION_CONFIRMED',{httpStatus:response.status,tokenObtained:true,expiresInSeconds:body.expires_in});
  }catch{return result('UNKNOWN','NETWORK_TIMEOUT_OR_UNREADABLE_RESPONSE');}
}

async function main(){
  let result;
  try{
    execFileSync('git',['-C',root,'check-ignore','-q','--','.env.local'],{stdio:'pipe',windowsHide:true});
    const tracked=execFileSync('git',['-C',root,'ls-files','--','.env.local'],{encoding:'utf8',stdio:'pipe',windowsHide:true});
    if(tracked.trim())throw new Error('unsafe');
    const config=parseEnv(await readFile(path.join(root,'.env.local'),'utf8'));
    result=await probeSandbox(config.PAYPAL_CLIENT_ID,config.PAYPAL_CLIENT_SECRET);
  }catch{result={status:'UNKNOWN',reason:'LOCAL_CONFIGURATION_UNAVAILABLE_OR_NOT_GIT_PROTECTED',paymentOperations:0,environment:'SANDBOX',checkedAt:new Date().toISOString()};}
  try{await mkdir(path.join(root,'.data'),{recursive:true});await writeFile(path.join(root,'.data','paypal-sandbox-probe.json'),JSON.stringify(result,null,2),{mode:0o600});}catch{result={status:'UNKNOWN',reason:'CANNOT_SAVE_REDACTED_RECEIPT',paymentOperations:0};}
  console.log(JSON.stringify(result));
  process.exitCode=result.status==='PASS'?0:1;
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main();
