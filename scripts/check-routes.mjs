// scripts/check-routes.mjs
// Quality gate: every internal link must lead somewhere real.
// Run with: npm run check:routes
//
// A dead link is the cheapest possible way to look unreliable, and the
// easiest thing in the world to introduce: a page is renamed, six links
// elsewhere still point at the old address, and nobody notices until a
// customer does. This walks the routes that actually exist, collects every
// internal address written anywhere in the source, and refuses the build if
// one of them leads nowhere.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const APP_DIRECTORY = join(ROOT, 'src', 'app');

const SCANNED_DIRECTORIES = ['src'];

const IGNORED_DIRECTORIES = new Set(['node_modules', '.next', '.git', 'out', 'build', 'dist']);

const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx']);

/**
 * Addresses that are served by something other than a file based route:
 * the authentication callbacks Supabase owns, and the well known files a
 * browser asks for without being linked to.
 */
const KNOWN_EXTERNAL_PATHS = new Set(['/auth/callback', '/auth/confirm', '/favicon.ico']);

/**
 * Lists every file under a directory.
 *
 * @param {string} directory Where to start.
 * @returns {string[]} Absolute paths of the files found.
 */
function listFiles(directory) {
  /** @type {string[]} */
  const found = [];

  for (const entry of readdirSync(directory)) {
    if (IGNORED_DIRECTORIES.has(entry)) {
      continue;
    }

    const full = join(directory, entry);

    if (statSync(full).isDirectory()) {
      found.push(...listFiles(full));

      continue;
    }

    found.push(full);
  }

  return found;
}

/**
 * Turns the folder structure of the application into the addresses it
 * actually serves.
 *
 * @returns {{ pattern: RegExp, source: string }[]} One matcher per route.
 */
function collectRoutes() {
  /** @type {{ pattern: RegExp, source: string }[]} */
  const routes = [];

  for (const file of listFiles(APP_DIRECTORY)) {
    const name = file.split('/').pop() ?? '';

    if (!['page.tsx', 'route.ts', 'route.tsx'].includes(name)) {
      continue;
    }

    const segments = relative(APP_DIRECTORY, file)
      .split('/')
      .slice(0, -1)
      // A folder in brackets groups files without appearing in the address.
      .filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')));

    // A catch-all folder answers any address, including the ones that
    // should have been a dead link. It is the page that renders "not
    // found", so counting it as a destination would make this check
    // meaningless.
    if (segments.some((segment) => segment.startsWith('[...') || segment.startsWith('[[...'))) {
      continue;
    }

    const expression = segments
      .map((segment) => {
        if (segment.startsWith('[')) {
          return '/[^/]+';
        }

        return `/${segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
      })
      .join('');

    routes.push({
      pattern: new RegExp(`^${expression === '' ? '/' : expression}$`),
      source: relative(ROOT, file),
    });
  }

  return routes;
}

/**
 * Reads the named addresses the application keeps in one place.
 *
 * Most links are written as a name rather than a literal, which is the
 * right way round; this resolves the names so those links are checked too.
 *
 * @returns {Map<string, string>} Each name, and the address it stands for.
 */
function collectNamedRoutes() {
  /** @type {Map<string, string>} */
  const named = new Map();
  const contents = readFileSync(join(ROOT, 'src', 'config', 'app.ts'), 'utf8');

  for (const match of contents.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*):\s*'(\/[^']*)',?$/gm)) {
    const name = match[1] ?? '';
    const address = match[2] ?? '';

    if (name !== '' && address !== '') {
      named.set(name, address);
    }
  }

  return named;
}

/**
 * Collects every internal address written in the source.
 *
 * Only addresses that are entirely literal are checked. One built from a
 * variable cannot be verified here and is left to the type system.
 *
 * @returns {Map<string, string[]>} Each address, and where it was written.
 */
function collectLinks() {
  /** @type {Map<string, string[]>} */
  const links = new Map();
  const namedRoutes = collectNamedRoutes();

  for (const directory of SCANNED_DIRECTORIES) {
    for (const file of listFiles(join(ROOT, directory))) {
      const extension = file.slice(file.lastIndexOf('.'));

      if (!SCANNED_EXTENSIONS.has(extension)) {
        continue;
      }

      const contents = readFileSync(file, 'utf8');
      const where = relative(ROOT, file);

      // A link written as a name, optionally with something appended:
      // href={ROUTES.settings} or `${ROUTES.settings}/storage`.
      for (const match of contents.matchAll(
        /ROUTES\.([a-zA-Z][a-zA-Z0-9]*)\}?(\/[A-Za-z0-9\-_/]*)?/g
      )) {
        const base = namedRoutes.get(match[1] ?? '');

        if (base === undefined) {
          continue;
        }

        const address = `${base}${match[2] ?? ''}`;
        const existing = links.get(address) ?? [];

        if (!existing.includes(where)) {
          existing.push(where);
        }

        links.set(address, existing);
      }

      const patterns = [
        /href=["'](\/[^"'\s{}]*)["']/g,
        /href=\{["'`](\/[^"'`\s${}]*)["'`]\}/g,
        /\bhref:\s*["'](\/[^"'\s]*)["']/g,
        /\bpath:\s*["'](\/[^"'\s]*)["']/g,
        /redirect\(["'](\/[^"'\s]*)["']\)/g,
        // A cache invalidation names a route too. One that names a route
        // that does not exist is worse than useless: the page it meant to
        // refresh quietly keeps showing yesterday's figures.
        /revalidatePath\(["'`](\/[^"'`\s${}]*)["'`]/g,
      ];

      for (const pattern of patterns) {
        for (const match of contents.matchAll(pattern)) {
          const address = (match[1] ?? '').split('?')[0]?.split('#')[0] ?? '';

          if (address === '' || address.startsWith('//')) {
            continue;
          }

          const existing = links.get(address) ?? [];

          if (!existing.includes(where)) {
            existing.push(where);
          }

          links.set(address, existing);
        }
      }
    }
  }

  return links;
}

const routes = collectRoutes();
const links = collectLinks();

/** @type {string[]} */
const problems = [];

for (const [address, sources] of links) {
  if (KNOWN_EXTERNAL_PATHS.has(address)) {
    continue;
  }

  // An address ending in a slash is one that had a value appended to it,
  // such as a document token. What has to exist is the route that takes
  // that value, so a stand-in segment is tested in its place.
  const isDynamic = address.endsWith('/') && address.length > 1;
  const normalised = isDynamic
    ? `${address.replace(/\/+$/, '')}/value`
    : address.length > 1
      ? address.replace(/\/+$/, '')
      : address;

  const isServed = routes.some((route) => route.pattern.test(normalised));

  if (!isServed) {
    problems.push(`${address} (written in ${sources.join(', ')})`);
  }
}

if (problems.length > 0) {
  console.error('These links do not lead anywhere:');

  for (const problem of problems) {
    console.error(`  ${problem}`);
  }

  console.error(
    `\n${problems.length} dead link(s) found across ${String(routes.length)} routes. Either build the page or fix the link.`
  );

  process.exit(1);
}

console.log(
  `Route check passed. ${String(links.size)} internal link(s) all lead to one of ${String(routes.length)} routes.`
);
