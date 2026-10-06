// src/app/api/og/route.tsx
// The picture that appears when somebody shares a link to this site.
//
// Generated rather than designed one by one, because a share image nobody
// has to remember to make is a share image that always exists. The title
// comes from the address, so the same route serves every page.

import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

import { BRAND } from '@/config/brand';

export const runtime = 'edge';

/** How large a social preview is expected to be. */
const WIDTH = 1200;
const HEIGHT = 630;

/**
 * Draws the share image for one page.
 *
 * @param request Incoming request, carrying the title to draw.
 * @returns The image.
 */
export function GET(request: NextRequest): ImageResponse {
  const title = (request.nextUrl.searchParams.get('title') ?? BRAND.name).slice(0, 90);
  const subtitle = (request.nextUrl.searchParams.get('subtitle') ?? BRAND.tagline).slice(0, 120);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          backgroundColor: '#0b1220',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              backgroundColor: '#1d4ed8',
            }}
          />
          <span style={{ fontSize: '32px', fontWeight: 600 }}>{BRAND.name}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <span style={{ fontSize: '64px', fontWeight: 700, lineHeight: 1.1 }}>{title}</span>
          <span style={{ fontSize: '30px', color: '#94a3b8' }}>{subtitle}</span>
        </div>

        <div
          style={{
            display: 'flex',
            height: '10px',
            borderRadius: '999px',
            backgroundColor: '#1d4ed8',
          }}
        />
      </div>
    ),
    { width: WIDTH, height: HEIGHT }
  );
}
