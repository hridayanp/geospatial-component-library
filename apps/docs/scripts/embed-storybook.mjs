import { cp, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Copy the built Storybook into the docs site's output as `/storybook`.
 *
 * This is what makes a single deployable artifact: the docs SPA at the root,
 * Storybook underneath it, one origin, no proxy and no CORS. In development
 * the two run as separate servers and the docs site links across to :6006
 * instead — see `storybookBase()` in src/site.ts.
 *
 * Turbo orders this correctly because the docs package declares
 * `@hridayanp/storybook` as a dependency, so `^build` builds Storybook first.
 */

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, '../../storybook/storybook-static');
const target = resolve(here, '../dist/storybook');

const exists = await stat(source).catch(() => null);
if (!exists) {
  console.error(
    `\n[docs] Cannot embed Storybook: ${source} does not exist.\n` +
      `       Run "npm run build --workspace @hridayanp/storybook" first, or\n` +
      `       use "npm run build" at the workspace root so Turbo orders it.\n`,
  );
  process.exit(1);
}

await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });

console.log(`[docs] Embedded Storybook at dist/storybook`);
