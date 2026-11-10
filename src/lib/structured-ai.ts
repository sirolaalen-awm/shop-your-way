import {z} from 'zod';
export async function structuredAI<T extends z.ZodTypeAny>(schema:T,messages:{role:string;content:string}[],name:string,tokens=900):Promise<z.infer<T>>{
 let output:string;
 if(process.env.AI_PROVIDER==='openai'){
  if(!process.env.OPENAI_API_KEY||!process.env.AI_MODEL)throw new Error('Configure the AI before shopping.');
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.AI_MODEL,input:messages,tools:[{type:'function',name,description:'Return the requested structured fields.',parameters:z.toJSONSchema(schema),strict:false}],tool_choice:{type:'function',name},max_output_tokens:tokens*2,store:false}),signal:AbortSignal.timeout(90000)});
  if(!r.ok)throw new Error('AI request failed ('+r.status+').');
  const b=await r.json();const call=b.output?.find((x:{type:string;name:string})=>x.type==='function_call'&&x.name===name);
  if(!call)throw new Error('No valid structured response returned.');output=call.arguments;
 }else{
  const r=await fetch((process.env.OLLAMA_BASE_URL||'http://127.0.0.1:11434')+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:process.env.AI_MODEL||'qwen3:4b-instruct-2507-q4_K_M',messages,format:z.toJSONSchema(schema),stream:false,think:false,options:{temperature:0,num_ctx:8192,num_predict:tokens}}),signal:AbortSignal.timeout(90000)});
  if(!r.ok)throw new Error('Local AI update failed ('+r.status+').');
  const b=await r.json();if(b.done_reason==='length')throw new Error('The request update was incomplete; please retry.');output=b.message?.content||'';
 }
 return schema.parse(JSON.parse(output));
}
