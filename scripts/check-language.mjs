// scripts/check-language.mjs
// Quality gate: the codebase must contain English only.
// Any Bengali character, or any character from another non Latin script that is
// not allowed, fails the build. Run with: npm run check:language

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

const SCANNED_DIRECTORIES = ['src', 'scripts', 'supabase', 'docs', 'tests', 'public'];

const SCANNED_ROOT_FILES = [
  'README.md',
  'package.json',
  'next.config.mjs',
  'tailwind.config.ts',
  'netlify.toml',
  'vercel.json',
  '.env.example',
];

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
  '.json',
  '.css',
  '.scss',
  '.md',
  '.mdx',
  '.sql',
  '.toml',
  '.yml',
  '.yaml',
  '.sh',
  '.html',
  '.txt',
  '.svg',
  '.example',
]);

// Unicode blocks that must never appear in source code.
const FORBIDDEN_SCRIPTS = [
  { name: 'Bengali', pattern: /[\u0980-\u09FF]/u },
  { name: 'Devanagari', pattern: /[\u0900-\u097F]/u },
  { name: 'Arabic', pattern: /[\u0600-\u06FF]/u },
  { name: 'CJK', pattern: /[\u4E00-\u9FFF]/u },
  { name: 'Cyrillic', pattern: /[\u0400-\u04FF]/u },
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

    const extension = extname(entry);
    const isEnvExample = entry === '.env.example';

    if (SCANNED_EXTENSIONS.has(extension) || isEnvExample) {
      collected.push(absolutePath);
    }
  }

  return collected;
}

/**
 * Scans a single file and returns every violation found.
 *
 * @param {string} absolutePath Absolute file path.
 * @returns {Array<{ file: string, line: number, script: string, text: string }>} Violations.
 */
function scanFile(absolutePath) {
  const violations = [];
  const content = readFileSync(absolutePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';

    for (const script of FORBIDDEN_SCRIPTS) {
      if (script.pattern.test(line)) {
        violations.push({
          file: relative(ROOT, absolutePath),
          line: index + 1,
          script: script.name,
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

  for (const rootFile of SCANNED_ROOT_FILES) {
    const absolutePath = join(ROOT, rootFile);
    try {
      if (statSync(absolutePath).isFile()) {
        files.push(absolutePath);
      }
    } catch {
      // The file does not exist yet; it will be created in a later phase.
    }
  }

  /** @type {Array<{ file: string, line: number, script: string, text: string }>} */
  const violations = [];

  for (const file of files) {
    violations.push(...scanFile(file));
  }

  if (violations.length > 0) {
    console.error('Language check failed. Only English is allowed in the codebase.\n');
    for (const violation of violations) {
      console.error(
        `  ${violation.file}:${violation.line}  [${violation.script}]  ${violation.text}`
      );
    }
    console.error(`\n${violations.length} violation(s) found in ${files.length} scanned file(s).`);
    process.exit(1);
  }

  console.log(`Language check passed. ${files.length} file(s) scanned, English only.`);
}

main();
