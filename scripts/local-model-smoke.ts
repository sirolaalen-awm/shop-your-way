// Explicit opt-in real local-model smoke test. No hosted AI or paid APIs.
import {mkdir,writeFile} from 'node:fs/promises';
import {newSession} from '../src/lib/domain';
import {converse} from '../src/lib/ai';
import {searchCatalog} from '../src/lib/catalog';
import assert from 'node:assert/strict';
if(process.env.AI_PROVIDER==='openai')throw new Error('This check allows only local Ollama.');
if(process.env.CHANNEL3_API_KEY)throw new Error('This local check is only for the unconfigured catalog boundary.');
const rows=[];
for(const [name,turns] of [
  ['shoes',['I need comfortable walking shoes for daily commuting, under $100. Keep it simple.','Actually I need to try them in person first, then buy online. Keep the budget.']],
  ['tv',['I am exploring a TV for a small room under $600. Help me compare picture quality, I am not in a hurry.']],
] as const){
  const s=newSession(crypto.randomUUID());
  for(const text of turns){const begin=performance.now();let searches=0;
    const result=await converse(s,text,undefined,async(q,intent)=>{searches++;return searchCatalog(q,intent);});
    const row={scenario:name,input:text,elapsedMs:performance.now()-begin,searches,originalIntent:s.originalIntent,intent:s.intent,reply:s.messages.at(-1)?.content,notice:result.notice};rows.push(row);console.log(JSON.stringify(row));
  }
}
const checks={shoeBudget:rows[0].intent.budget===100,budgetRetained:rows[1].intent.budget===100,originalRetained:rows[1].originalIntent===rows[0].originalIntent,hybrid:rows[1].intent.journey==='hybrid',verificationIncreased:rows[1].intent.assistance.verify>rows[0].intent.assistance.verify,explorationDifferent:rows[2].intent.assistance.explore>rows[0].intent.assistance.explore,requirementsRetained:JSON.stringify(rows[1].intent.requirements)===JSON.stringify(rows[0].intent.requirements)};
await mkdir('evidence',{recursive:true});await writeFile('evidence/local-model-smoke.json',JSON.stringify({kind:'Real local model; unconfigured catalog adapter. Not a live Channel3 or PayPal test.',provider:'Ollama',model:process.env.AI_MODEL || 'qwen3:4b',checks,rows},null,2));
assert.ok(Object.values(checks).every(Boolean),JSON.stringify(checks));
