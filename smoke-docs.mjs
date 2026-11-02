/**
 * Runtime smoke test for the built documentation site.
 *
 * Serves `apps/docs/dist` with SPA fallback, then visits the home page and
 * every registered doc route in a real browser. Fails on any uncaught error,
 * page error or React warning — and on a page whose article body came back
 * empty, which is how a missing content file shows up.
 *
 * Adjust PLAYWRIGHT and CHROME for your environment, or replace the require
 * with `import { chromium } from 'playwright'` after `npm i -D playwright`.
 */
import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PLAYWRIGHT = '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const { chromium } = require(PLAYWRIGHT);

const ROOT = new URL('./apps/docs/dist/', import.meta.url).pathname;
const CONTENT = new URL('./apps/docs/src/content/', import.meta.url).pathname;
const PORT = 6198;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://localhost:${PORT}`);
    let filePath = join(ROOT, normalize(url.pathname));
    let info = await stat(filePath).catch(() => null);

    // SPA fallback: unknown paths without an extension serve index.html.
    if (!info && !extname(url.pathname)) {
      filePath = join(ROOT, 'index.html');
      info = await stat(filePath).catch(() => null);
    }
    if (!info) {
      response.writeHead(404);
      response.end('not found');
      return;
    }
    if (info.isDirectory()) filePath = join(filePath, 'index.html');

    const body = await readFile(filePath);
    response.writeHead(200, {
      'content-type': MIME[extname(filePath)] ?? 'application/octet-stream',
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500);
    response.end(String(error));
  }
});

await new Promise((resolve) => server.listen(PORT, resolve));

const slugs = (await readdir(CONTENT))
  .filter((name) => name.endsWith('.md'))
  .map((name) => name.replace(/\.md$/, ''))
  .sort();

const routes = ['/', ...slugs.map((slug) => `/docs/${slug}`)];

const IGNORE = [
  /WebGL/i,
  /SwiftShader/i,
  /Failed to load resource/i,
  /favicon/i,
];

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

let failures = 0;

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

for (const route of routes) {
  process.stdout.write(`… ${route}\r`);
  const page = await context.newPage();
  const problems = [];

  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error' && message.type() !== 'warning') return;
    const text = message.text();
    if (IGNORE.some((pattern) => pattern.test(text))) return;
    problems.push(`console.${message.type()}: ${text}`);
  });

  try {
    // `domcontentloaded`, not `networkidle`: the home page runs a live map with
    // a permanent animation loop, so the network never truly goes idle.
    await page.goto(`http://localhost:${PORT}${route}`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });
    await page.waitForSelector('h1', { timeout: 15000 });
    await page.waitForTimeout(route === '/' ? 900 : 350);

    const heading = await page.locator('h1').first().innerText().catch(() => '');
    if (!heading.trim()) problems.push('no <h1> rendered');

    if (route !== '/') {
      const body = await page
        .locator('.docs-body')
        .first()
        .innerText()
        .catch(() => '');
      if (body.trim().length < 120) {
        problems.push(`article body is empty or near-empty (${body.trim().length} chars)`);
      }
    }
  } catch (error) {
    problems.push(`navigation: ${error.message}`);
  }

  await page.close();

  if (problems.length === 0) {
    console.log(`✓ ${route}`);
  } else {
    failures += 1;
    console.log(`✗ ${route}`);
    for (const problem of problems) console.log(`    ${problem}`);
  }
}

await context.close();
await browser.close();
server.close();

const total = routes.length;
console.log(`\n${total - failures}/${total} routes rendered clean`);
process.exit(failures === 0 ? 0 : 1);
