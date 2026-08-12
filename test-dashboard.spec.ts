import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test('click Abrir Painel da Rifa', async ({ page }) => {
  await page.goto('http://localhost:3000/admin');
  
  await page.evaluate(() => {
    localStorage.setItem('admin_token', 'dummy-token');
    localStorage.setItem('admin_user', JSON.stringify({ email: 'admin@rifamaster.com' }));
  });
  
  await page.route('**/api/admin/raffles*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: "Rifa-123",
        title: "Test Raffle",
        status: "ativa",
        price: 10,
        totalNumbers: 100,
        totalSoldNumbers: 50,
        isRaffleActive: true,
        created_at: new Date().toISOString()
      }])
    });
  });

  await page.goto('http://localhost:3000/dashboard');
  
  await page.waitForTimeout(2000);
  
  const html = await page.content();
  fs.writeFileSync('dashboard.html', html);
});
