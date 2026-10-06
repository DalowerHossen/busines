// src/lib/utils.ts
// Small helpers that the whole interface relies on.

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind class names, letting later classes win over earlier ones.
 *
 * @param inputs Class names, conditionals or arrays of either.
 * @returns A single class attribute value.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Pauses execution for a number of milliseconds.
 *
 * @param milliseconds How long to wait.
 * @returns A promise that settles after the delay.
 */
export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Keeps a number inside an inclusive range.
 *
 * @param value Value to clamp.
 * @param minimum Lowest accepted value.
 * @param maximum Highest accepted value.
 * @returns The clamped value.
 */
export function clamp(value: number, minimum: number, maximum: number): number {
  if (Number.isNaN(value)) {
    return minimum;
  }

  return Math.min(Math.max(value, minimum), maximum);
}

/**
 * Splits a list into chunks of a fixed size.
 *
 * @param items Items to split.
 * @param size Maximum number of items per chunk.
 * @returns A list of chunks, each holding at least one item.
 */
export function chunk<Item>(items: readonly Item[], size: number): Item[][] {
  const safeSize = Math.max(1, Math.floor(size));
  const chunks: Item[][] = [];

  for (let index = 0; index < items.length; index += safeSize) {
    chunks.push(items.slice(index, index + safeSize));
  }

  return chunks;
}

/**
 * Removes duplicate values while keeping the original order.
 *
 * @param items Items to deduplicate.
 * @returns A new list without repeats.
 */
export function unique<Item>(items: readonly Item[]): Item[] {
  return Array.from(new Set(items));
}

/**
 * Groups items by a key derived from each item.
 *
 * @param items Items to group.
 * @param selectKey Function returning the grouping key.
 * @returns A map from key to the items that produced it.
 */
export function groupBy<Item>(
  items: readonly Item[],
  selectKey: (item: Item) => string
): Map<string, Item[]> {
  const groups = new Map<string, Item[]>();

  for (const item of items) {
    const key = selectKey(item);
    const existing = groups.get(key);

    if (existing) {
      existing.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  return groups;
}

/**
 * Reports whether a value is neither null nor undefined.
 *
 * @param value Value to test.
 * @returns True when the value is present.
 */
export function isPresent<Value>(value: Value | null | undefined): value is Value {
  return value !== null && value !== undefined;
}
