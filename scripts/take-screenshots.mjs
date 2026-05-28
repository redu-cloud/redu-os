import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const COOKIE_FILE = new URL('../.local/dashboard-test.cookies', import.meta.url).pathname;
const OUT_DIR = new URL('../docs/images/', import.meta.url).pathname;

const line = readFileSync(COOKIE_FILE, 'utf8')
  .split('\n')
  .find(l => l.includes('redu_os_dashboard_session'));
const [, , , , expires, name, value] = line.trim().split('\t');

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ||
    `${process.env.HOME}/.cache/ms-playwright/chromium-1224/chrome-linux64/chrome`,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'dark',
});

await context.addCookies([{
  name,
  value,
  domain: '127.0.0.1',
  path: '/',
  expires: Number(expires),
  httpOnly: true,
  secure: false,
  sameSite: 'Lax',
}]);

const page = await context.newPage();

// Disable external font requests that can block screenshot
await page.route('**/*.woff*', r => r.abort());
await page.route('**/fonts.googleapis.com/**', r => r.abort());
await page.route('**/fonts.gstatic.com/**', r => r.abort());

// ── Log in ────────────────────────────────────────────────────────────────────
console.log('Logging in...');
await page.goto('http://127.0.0.1:3006/login', { waitUntil: 'domcontentloaded' });
await page.fill('input[name="email"]', 'admin@example.com');
await page.fill('input[name="password"]', 'ChangeMeStrong123!');
await page.locator('#submit').dispatchEvent('click');
await page.waitForURL('http://127.0.0.1:3006/', { timeout: 10000 });
await page.waitForTimeout(2000);
console.log('✓ logged in');

// ── Dismiss onboarding panel if present ──────────────────────────────────────
const skipBtn = page.locator('text=Skip for now');
if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  await skipBtn.click();
  await page.waitForTimeout(500);
  console.log('✓ dismissed onboarding');
}

// ── Overview screenshot ───────────────────────────────────────────────────────
console.log('Taking overview screenshot...');
await page.goto('http://127.0.0.1:3006/#overview', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
// Dismiss onboarding again if it reappears
const skipBtn2 = page.locator('text=Skip for now');
if (await skipBtn2.isVisible({ timeout: 1000 }).catch(() => false)) {
  await skipBtn2.click();
  await page.waitForTimeout(500);
}
await page.screenshot({ path: `${OUT_DIR}overview.png`, animations: 'disabled' });
console.log('✓ overview.png');

// ── Integrations screenshot ───────────────────────────────────────────────────
console.log('Taking integrations screenshot...');
await page.goto('http://127.0.0.1:3006/#integrations', { waitUntil: 'domcontentloaded' });
// Wait for actual content to render (not just "Loading...")
await page.waitForFunction(
  () => !document.body.innerText.includes('Loading...'),
  { timeout: 10000 }
).catch(() => {});
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT_DIR}integrations.png`, animations: 'disabled' });
console.log('✓ integrations.png');

await browser.close();
console.log('Done.');
