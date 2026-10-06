// scripts/check-database-contract.mjs
// Quality gate: the application may only ask the database for things the
// database actually has.
// Run with: npm run check:database
//
// Every call to a stored routine and every table read is written as a
// string. A typed language cannot check a string, so a renamed column or a
// mistyped parameter compiles perfectly and fails at the worst possible
// moment, in front of somebody who is trying to get paid. This reads the
// migrations, reads the application, and refuses the build when the two
// disagree.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');
const SOURCE = join(ROOT, 'src');

const IGNORED_DIRECTORIES = new Set(['node_modules', '.next', '.git', 'out', 'build', 'dist']);

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
 * Reads what the database offers: its routines with their parameter names,
 * its tables, and the columns of each.
 *
 * @returns {{ routines: Map<string, Set<string>>, columns: Map<string, Set<string>> }}
 */
function readDatabaseContract() {
  /** @type {Map<string, Set<string>>} */
  const routines = new Map();
  /** @type {Map<string, Set<string>>} */
  const columns = new Map();

  for (const file of readdirSync(MIGRATIONS).sort()) {
    if (!file.endsWith('.sql')) {
      continue;
    }

    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');

    for (const match of sql.matchAll(
      /create or replace function public\.([a-z_0-9]+)\s*\(([\s\S]*?)\)\s*\n?returns/g
    )) {
      const name = match[1] ?? '';
      const declared = new Set(routines.get(name) ?? []);

      for (const parameter of (match[2] ?? '').matchAll(/\b(p_[a-z0-9_]+)\s/g)) {
        declared.add(parameter[1] ?? '');
      }

      routines.set(name, declared);
    }

    for (const match of sql.matchAll(/create table public\.([a-z_0-9]+)\s*\(([\s\S]*?)\n\);/g)) {
      const table = match[1] ?? '';
      const known = new Set(columns.get(table) ?? []);

      for (const line of (match[2] ?? '').split('\n')) {
        const column = /^ {2}([a-z][a-z0-9_]*)\s+[a-z]/.exec(line);

        if (column !== null) {
          known.add(column[1] ?? '');
        }
      }

      columns.set(table, known);
    }

    for (const match of sql.matchAll(
      /alter table public\.([a-z_0-9]+)\s+add column(?: if not exists)? ([a-z_0-9]+)/g
    )) {
      const table = match[1] ?? '';
      const known = new Set(columns.get(table) ?? []);
      known.add(match[2] ?? '');
      columns.set(table, known);
    }
  }

  return { routines, columns };
}

/**
 * Removes the nested relation parts of a select, which name columns on a
 * different table and are checked by the database itself.
 *
 * @param {string} selection The select expression as written.
 * @returns {string} Only the columns of the table being read.
 */
function stripNestedRelations(selection) {
  let text = selection;
  let previous = '';

  while (text !== previous) {
    previous = text;
    text = text.replace(/[a-z_0-9]+\s*(?::[a-z_0-9]+\s*)?\([^()]*\)/g, '');
  }

  return text;
}

const { routines, columns } = readDatabaseContract();

/** @type {string[]} */
const problems = [];

for (const file of listFiles(SOURCE)) {
  if (!file.endsWith('.ts') && !file.endsWith('.tsx')) {
    continue;
  }

  const contents = readFileSync(file, 'utf8');
  const where = relative(ROOT, file);

  for (const call of contents.matchAll(
    /\.rpc\(\s*'([a-z_0-9]+)'\s*(?:,\s*\{([\s\S]*?)\}\s*)?\)/g
  )) {
    const name = call[1] ?? '';
    const declared = routines.get(name);

    if (declared === undefined) {
      problems.push(`${where}: there is no routine called ${name}`);

      continue;
    }

    for (const parameter of (call[2] ?? '').matchAll(/(p_[a-z0-9_]+)\s*:/g)) {
      const passed = parameter[1] ?? '';

      if (!declared.has(passed)) {
        problems.push(`${where}: ${name} has no parameter called ${passed}`);
      }
    }
  }

  for (const read of contents.matchAll(/\.from\('([a-z_0-9]+)'\)/g)) {
    const table = read[1] ?? '';

    if (!columns.has(table)) {
      problems.push(`${where}: there is no table called ${table}`);
    }
  }

  for (const read of contents.matchAll(
    /\.from\('([a-z_0-9]+)'\)\s*\n?\s*\.select\(\s*\n?\s*'([\s\S]*?)'/g
  )) {
    const table = read[1] ?? '';
    const known = columns.get(table);

    if (known === undefined) {
      continue;
    }

    for (const column of stripNestedRelations(read[2] ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '' && entry !== '*')) {
      if (!known.has(column)) {
        problems.push(`${where}: ${table} has no column called ${column}`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error('The application is asking the database for things it does not have:');

  for (const problem of problems) {
    console.error(`  ${problem}`);
  }

  console.error(
    `\n${problems.length} mismatch(es). These compile perfectly and fail in front of a customer, so they are refused here instead.`
  );

  process.exit(1);
}

console.log(
  `Database contract check passed. ${String(routines.size)} routines and ${String(columns.size)} tables, all addressed correctly.`
);
