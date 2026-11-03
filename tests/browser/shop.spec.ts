import {test,expect} from '@playwright/test';
test('real app: sample selection, correction, hybrid route, pause and reload persist; missing keys are honest',async({page})=>{
  await page.goto('/');await expect(page.getByRole('heading',{name:'Your shopping companion'})).toBeVisible();
  await page.getByRole('button',{name:'Open fictional sample products'}).click();
  await expect(page.getByText('Fictional sample products. No external catalog call or merchant purchase.')).toBeVisible();
  await page.getByRole('button',{name:'Choose for demo'}).first().click();
  await expect(page.getByRole('heading',{name:'Demonstration cart'})).toBeVisible();
  await page.getByLabel('Variant / size to check').fill('EU 41 wide — preference only');await page.getByRole('button',{name:'Save correction'}).click();
  await page.getByLabel('Your shopping route').selectOption('hybrid');
  await expect(page.getByText('We haven’t checked or reserved anything.',{exact:false})).toBeVisible();
  // Confirmation is persisted on the server; await the response rather than native checkbox timing.
  const confirmation=page.waitForResponse(r=>r.url().endsWith('/api/shop') && r.request().postDataJSON()?.action==='confirm');
  await page.getByRole('checkbox').click();await confirmation;await expect(page.getByRole('checkbox')).toBeChecked();
  await page.getByLabel('Variant / size to check').fill('EU 42 — correction');await page.getByRole('button',{name:'Save correction'}).click();await expect(page.getByRole('checkbox')).not.toBeChecked();
  await page.reload();await expect(page.getByLabel('Variant / size to check')).toHaveValue('EU 42 — correction');await expect(page.getByLabel('Your shopping route')).toHaveValue('hybrid');
  await page.getByRole('button',{name:'Stop without buying'}).click();await expect(page.getByRole('button',{name:'Resume when ready'})).toBeVisible();await expect(page.getByRole('button',{name:'Choose for demo'}).first()).toBeDisabled();
  await page.getByRole('button',{name:'Resume when ready'}).click();await expect(page.getByRole('button',{name:'Choose for demo'}).first()).toBeEnabled();
  await page.screenshot({path:'test-results/shop-desktop.png',fullPage:true});
});
test('mobile app fits viewport and is usable',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.getByLabel('Tell your shopping companion')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();await page.screenshot({path:'test-results/shop-mobile.png',fullPage:true});
});
test('server rejects cross-origin mutations and client-supplied checkout prices',async({request})=>{
  const denied=await request.post('/api/shop',{headers:{origin:'https://other.example'},data:{action:'create',amount:'.01'}});expect(denied.status()).toBe(403);
  const noCart=await request.post('/api/shop',{headers:{origin:'http://127.0.0.1:3000'},data:{action:'create',revision:0,amount:'.01'}});expect(noCart.status()).toBe(400);expect((await noCart.json()).error).toMatch(/confirm/i);
});
test('stale tab cannot confirm a different cart revision',async({request})=>{
  const post=(data:unknown)=>request.post('/api/shop',{headers:{origin:'http://127.0.0.1:3000'},data});
  const sample=await (await post({action:'samples'})).json();
  const chosen=await (await post({action:'select',id:sample.session.products[0].id})).json();
  const old=await post({action:'confirm',revision:chosen.session.revision-1});expect(old.status()).toBe(400);expect((await old.json()).error).toMatch(/another tab/);
  const current=await post({action:'confirm',revision:chosen.session.revision});expect(current.status()).toBe(200);expect((await current.json()).session.confirmed).toBe(true);
});
