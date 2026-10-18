export type ChordId = 'C' | 'D' | 'E' | 'G' | 'A' | 'Am' | 'Dm' | 'Em';
export interface Chord {
  id: ChordId;
  name: string;
  frets: [number, number, number, number, number, number]; // 6th → 1st; -1 = muted
  fingers: [number, number, number, number, number, number]; // 0 = open/muted
  tip: string;
}
export interface Lesson { id: string; title: string; eyebrow: string; minutes: number; paragraphs: string[]; takeaway: string; }
export type PatternId = 'quarters' | 'eighths' | 'basic';
export interface StrumPattern { id: PatternId; name: string; strokes: ('down' | 'up' | 'rest')[]; description: string; }
export interface Song { id: string; title: string; subtitle: string; chords: ChordId[]; bpm: number; pattern: PatternId; }
export interface PracticeStep { id: string; title: string; instruction: string; seconds: number; chords: ChordId[]; pattern: PatternId; }
export interface PracticePlan { id: string; title: string; minutes: number; steps: PracticeStep[]; }
export interface PracticeRecord {
  id: string; startedAt: string; durationSeconds: number; planTitle: string;
  bpm: number; chords: ChordId[]; rating: 'good' | 'hard'; note: string; completed: boolean;
}
export interface Settings { bpm: number; sound: boolean; preferredMinutes: 5 | 10 | 20; }
export interface Backup { schemaVersion: 1; exportedAt: string; settings: Settings; records: PracticeRecord[]; }
export interface BeatEvent { tick: number; beat: number; subdivision: number; countIn: boolean; time: number; }
export interface EngineOptions {
  bpm: number; sound: boolean; onBeat: (event: BeatEvent) => void; onInterrupt: () => void;
}
