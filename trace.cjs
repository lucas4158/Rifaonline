const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER:', msg.text()));

  await page.goto('http://localhost:3000');
  
  // Set localStorage token
  await page.evaluate(() => {
    localStorage.setItem('raffle_admin_token', 'SES_76d3ae7fb8c2602dc3052a926d00c70ed76c707b52ea59b7ecf289fae7a09fff');
  });

  await page.goto('http://localhost:3000');
  
  // Wait for 10 seconds to collect logs
  await new Promise(r => setTimeout(r, 10000));
  
  await browser.close();
})();
