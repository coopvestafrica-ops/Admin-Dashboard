import { chromium } from 'playwright';

async function testApp() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  page.on('pageerror', error => {
    errors.push('PAGE ERROR: ' + error.message);
  });
  
  try {
    console.log('Navigating to app...');
    await page.goto('https://admin-dashboard-api-server.vercel.app/', { timeout: 60000, waitUntil: 'networkidle' });
    console.log('Page loaded');
    
    await page.waitForTimeout(5000);
    
    const title = await page.title();
    console.log('Page title:', title);
    
    const bodyText = await page.textContent('body');
    console.log('Body text length:', bodyText?.length || 0);
    
    const rootContent = await page.$eval('#root', el => el.innerHTML);
    console.log('Root content length:', rootContent.length);
    console.log('Root content preview:', rootContent.substring(0, 300));
    
    const inputs = await page.$$('input');
    console.log('Inputs found:', inputs.length);
    
    const buttons = await page.$$('button');
    console.log('Buttons found:', buttons.length);
    
    if (errors.length > 0) {
      console.log('\n--- Console Errors ---');
      errors.forEach(e => console.log(e));
    } else {
      console.log('\n✅ No console errors detected!');
    }
    
    await page.screenshot({ path: '/workspace/project/40bea8d011164b5a93b25546df6c6e2e/Admin-Dashboard/screenshot.png', fullPage: false });
    console.log('\nScreenshot saved');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testApp();
