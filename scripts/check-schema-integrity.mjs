// scripts/check-schema-integrity.mjs
// Structural checks over the SQL migrations and the code that queries them.
//
// These rules exist because the repository once carried two independent
// migration lineages that reused the same sequence numbers, created 47 of the
// same tables twice, and left application code pointing at tables that the
// surviving lineage never created. A clean checkout could therefore never be
// applied to an empty database. Every rule below fails the build rather than
// letting that situation return quietly.
//
// Rule 1  Every migration file name starts with a unique five digit number.
// Rule 2  No table is created by more than one migration.
// Rule 3  Every table in the public schema enables row level security.
// Rule 4  Every table name used in a `.from('...')` call exists in the schema.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const migrationsDirectory = join(root, 'supabase/migrations');
const sourceDirectory = join(root, 'src');

const CREATE_TABLE = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/giu;
const ENABLE_RLS =
  /alter\s+table\s+(?:only\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s+enable\s+row\s+level\s+security/giu;
const FROM_CALL = /\.from\(\s*'([a-z_][a-z0-9_]*)'/gu;
const FILE_NUMBER = /^(\d{5})_[a-z0-9_]+\.sql$/u;

/**
 * Collects every match of one capturing group in a body of text.
 *
 * @param {string} text Text to scan.
 * @param {RegExp} pattern Global regular expression with one capture group.
 * @returns {string[]} Every captured value, in order of appearance.
 */
function captureAll(text, pattern) {
  const found = [];
  pattern.lastIndex = 0;
  let match = pattern.exec(text);
  while (match !== null) {
    found.push(match[1]);
    match = pattern.exec(text);
  }
  return found;
}

/**
 * Lists every file under a directory tree.
 *
 * @param {string} directory Directory to walk.
 * @param {(name: string) => boolean} accept Predicate applied to file names.
 * @returns {string[]} Absolute paths of the accepted files.
 */
function walk(directory, accept) {
  const results = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      results.push(...walk(path, accept));
    } else if (accept(entry)) {
      results.push(path);
    }
  }
  return results;
}

const failures = [];
const migrationFiles = readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort();

// Rule 1 - unique, well formed sequence numbers.
const numberOwners = new Map();
for (const name of migrationFiles) {
  const match = FILE_NUMBER.exec(name);
  if (match === null) {
    failures.push(`Migration "${name}" does not match the NNNNN_name.sql convention.`);
    continue;
  }
  const number = match[1];
  const owners = numberOwners.get(number) ?? [];
  owners.push(name);
  numberOwners.set(number, owners);
}
for (const [number, owners] of numberOwners) {
  if (owners.length > 1) {
    failures.push(
      `Migration number ${number} is used by ${owners.length} files: ${owners.join(', ')}.`
    );
  }
}

// Rules 2 and 3 - one creator per table, row level security everywhere.
const createdBy = new Map();
const securedTables = new Set();
for (const name of migrationFiles) {
  const sql = readFileSync(join(migrationsDirectory, name), 'utf8');
  for (const table of captureAll(sql, CREATE_TABLE)) {
    const owners = createdBy.get(table) ?? [];
    owners.push(name);
    createdBy.set(table, owners);
  }
  for (const table of captureAll(sql, ENABLE_RLS)) {
    securedTables.add(table);
  }
}
for (const [table, owners] of createdBy) {
  if (owners.length > 1) {
    failures.push(
      `Table "${table}" is created by ${owners.length} migrations: ${owners.join(', ')}.`
    );
  }
  if (!securedTables.has(table)) {
    failures.push(`Table "${table}" never enables row level security.`);
  }
}

// Rule 4 - no query against a table the schema does not define.
const sourceFiles = walk(sourceDirectory, (name) => name.endsWith('.ts') || name.endsWith('.tsx'));
for (const path of sourceFiles) {
  const code = readFileSync(path, 'utf8');
  for (const table of new Set(captureAll(code, FROM_CALL))) {
    if (!createdBy.has(table)) {
      failures.push(
        `${relative(root, path)} queries table "${table}", which no migration creates.`
      );
    }
  }
}

if (failures.length > 0) {
  console.error('Schema integrity check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `Schema integrity check passed. ${migrationFiles.length} migration(s), ` +
    `${createdBy.size} table(s), all with row level security, ` +
    `${sourceFiles.length} source file(s) scanned.`
);
