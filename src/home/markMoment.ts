import type { PathEntry } from './path';

/**
 * How a mark shows on the path, read from the path before the mark: the day's first mark raises
 * today's block into place; every mark after that makes it glow.
 */
export function markMoment(before: readonly PathEntry[]): 'rise' | 'glow' {
  const today = before.find((e) => e.kind === 'day' && e.isToday);
  return today?.kind === 'day' && today.state === 'done' ? 'glow' : 'rise';
}
