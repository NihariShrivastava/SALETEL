const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.on('console', msg => {
    for (let i = 0; i < msg.args().length; ++i)
      console.log(`${i}: ${msg.args()[i]}`);
    console.log(`PAGE LOG: ${msg.text()}`);
  });
  
  page.on('requestfailed', request => {
    console.log(`REQUEST FAILED: ${request.url()} - ${request.failure()?.errorText}`);
  });
  
  page.on('response', response => {
    if (!response.ok()) {
      console.log(`RESPONSE ERROR: ${response.url()} - Status: ${response.status()}`);
    }
  });

  await page.goto('http://localhost:5173/login');
  
  await page.waitForSelector('input[type="text"]');
  await page.type('input[type="text"]', 'team1');
  await page.type('input[type="password"]', 'password123');
  
  const buttons = await page.$$('button');
  for (let btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Enter Workstation')) {
      await btn.click();
      break;
    }
  }

  console.log('Clicked login...');
  
  await new Promise(r => setTimeout(r, 10000));
  
  await browser.close();
})();
