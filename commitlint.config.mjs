// commitlint.config.mjs
// Conventional Commits rules enforced by the .husky/commit-msg hook.
// Keeps the git history machine readable so release notes and the
// changelog in docs/CHANGELOG.md can be generated or audited reliably.

/** @type {import('@commitlint/types').UserConfig} */
const config = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
        'security',
      ],
    ],
    'subject-case': [0],
    'body-max-line-length': [0],
  },
};

export default config;
