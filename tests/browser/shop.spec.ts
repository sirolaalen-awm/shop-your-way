import {test,expect} from '@playwright/test';
test('real app: sample selection, correction, hybrid route, pause and reload persist; missing keys are honest',async({page})=>{
  await page.goto('/');await expect(page.getByRole('heading',{name:'Your shopping companion'})).toBeVisible();
  await page.getByText('Demo tools',{exact:true}).click();await page.getByRole('button',{name:'Open fictional sample products'}).click();
  await expect(page.getByText('Fictional sample products. No external catalog call or merchant purchase.')).toBeVisible();
  await page.getByRole('button',{name:'Choose for demo'}).first().click();
  await expect(page.getByRole('heading',{name:'Demonstration cart'})).toBeVisible();
  await page.getByLabel('Optional demo note').fill('EU 41 wide — preference only');await page.getByRole('button',{name:'Save correction'}).click();
  await page.getByText('Shopping details',{exact:true}).click();await page.getByLabel('Your shopping route').selectOption('hybrid');
  await expect(page.getByText('We haven’t checked or reserved anything.',{exact:false})).toBeVisible();
  // Confirmation is persisted on the server; await the response rather than native checkbox timing.
  const confirmation=page.waitForResponse(r=>r.url().endsWith('/api/shop') && r.request().postDataJSON()?.action==='confirm');
  await page.getByRole('checkbox').click();await confirmation;await expect(page.getByRole('checkbox')).toBeChecked();
  await page.getByLabel('Optional demo note').fill('EU 42 — correction');await page.getByRole('button',{name:'Save correction'}).click();await expect(page.getByRole('checkbox')).not.toBeChecked();
  await page.reload();await page.getByText('Shopping details',{exact:true}).click();await expect(page.getByLabel('Optional demo note')).toHaveValue('EU 42 — correction');await expect(page.getByLabel('Your shopping route')).toHaveValue('hybrid');
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
  const noCart=await request.post('/api/shop',{headers:{origin:'http://127.0.0.1:3100'},data:{action:'create',revision:0,amount:'.01'}});expect(noCart.status()).toBe(400);expect((await noCart.json()).error).toMatch(/confirm/i);
});
test('stale tab cannot confirm a different cart revision',async({request})=>{
  const post=(data:unknown)=>request.post('/api/shop',{headers:{origin:'http://127.0.0.1:3100'},data});
  const sample=await (await post({action:'samples'})).json();
  const chosen=await (await post({action:'select',id:sample.session.products[0].id})).json();
  const old=await post({action:'confirm',revision:chosen.session.revision-1});expect(old.status()).toBe(400);expect((await old.json()).error).toMatch(/another tab/);
  const current=await post({action:'confirm',revision:chosen.session.revision});expect(current.status()).toBe(200);expect((await current.json()).session.confirmed).toBe(true);
});
test('fixture SDK cancel and error callbacks preserve selection and do not send create or capture',async({page})=>{
  const financialActions:string[]=[];
  page.on('request',r=>{if(r.url().endsWith('/api/shop') && r.method()==='POST'){const a=r.postDataJSON()?.action;if(['create','capture'].includes(a))financialActions.push(a);}});
  await page.route('**/api/shop',async route=>{const response=await route.fetch();const body=await response.json();if(body.config){body.config.paypal=true;body.config.clientId='fixture-public-id';}await route.fulfill({response,json:body});});
  await page.addInitScript(()=>{(window as any).paypal={Buttons:(options:any)=>({render:async(node:HTMLElement)=>{node.replaceChildren();for(const [label,callback] of [['Fixture cancel',options.onCancel],['Fixture error',options.onError]]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>callback();node.appendChild(b);}},close:async()=>{}})};});
  await page.goto('/');await page.getByText('Demo tools',{exact:true}).click();await page.getByRole('button',{name:'Open fictional sample products'}).click();await page.getByRole('button',{name:'Choose for demo'}).first().click();
  await page.getByRole('checkbox').click();await expect(page.getByRole('button',{name:'Fixture cancel'})).toBeVisible();
  await page.getByRole('button',{name:'Fixture cancel'}).click();await expect(page.locator('.alert')).toContainText('Payment cancelled');
  await expect(page.getByRole('heading',{name:'Demonstration cart'})).toBeVisible();
  await page.getByRole('button',{name:'Fixture error'}).click();await expect(page.locator('.alert')).toContainText('PayPal could not finish');
  expect(financialActions).toEqual([]);
});
test('PayPal return is not a payment proof and a query token cannot choose the captured order',async({page})=>{
  const captures:string[]=[];
  await page.route('**/api/shop',async route=>{
    if(route.request().method()==='POST' && route.request().postDataJSON()?.action==='capture'){
      captures.push(route.request().postDataJSON().orderId);await route.fulfill({status:400,json:{error:'Fixture gate: no actual capture.'}});return;
    }
    const response=await route.fetch();const body=await response.json();if(body.session)body.session.awaitingApproval={orderId:'ORDER-OWNED'};await route.fulfill({response,json:body});
  });
  await page.goto('/?paypal=return&token=FOREIGN-ORDER');
  const complete=page.getByRole('button',{name:'Verify approval and complete $1 Sandbox demo'});await expect(complete).toBeVisible();expect(captures).toEqual([]);
  await complete.click();await expect(page.locator('.alert')).toContainText('Fixture gate');expect(captures).toEqual(['ORDER-OWNED']);
});

test('native typography and 200 percent equivalent reflow remain readable',async({page})=>{
  for(const width of [1280,640,390]){
    await page.setViewportSize({width,height:900});await page.goto('/');
    await expect(page.getByRole('heading',{name:'Your shopping companion'})).toBeVisible();
    const sizes=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,body:parseFloat(getComputedStyle(document.body).fontSize),input:parseFloat(getComputedStyle(document.querySelector('textarea')!).fontSize)}));
    expect(sizes.overflow).toBe(false);expect(sizes.body).toBeGreaterThanOrEqual(17);expect(sizes.input).toBeGreaterThanOrEqual(16);
    await page.screenshot({path:`test-results/readability-${width}.png`,fullPage:true});
  }
});
