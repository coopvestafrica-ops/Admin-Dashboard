import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Capture console messages
const consoleMessages = [];
page.on('console', msg => {
  consoleMessages.push({ type: msg.type(), text: msg.text() });
});

// Capture page errors
page.on('pageerror', error => {
  console.log('PAGE ERROR:', error.message);
  console.log('Stack:', error.stack);
});

// Capture network failures
page.on('requestfailed', request => {
  console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText);
});

const siteUrl = process.argv[2] || 'http://localhost:5173';
console.log('Navigating to the site:', siteUrl);
await page.goto(siteUrl, { waitUntil: 'networkidle', timeout: 60000 });

console.log('Page title:', await page.title());
console.log('URL:', page.url());

// Wait for React to mount
await page.waitForTimeout(5000);

// Check for login form
const emailInput = await page.$('input[type="email"], input[id="email"], input[placeholder*="email" i]');
const passwordInput = await page.$('input[type="password"]');
const signInButton = await page.$('button[type="submit"], button:has-text("Sign In")');

console.log('Email input found:', !!emailInput);
console.log('Password input found:', !!passwordInput);
console.log('Sign In button found:', !!signInButton);

if (emailInput && passwordInput && signInButton) {
  // Fill in credentials
  await emailInput.fill('ayanlowo89@gmail.com');
  console.log('Filled email');
  
  await passwordInput.fill('Temiloluwa@1963');
  console.log('Filled password');
  
  // Click sign in
  await signInButton.click();
  console.log('Clicked Sign In');
  
  // Wait for navigation
  await page.waitForTimeout(5000);
  
  console.log('After login URL:', page.url());
}

// Get visible text
const bodyText = await page.evaluate(() => document.body.innerText);
console.log('\n--- Page Content ---');
console.log(bodyText.substring(0, 3000));

// Print console messages
console.log('\n--- Console Messages ---');
consoleMessages.forEach(msg => {
  console.log(`[${msg.type}] ${msg.text}`);
});

// Take a screenshot
await page.screenshot({ path: '/tmp/site-screenshot.png', fullPage: true });
console.log('Screenshot saved to /tmp/site-screenshot.png');

await browser.close();
console.log('\nDone!');