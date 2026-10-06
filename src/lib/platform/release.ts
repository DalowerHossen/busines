// src/lib/platform/release.ts
// Which build is running.
//
// When something breaks at three in the morning, the first useful question
// is which version is actually deployed. Every host sets a different
// variable for it, so they are all read and the first real answer wins.

import 'server-only';

export interface ReleaseInfo {
  version: string;
  commit: string;
  builtAt: string;
  environment: string;
}

/**
 * Reads the first value that is actually set.
 *
 * @param names Environment variables to try, in order.
 * @returns The value, or null when none is set.
 */
function firstValue(names: readonly string[]): string | null {
  for (const name of names) {
    const value = process.env[name];

    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }

  return null;
}

/**
 * Describes the build that is running.
 *
 * @returns The version, commit and when it was built.
 */
export function releaseInfo(): ReleaseInfo {
  const commit =
    firstValue([
      'COMMIT_REF',
      'VERCEL_GIT_COMMIT_SHA',
      'GITHUB_SHA',
      'SOURCE_VERSION',
      'RELEASE_COMMIT',
    ]) ?? 'unknown';

  return {
    version: firstValue(['RELEASE_VERSION', 'npm_package_version']) ?? '0.0.0',
    commit: commit.slice(0, 12),
    builtAt: firstValue(['BUILD_TIME', 'VERCEL_GIT_COMMIT_DATE']) ?? 'unknown',
    environment: firstValue(['APP_ENV', 'NODE_ENV']) ?? 'development',
  };
}
