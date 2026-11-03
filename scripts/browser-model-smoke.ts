// Opt-in: actual app + actual LOCAL model, no catalog/payment credentials.
import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1280,height:1000}});
try{
  await page.goto('http://127.0.0.1:3000');
  const config=await page.request.get('http://127.0.0.1:3000/api/shop').then(r=>r.json());
  if(config.config.aiProvider!=='Local Ollama' || config.config.catalog || config.config.paypal)throw new Error('This check is only for local AI with unconfigured external services.');
  await page.getByLabel('Tell your shopping companion').fill('I need comfortable walking shoes under $100. Keep it simple.');
  await page.getByRole('button',{name:'Send message'}).click();
  await expect(page.getByLabel('Tell your shopping companion')).toBeEnabled({timeout:180000});
  await page.getByLabel('Tell your shopping companion').fill('Actually I need to try them in person first, then buy online. Keep the budget.');
  await page.getByRole('button',{name:'Send message'}).click();
  await expect(page.getByLabel('Tell your shopping companion')).toBeEnabled({timeout:180000});
  await expect(page.getByLabel('Your shopping route')).toHaveValue('hybrid');
  const after=await page.request.get('http://127.0.0.1:3000/api/shop').then(r=>r.json());
  if(after.session.intent.budget!==100 || after.session.messages.filter((m:{role:string})=>m.role==='assistant').length!==2)throw new Error('Actual browser conversation failed to retain its budget/messages.');
  await mkdir('evidence',{recursive:true});await page.screenshot({path:'evidence/browser-model.png',fullPage:true});
  await writeFile('evidence/browser-model.json',JSON.stringify({kind:'Actual local app, actual local model. No external catalog or PayPal operation.',session:after.session},null,2));
  console.log('PASS: actual browser → app API → local AI → persisted intent → hybrid correction; budget $100 retained.');
}finally{await browser.close();}
