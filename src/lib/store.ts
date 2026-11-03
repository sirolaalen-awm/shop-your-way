import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {newSession,type Session} from './domain';
const root=path.resolve(/* turbopackIgnore: true */ process.env.DATA_DIR || '.data');
const globalStore=globalThis as unknown as {sywLocks?:Map<string,Promise<unknown>>};
const locks=globalStore.sywLocks ??=new Map();
export async function transaction<T>(id:string,fn:(s:Session,checkpoint:()=>Promise<void>)=>Promise<T>):Promise<T> {
  if(!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid session.');
  const prior=locks.get(id) || Promise.resolve();
  const next=prior.catch(()=>{}).then(async()=>{
    await mkdir(root,{recursive:true}); const file=path.join(root,id+'.json');let s:Session;
    try{s=JSON.parse(await readFile(file,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;s=newSession(id);}
    if(Date.now()-s.updatedAt>24*60*60*1000) s=newSession(id);
    const checkpoint=async()=>{s.updatedAt=Date.now();const tmp=file+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(s),{mode:0o600});await rename(tmp,file);};
    const result=await fn(s,checkpoint);await checkpoint();
    return result;
  });
  locks.set(id,next);
  try{return await next;}finally{if(locks.get(id)===next)locks.delete(id);}
}
