import { describe, expect, it } from 'vitest';
import { chords, patterns, songs } from './library';

describe('教材の音楽的な整合性', () => {
  it('8コードのすべての発音弦が対応する三和音の構成音になる', () => {
    const notes: Record<string, number[]> = {
      C: [0, 4, 7], D: [2, 6, 9], E: [4, 8, 11], G: [7, 11, 2],
      A: [9, 1, 4], Am: [9, 0, 4], Dm: [2, 5, 9], Em: [4, 7, 11],
    };
    const tuning = [4, 9, 2, 7, 11, 4];
    expect(chords).toHaveLength(8);
    for (const chord of chords) {
      const sounding = chord.frets.flatMap((fret, i) => fret < 0 ? [] : [(tuning[i] + fret) % 12]);
      expect([...new Set(sounding)].sort()).toEqual([...notes[chord.id]].sort());
      chord.frets.forEach((fret, i) => {
        expect(chord.fingers[i] >= 1 && chord.fingers[i] <= 4).toBe(fret > 0);
      });
    }
  });
  it('曲のコードとストロークを実際の教材へ解決できる', () => {
    for (const song of songs) {
      expect(song.chords.length).toBeGreaterThan(1);
      for (const chord of song.chords) expect(chords.some(c => c.id === chord)).toBe(true);
      const pattern = patterns.find(p => p.id === song.pattern);
      expect(pattern?.strokes).toHaveLength(8);
      expect(song.bpm).toBeGreaterThanOrEqual(40);
      expect(song.bpm).toBeLessThanOrEqual(160);
    }
    for (const pattern of patterns) {
      expect(pattern.strokes).toHaveLength(8);
      pattern.strokes.forEach((stroke, i) => {
        if (stroke !== 'rest') expect(stroke).toBe(i % 2 === 0 ? 'down' : 'up');
      });
    }
  });
});
