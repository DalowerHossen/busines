// vitest.config.ts
// How the unit tests are run.
//
// Only the pure parts of the system are covered here: arithmetic, parsing,
// judging a request, building a plan. Everything that touches the database
// is covered by the migration validation harness instead, which runs the
// real schema against a real engine rather than against a mock that agrees
// with whatever the code currently does.

import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // Server-only is a build time guard rather than real code; under the
      // test runner it stands in as an empty module.
      'server-only': resolve(__dirname, './tests/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    reporters: ['default'],
  },
});
