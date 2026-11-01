import { markMoment } from '../markMoment';
import type { PathEntry } from '../path';

const day = (date: string, state: 'done' | 'today' | 'past', isToday = false): PathEntry => ({ kind: 'day', date, weekday: 'Sat', day: Number(date.slice(8)), state, isToday });

describe('markMoment', () => {
  it("raises today's block with the day's first mark", () => {
    expect(markMoment([day('2026-10-30', 'done'), day('2026-10-31', 'today', true)])).toBe('rise');
  });

  it('makes it glow for each mark after that', () => {
    expect(markMoment([day('2026-10-30', 'done'), day('2026-10-31', 'done', true)])).toBe('glow');
  });

  it('raises it when the path has no block for today yet', () => {
    expect(markMoment([day('2026-10-30', 'done')])).toBe('rise');
  });
});
