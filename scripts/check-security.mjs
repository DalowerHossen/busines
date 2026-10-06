// scripts/check-security.mjs
// Quality gate: tenant isolation is never left to discipline.
// Run with: npm run check:security
//
// One business reading another's invoices would end this product, and the
// only thing that reliably prevents it is a row level security policy on
// every table that carries a company. A table added in a hurry without one
// looks exactly like a table with one, until the day it does not.
//
// This reads the migrations and insists that every tenant table has row
// level security switched on, forced so that even the table owner obeys it,
// and either a policy saying who may read it or a revocation saying nobody
// may reach it directly at all.
//
// It also checks that every audit entry the application writes names an
// action the database recognises, because an unrecognised one throws at the
// exact moment somebody is trying to record who did what.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');
const SOURCE = join(ROOT, 'src');

const IGNORED_DIRECTORIES = new Set(['node_modules', '.next', '.git', 'out', 'build', 'dist']);

/**
 * Tables that carry a company but are reached only through the server,
 * never by a signed in user. Each one is listed here deliberately rather
 * than detected, so adding another is a decision somebody makes on purpose.
 */
const SERVICE_ONLY_TABLES = new Set(['unsubscribe_tokens']);

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

const migrationSql = readdirSync(MIGRATIONS)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(join(MIGRATIONS, file), 'utf8'))
  .join('\n');

/** @type {string[]} */
const problems = [];

const tenantTables = [];

for (const match of migrationSql.matchAll(
  /create table public\.([a-z_0-9]+)\s*\(([\s\S]*?)\n\);/g
)) {
  if (/^ {2}company_id uuid/m.test(match[2] ?? '')) {
    tenantTables.push(match[1] ?? '');
  }
}

const enabled = new Set(
  [...migrationSql.matchAll(/alter table public\.([a-z_0-9]+) enable row level security/g)].map(
    (match) => match[1] ?? ''
  )
);

const forced = new Set(
  [...migrationSql.matchAll(/alter table public\.([a-z_0-9]+) force row level security/g)].map(
    (match) => match[1] ?? ''
  )
);

const withPolicy = new Set(
  [...migrationSql.matchAll(/create policy [a-z_0-9]+\s+on public\.([a-z_0-9]+)/g)].map(
    (match) => match[1] ?? ''
  )
);

const withHelper = new Set(
  [...migrationSql.matchAll(/install_tenant_policies\('([a-z_0-9]+)'/g)].map(
    (match) => match[1] ?? ''
  )
);

const revoked = new Set(
  [...migrationSql.matchAll(/revoke all on public\.([a-z_0-9]+) from anon, authenticated/g)].map(
    (match) => match[1] ?? ''
  )
);

for (const table of tenantTables) {
  if (!enabled.has(table)) {
    problems.push(`${table} carries a company but has no row level security`);

    continue;
  }

  if (!forced.has(table)) {
    problems.push(`${table} has row level security but it is not forced`);
  }

  const isReachable = withPolicy.has(table) || withHelper.has(table);
  const isLockedDown = revoked.has(table) && SERVICE_ONLY_TABLES.has(table);

  if (!isReachable && !isLockedDown) {
    problems.push(
      `${table} has row level security but no policy, so nobody can read it and nothing says that was intended`
    );
  }
}

const auditEnum = /create type public\.audit_action as enum \(([\s\S]*?)\);/.exec(migrationSql);

const auditActions = new Set(
  (auditEnum?.[1] ?? '')
    .split(',')
    .map((entry) => entry.trim().replace(/^'|'$/g, ''))
    .filter((entry) => entry !== '')
);

for (const file of listFiles(SOURCE)) {
  if (!file.endsWith('.ts') && !file.endsWith('.tsx')) {
    continue;
  }

  const contents = readFileSync(file, 'utf8');
  const where = relative(ROOT, file);

  for (const entry of contents.matchAll(/recordAuditEntry\(\{([\s\S]*?)\}\)/g)) {
    const body = entry[1] ?? '';

    for (const action of body.matchAll(/action:\s*'([a-z_]+)'/g)) {
      const value = action[1] ?? '';

      if (!auditActions.has(value)) {
        problems.push(`${where}: the audit trail has no action called ${value}`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error('These would let one business see another, or lose the record of who did what:');

  for (const problem of problems) {
    console.error(`  ${problem}`);
  }

  console.error(
    `\n${problems.length} problem(s). None of these are acceptable in a product that holds money.`
  );

  process.exit(1);
}

console.log(
  `Security check passed. ${String(tenantTables.length)} tenant tables, every one isolated, and every audit action recognised.`
);
