import { describe, expect, it } from 'vitest';
import { createDailyPlan, createFreePlan } from './plans';
import type { PracticeRecord } from './types';

const difficultRecord: PracticeRecord = {
  id: 'one', startedAt: '2026-09-23T00:00:00.000Z', durationSeconds: 180,
  planTitle: '練習', bpm: 80, chords: ['Dm', 'E'], rating: 'hard', note: '', completed: true,
};

describe('practice plans', () => {
  it.each([5, 10, 20] as const)('creates exactly %i minutes of practice', (minutes) => {
    const plan = createDailyPlan(minutes, []);
    expect(plan.steps.reduce((seconds, step) => seconds + step.seconds, 0)).toBe(minutes * 60);
    expect(plan.steps.every((step) => step.seconds > 0)).toBe(true);
  });

  it('prioritizes chords rated hard', () => {
    const plan = createDailyPlan(5, [difficultRecord]);
    expect(plan.steps[1].chords.slice(0, 2)).toEqual(['E', 'Dm']);
  });

  it('creates a five minute free practice step', () => {
    const plan = createFreePlan(['C', 'G', 'C'], 'eighths');
    expect(plan.steps).toEqual([expect.objectContaining({ seconds: 300, chords: ['C', 'G', 'C'], pattern: 'eighths' })]);
  });
});
