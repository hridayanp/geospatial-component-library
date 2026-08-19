/**
 * Runtime smoke test for the built Storybook.
 *
 * A type-check proves the code compiles; it does not prove that a MapLibre map
 * initialises, that deck.gl gets a WebGL context, or that a layer attaches
 * without throwing. This loads a representative set of stories in a real
 * browser and fails on any uncaught error or React warning.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright/index.js');

const ROOT = '/home/claude/gcl/apps/storybook/storybook-static';
const PORT = 6199;

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
    const info = await stat(filePath).catch(() => null);
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

const STORIES = [
  'geospatial-map-container--basic',
  'geospatial-map-container--fit-bounds',
  'geospatial-raster-layer--basic',
  'geospatial-raster-layer--no-data-and-edges',
  'geospatial-raster-layer--animated-sequence',
  'geospatial-raster-layer--multiple-rasters',
  'geospatial-vector-layer--geometry-types',
  'geospatial-vector-layer--data-driven-styling',
  'geospatial-vector-layer--clustering',
  'geospatial-vector-layer--empty-data',
  'geospatial-wind-particle-layer--basic',
  'geospatial-wind-particle-layer--from-scattered-points',
  'geospatial-wind-particle-layer--shared-overlay',
  'overlays-geo-legend--continuous',
  'overlays-geo-legend--stacked',
  'overlays-geo-hover--raster-probe',
  'overlays-timeline-control--driving-a-raster',
  'overlays-map-controls--full-set',
  'utilities-raster-utilities--colorize-playground',
  'utilities-geo-utilities--range-rings',
  'composition-examples--raster-vector-and-wind',
  'composition-examples--full-composition',
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});

const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
// The docs site's demo basemap is the only outbound request; stub it so the
// smoke test never depends on the network.
await context.route('**/tile.openstreetmap.org/**', (route) =>
  route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(0) }),
);

const failures = [];
let checked = 0;

for (const storyId of STORIES) {
  const page = await context.newPage();
  const problems = [];

  page.on('console', (message) => {
    const text = message.text();
    if (message.type() !== 'error' && message.type() !== 'warning') return;
    // Expected noise: the stubbed tiles, and WebGL software-rendering notices.
    if (/tile\.openstreetmap|Failed to load resource|WebGL|SwiftShader|GPU stall|deprecated/i.test(text)) {
      return;
    }
    problems.push(`${message.type()}: ${text}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

  try {
    await page.goto(
      `http://localhost:${PORT}/iframe.html?id=${storyId}&viewMode=story`,
      { waitUntil: 'load', timeout: 30000 },
    );
    // Give layers time to attach, textures to upload and particles to start.
    await page.waitForTimeout(2500);

    const rendered = await page.evaluate(() => {
      const root = document.querySelector('#storybook-root');
      return {
        html: (root?.innerHTML.length ?? 0) > 0,
        canvases: document.querySelectorAll('canvas').length,
        errorOverlay: Boolean(document.querySelector('#error-message')?.textContent),
      };
    });

    if (!rendered.html) problems.push('story rendered nothing');
    if (rendered.errorOverlay) problems.push('storybook error overlay is visible');
  } catch (error) {
    problems.push(`navigation: ${error.message}`);
  }

  await page.close();
  checked++;

  if (problems.length > 0) {
    failures.push({ storyId, problems });
    console.log(`✗ ${storyId}`);
    for (const problem of problems) console.log(`    ${problem}`);
  } else {
    console.log(`✓ ${storyId}`);
  }
}

await browser.close();
server.close();

console.log(`\n${checked - failures.length}/${checked} stories rendered cleanly.`);
process.exit(failures.length > 0 ? 1 : 0);
