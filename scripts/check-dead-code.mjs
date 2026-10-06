// scripts/check-dead-code.mjs
// Reports modules under src/ that nothing can reach.
//
// Reachability starts from the App Router conventions (pages, layouts, route
// handlers, error and loading boundaries), the middleware, the instrumentation
// hook, and anything the scripts or tests import. Every other module is listed.
//
// This check is a report, not a gate, for one honest reason: an unreachable
// module is not automatically wrong. Some are provider adapters built ahead of
// the phase that wires them. What is wrong is losing track of which is which,
// which is exactly how this repository ended up with a second inert copy of
// its sign in form, its dashboard and its application shell.
//
// Pass --strict to fail when the count rises above the recorded baseline.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, normalize, relative } from 'node:path';

const root = process.cwd();
const IMPORT = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/gu;
const ROUTE_BASENAMES = new Set([
  'page',
  'layout',
  'error',
  'loading',
  'not-found',
  'route',
  'template',
  'global-error',
  'default',
  'sitemap',
  'robots',
  'manifest',
  'opengraph-image',
  'twitter-image',
  'icon',
  'apple-icon',
]);

// Modules that are reachable only through a framework or tooling convention.
const EXTRA_ENTRY_POINTS = ['src/middleware.ts', 'src/instrumentation.ts'];

// Highest number of unreachable modules this repository accepts. Lower it
// whenever a batch is wired up or removed; never raise it without a reason.
const BASELINE = 110;

/**
 * Lists every file under a directory tree that matches an extension.
 *
 * @param directory Directory to walk.
 * @param extensions Accepted file extensions.
 * @returns Repository relative paths.
 */
function walk(directory, extensions) {
  const results = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      results.push(...walk(path, extensions));
    } else if (extensions.some((extension) => entry.endsWith(extension))) {
      results.push(relative(root, path));
    }
  }
  return results;
}

const sourceFiles = walk(join(root, 'src'), ['.ts', '.tsx']);
const sources = new Map(sourceFiles.map((path) => [path, readFileSync(join(root, path), 'utf8')]));

/**
 * Resolves one import specifier to a file in the source map.
 *
 * @param specifier The literal written in the import.
 * @param from File the import appears in.
 * @returns The resolved path, or null for a package import.
 */
function resolve(specifier, from) {
  let base;
  if (specifier.startsWith('@/')) base = `src/${specifier.slice(2)}`;
  else if (specifier.startsWith('.')) base = normalize(join(dirname(from), specifier));
  else return null;

  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
    base,
  ]) {
    if (sources.has(candidate)) return candidate;
  }
  return null;
}

const graph = new Map();
for (const [path, code] of sources) {
  const edges = new Set();
  for (const match of code.matchAll(IMPORT)) {
    const target = resolve(match[1], path);
    if (target !== null) edges.add(target);
  }
  graph.set(path, edges);
}

const entryPoints = new Set(EXTRA_ENTRY_POINTS.filter((path) => sources.has(path)));
for (const path of sources.keys()) {
  if (!path.startsWith('src/app/')) continue;
  const basename = path.split('/').pop() ?? '';
  if (ROUTE_BASENAMES.has(basename.replace(/\.(ts|tsx)$/u, ''))) entryPoints.add(path);
}

for (const directory of ['scripts', 'tests']) {
  for (const path of walk(join(root, directory), ['.ts', '.tsx', '.mjs'])) {
    for (const match of readFileSync(join(root, path), 'utf8').matchAll(IMPORT)) {
      const target = resolve(match[1], `${directory}/placeholder.ts`);
      if (target !== null) entryPoints.add(target);
    }
  }
}

const reachable = new Set();
const stack = [...entryPoints];
while (stack.length > 0) {
  const current = stack.pop();
  if (current === undefined || reachable.has(current) || !sources.has(current)) continue;
  reachable.add(current);
  for (const edge of graph.get(current) ?? []) stack.push(edge);
}

const unreachable = [...sources.keys()].filter((path) => !reachable.has(path)).sort();

const byArea = new Map();
for (const path of unreachable) {
  const area = path.split('/').slice(0, 3).join('/');
  byArea.set(area, (byArea.get(area) ?? 0) + 1);
}

console.log(
  `Dead code report: ${sources.size} module(s), ${reachable.size} reachable, ` +
    `${unreachable.length} unreachable (baseline ${BASELINE}).`
);
for (const [area, count] of [...byArea.entries()].sort((left, right) => right[1] - left[1])) {
  console.log(`  ${String(count).padStart(3, ' ')}  ${area}`);
}

if (process.argv.includes('--strict') && unreachable.length > BASELINE) {
  console.error(
    `\nUnreachable modules rose from the ${BASELINE} baseline to ${unreachable.length}.`
  );
  for (const path of unreachable) console.error(`  - ${path}`);
  process.exit(1);
}
