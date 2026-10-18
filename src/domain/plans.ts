import type { ChordId, PatternId, PracticePlan, PracticeRecord, PracticeStep } from './types';

const starterChords: ChordId[] = ['C', 'G', 'Am', 'D'];
const allChords: ChordId[] = ['C', 'D', 'E', 'G', 'A', 'Am', 'Dm', 'Em'];

function focusChords(records: PracticeRecord[]): ChordId[] {
  const difficulty = new Map<ChordId, number>();
  for (const record of records) {
    if (record.rating !== 'hard') continue;
    for (const chord of new Set(record.chords)) {
      difficulty.set(chord, (difficulty.get(chord) ?? 0) + 1);
    }
  }
  const difficult = allChords
    .filter((chord) => difficulty.has(chord))
    .sort((a, b) => (difficulty.get(b) ?? 0) - (difficulty.get(a) ?? 0));
  return [...new Set([...difficult, ...starterChords])].slice(0, 4);
}

export function createDailyPlan(minutes: 5 | 10 | 20, records: PracticeRecord[]): PracticePlan {
  const chords = focusChords(records);
  const durations = {
    5: [60, 120, 90, 30],
    10: [90, 180, 180, 150],
    20: [180, 360, 360, 300],
  }[minutes];
  const steps: PracticeStep[] = [
    {
      id: 'warmup', title: 'ゆっくり音を出す',
      instruction: '力を抜き、1拍ずつ音が鳴るか確かめましょう。',
      seconds: durations[0], chords: chords.slice(0, 2), pattern: 'quarters',
    },
    {
      id: 'chords', title: 'コードを押さえる',
      instruction: '指を置き直しながら、きれいに鳴る弦を増やしましょう。',
      seconds: durations[1], chords, pattern: 'quarters',
    },
    {
      id: 'changes', title: 'コードチェンジ',
      instruction: '4拍ごとに次のコードへ移りましょう。速さよりも滑らかさを大切に。',
      seconds: durations[2], chords, pattern: 'basic',
    },
    {
      id: 'rhythm', title: 'リズムに合わせる',
      instruction: '一定の拍に合わせ、最後まで弾いてみましょう。',
      seconds: durations[3], chords, pattern: 'basic',
    },
  ];
  return { id: `daily-${minutes}`, title: `${minutes}分の今日の練習`, minutes, steps };
}

export function createFreePlan(chords: ChordId[], pattern: PatternId, title = '自由練習'): PracticePlan {
  return {
    id: 'free', title, minutes: 5,
    steps: [{
      id: 'free', title, instruction: '拍に合わせて、無理のない速さで弾きましょう。',
      seconds: 300, chords: chords.length ? [...chords] : starterChords.slice(0, 2), pattern,
    }],
  };
}
