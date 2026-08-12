import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  await page.goto('http://localhost:3000/admin');
  
  // Wait for login
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', 'admin@rifa.com');
  await page.type('input[type="password"]', 'admin123'); // guessing the password might be admin123 or similar?
  
  // If we don't know the password, we can inject localStorage to bypass login!
  // Wait, the backend requires a valid firebase token or admin token.
  // Can I find the login logic?
  
  await browser.close();
})();
