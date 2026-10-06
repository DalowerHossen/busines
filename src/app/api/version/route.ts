// src/app/api/version/route.ts
// Which build is serving this request.
//
// Small enough to be checked from a script, honest enough to settle an
// argument about whether a deployment actually happened.

import { NextResponse } from 'next/server';

import { HTTP_STATUS } from '@/lib/http/responses';
import { releaseInfo } from '@/lib/platform/release';

export const dynamic = 'force-dynamic';

/**
 * Reports the running build.
 *
 * @returns The version, commit and build time.
 */
export function GET(): NextResponse {
  return NextResponse.json(releaseInfo(), {
    status: HTTP_STATUS.ok,
    headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' },
  });
}
