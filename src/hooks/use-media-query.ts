// src/hooks/use-media-query.ts
// Reports whether a media query matches, so a component can behave
// differently on a phone without guessing from the user agent.

'use client';

import { useEffect, useState } from 'react';

import { BREAKPOINTS } from '@/config/app';

/**
 * Watches a media query.
 *
 * @param query Media query text, such as "(min-width: 768px)".
 * @returns True while the query matches.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);

    function onChange(event: MediaQueryListEvent): void {
      setMatches(event.matches);
    }

    list.addEventListener('change', onChange);

    return () => {
      list.removeEventListener('change', onChange);
    };
  }, [query]);

  return matches;
}

/**
 * Reports whether the viewport is narrower than the tablet breakpoint.
 *
 * @returns True on a phone sized screen.
 */
export function useIsMobile(): boolean {
  return !useMediaQuery(`(min-width: ${BREAKPOINTS.md}px)`);
}

/**
 * Reports whether the visitor asked for less motion.
 *
 * @returns True when animations should be kept to a minimum.
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
