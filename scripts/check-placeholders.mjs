// scripts/check-placeholders.mjs
// Quality gate: the codebase must never contain unfinished work markers.
// Run with: npm run check:placeholders

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

const SCANNED_DIRECTORIES = ['src', 'scripts', 'supabase', 'tests'];

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.next',
  '.git',
  'out',
  'build',
  'dist',
  'coverage',
  'test-results',
  'playwright-report',
]);

const SCANNED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.css',
  '.scss',
  '.sql',
]);

// Patterns that indicate incomplete code. The spread operator and legitimate
// ellipsis characters inside user facing strings are intentionally not matched.
const FORBIDDEN_PATTERNS = [
  { name: 'TODO comment', pattern: /(^|[^A-Za-z])TODO\b/ },
  { name: 'FIXME comment', pattern: /(^|[^A-Za-z])FIXME\b/ },
  { name: 'XXX marker', pattern: /(^|[^A-Za-z])XXX\b/ },
  { name: 'HACK marker', pattern: /(^|[^A-Za-z])HACK\b/ },
  { name: 'Truncated code comment', pattern: /\/\/\s*\.\.\./ },
  { name: 'Truncated block comment', pattern: /\/\*\s*\.\.\./ },
  { name: 'Rest of code marker', pattern: /rest of (the )?(code|file|implementation)/i },
  { name: 'Remaining code marker', pattern: /remaining (code|implementation|fields|items)/i },
  { name: 'Add more marker', pattern: /add more (here|below|later)/i },
  { name: 'Similar to above marker', pattern: /similar to (the )?above/i },
  { name: 'Implement later marker', pattern: /implement (this )?later/i },
  { name: 'Not implemented marker', pattern: /not implemented yet/i },
  { name: 'Coming soon marker', pattern: /coming soon/i },
  { name: 'Placeholder marker', pattern: /placeholder (for|content|text|implementation)/i },
  { name: 'Lorem ipsum text', pattern: /lorem ipsum/i },
];

/**
 * Collects every file that must be scanned.
 *
 * @param {string} directory Absolute directory path.
 * @param {string[]} collected Accumulator for absolute file paths.
 * @returns {string[]} Absolute file paths.
 */
function collectFiles(directory, collected) {
  let entries;
  try {
    entries = readdirSync(directory);
  } catch {
    return collected;
  }

  for (const entry of entries) {
    if (IGNORED_DIRECTORIES.has(entry)) {
      continue;
    }

    const absolutePath = join(directory, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      collectFiles(absolutePath, collected);
      continue;
    }

    if (SCANNED_EXTENSIONS.has(extname(entry))) {
      collected.push(absolutePath);
    }
  }

  return collected;
}

/**
 * Scans a single file and returns every violation found.
 *
 * @param {string} absolutePath Absolute file path.
 * @returns {Array<{ file: string, line: number, rule: string, text: string }>} Violations.
 */
function scanFile(absolutePath) {
  const violations = [];
  const content = readFileSync(absolutePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const isGuardScript = absolutePath.endsWith('check-placeholders.mjs');

  if (isGuardScript) {
    return violations;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';

    for (const rule of FORBIDDEN_PATTERNS) {
      if (rule.pattern.test(line)) {
        violations.push({
          file: relative(ROOT, absolutePath),
          line: index + 1,
          rule: rule.name,
          text: line.trim().slice(0, 120),
        });
        break;
      }
    }
  }

  return violations;
}

function main() {
  /** @type {string[]} */
  const files = [];

  for (const directory of SCANNED_DIRECTORIES) {
    collectFiles(join(ROOT, directory), files);
  }

  /** @type {Array<{ file: string, line: number, rule: string, text: string }>} */
  const violations = [];

  for (const file of files) {
    violations.push(...scanFile(file));
  }

  if (violations.length > 0) {
    console.error('Placeholder check failed. Every file must be complete and runnable.\n');
    for (const violation of violations) {
      console.error(
        `  ${violation.file}:${violation.line}  [${violation.rule}]  ${violation.text}`
      );
    }
    console.error(`\n${violations.length} violation(s) found in ${files.length} scanned file(s).`);
    process.exit(1);
  }

  console.log(`Placeholder check passed. ${files.length} file(s) scanned, no unfinished markers.`);
}

main();
