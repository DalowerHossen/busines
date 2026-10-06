// scripts/check-navigation.mjs
// Structural checks over navigation and routing.
//
// The repository previously shipped a central navigation map whose links
// pointed at a flat `/clients`, `/invoices`, `/settings` layout that no
// longer existed. Because a catch-all marketing route answers any unmatched
// path, 16 of the 35 sidebar links silently rendered the wrong page instead
// of failing. Nothing in the build noticed.
//
// Rule 1  Every `href` in a navigation config resolves to a real route.
// Rule 2  Every `ROUTES` entry resolves to a real route.
// Rule 3  No two navigation entries reuse the same `key`.
//
// Catch-all segments are excluded when matching, so a `[...slug]` page can
// never mask a broken link.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const appDirectory = join(root, 'src/app');
const configDirectory = join(root, 'src/config');

const ROUTE_FILES = new Set(['page.tsx', 'page.ts', 'route.ts', 'route.tsx']);
const GROUP_SEGMENT = /\/\([^)]*\)/gu;
const DYNAMIC_SEGMENT = /\[[^\]]*\]/u;
const CATCH_ALL_SEGMENT = /\[\.{3}/u;
const HREF_LITERAL = /href:\s*'([^']+)'/gu;
const HREF_TEMPLATE = /href:\s*`\$\{ROUTES\.([A-Za-z0-9_]+)\}([^`]*)`/gu;
const NAV_KEY = /key:\s*'([^']+)'/gu;
const ROUTE_ENTRY = /^\s{2}([A-Za-z0-9_]+):\s*'(\/[^']*)',?$/gmu;

/**
 * Collects every route path the App Router serves.
 *
 * @returns Route paths with group segments removed.
 */
function collectRoutes() {
  const routes = [];
  const walk = (directory, urlPath) => {
    const entries = readdirSync(directory);
    if (entries.some((entry) => ROUTE_FILES.has(entry))) {
      routes.push(urlPath.replace(GROUP_SEGMENT, '') || '/');
    }
    for (const entry of entries) {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) walk(path, `${urlPath}/${entry}`);
    }
  };
  walk(appDirectory, '');
  return routes;
}

const routes = collectRoutes();

// A catch-all route answers anything, so it must not be used to prove that a
// navigation link is valid.
const matchers = routes
  .filter((route) => !CATCH_ALL_SEGMENT.test(route))
  .map((route) => {
    const pattern = route
      .split('/')
      .map((segment) =>
        DYNAMIC_SEGMENT.test(segment) ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
      )
      .join('/');
    return new RegExp(`^${pattern === '' ? '/' : pattern}$`, 'u');
  });

/**
 * Reports whether a link resolves to a declared route.
 *
 * @param link Absolute application path.
 * @returns True when a non catch-all route matches it.
 */
function resolves(link) {
  const path = (link.split('?')[0] ?? '').replace(/\/+$/u, '') || '/';
  if (!path.startsWith('/')) return true;
  return matchers.some((matcher) => matcher.test(path));
}

/**
 * Reports whether a path is a prefix that real routes are built under, such
 * as the `/pay` base that only ever appears as `/pay/[token]`.
 *
 * @param path Absolute application path.
 * @returns True when at least one route lives beneath it.
 */
function isRoutePrefix(path) {
  return routes.some((route) => route.startsWith(`${path}/`));
}

const failures = [];

// Rule 2 - the route table itself.
const appConfig = readFileSync(join(configDirectory, 'app.ts'), 'utf8');
const routesBlock = appConfig.slice(
  appConfig.indexOf('export const ROUTES'),
  appConfig.indexOf('} as const;', appConfig.indexOf('export const ROUTES'))
);
const routeTable = new Map();
for (const match of routesBlock.matchAll(ROUTE_ENTRY)) {
  routeTable.set(match[1], match[2]);
  if (!resolves(match[2]) && !isRoutePrefix(match[2])) {
    failures.push(
      `ROUTES.${match[1]} points at "${match[2]}", which is neither a route nor a route prefix.`
    );
  }
}

// Rules 1 and 3 - every navigation config.
const navigationFiles = readdirSync(configDirectory).filter(
  (name) => name === 'navigation.ts' || name.endsWith('-navigation.ts')
);
for (const name of navigationFiles) {
  const source = readFileSync(join(configDirectory, name), 'utf8');

  const links = [];
  for (const match of source.matchAll(HREF_LITERAL)) links.push(match[1]);
  for (const match of source.matchAll(HREF_TEMPLATE)) {
    const base = routeTable.get(match[1]);
    if (base === undefined) {
      failures.push(`${name} builds a link from unknown ROUTES.${match[1]}.`);
      continue;
    }
    links.push(`${base}${match[2]}`);
  }
  for (const link of links) {
    if (!resolves(link)) failures.push(`${name} links to "${link}", which is not a route.`);
  }

  const keys = new Set();
  for (const match of source.matchAll(NAV_KEY)) {
    if (keys.has(match[1])) failures.push(`${name} reuses the navigation key "${match[1]}".`);
    keys.add(match[1]);
  }
}

if (failures.length > 0) {
  console.error('Navigation check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `Navigation check passed. ${routes.length} route(s), ${routeTable.size} named route(s), ` +
    `${navigationFiles.length} navigation config(s), every link resolves.`
);
