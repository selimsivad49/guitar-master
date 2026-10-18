import type { BeatEvent, Chord, EngineOptions } from '../domain/types';

type Phase = 'idle' | 'starting' | 'countIn' | 'playing' | 'paused' | 'disposed';
const LOOKAHEAD_SECONDS = 0.12;
const SCHEDULE_INTERVAL_MS = 20;
const START_DELAY_SECONDS = 0.035;
const OPEN_STRING_HZ = [82.4069, 110, 146.8324, 195.9977, 246.9417, 329.6276];

function createAudioContext(): AudioContext {
  const AudioContextClass = globalThis.AudioContext ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) throw new Error('このブラウザーは音声機能に対応していません。SafariまたはChromeの最新版で開いてください。');
  return new AudioContextClass();
}

export class PracticeEngine {
  private options: EngineOptions;
  private context: AudioContext | null = null;
  private phase: Phase = 'idle';
  private timer: ReturnType<typeof setInterval> | null = null;
  private sources = new Set<OscillatorNode>();
  private pendingEvents: BeatEvent[] = [];
  private scheduleVersion = 0;
  private generation = 0;
  private countInStart = 0;
  private practiceOrigin = 0;
  private countInIndex = 0;
  private nextTick = 0;
  private nextTickTime = 0;
  private remainingToNextTick = 0;
  private accumulatedSeconds = 0;
  private activeStart: number | null = null;

  constructor(options: EngineOptions) {
    this.options = { ...options };
    this.assertBpm(options.bpm);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  private get tickDuration(): number { return 30 / this.options.bpm; }

  private assertBpm(bpm: number): void {
    if (!Number.isFinite(bpm) || bpm < 40 || bpm > 160) throw new RangeError('BPMは40〜160で指定してください。');
  }

  private getContext(): AudioContext {
    if (!this.context) {
      this.context = createAudioContext();
      this.context.addEventListener('statechange', this.onAudioStateChange);
    }
    return this.context;
  }

  async start(): Promise<void> {
    if (this.phase === 'disposed') throw new Error('破棄済みの音声エンジンです。');
    if (this.phase !== 'idle' && this.phase !== 'paused') return;
    if (this.phase === 'paused') { await this.resume(); return; }
    this.phase = 'starting';
    const generation = ++this.generation;
    try {
      const context = this.getContext();
      await context.resume();
      if (this.generation !== generation || this.phase !== 'starting') return;
      this.accumulatedSeconds = 0;
      this.nextTick = 0;
      this.remainingToNextTick = 0;
      this.beginCountIn(context.currentTime);
    } catch (error) {
      if (this.generation === generation) this.phase = 'idle';
      throw error;
    }
  }

  async resume(): Promise<void> {
    if (this.phase === 'disposed') throw new Error('破棄済みの音声エンジンです。');
    if (this.phase !== 'paused') return;
    this.phase = 'starting';
    const generation = ++this.generation;
    try {
      const context = this.getContext();
      await context.resume();
      if (this.generation !== generation || this.phase !== 'starting') return;
      this.beginCountIn(context.currentTime);
    } catch (error) {
      if (this.generation === generation) this.phase = 'paused';
      throw error;
    }
  }

  private beginCountIn(now: number): void {
    this.clearScheduled();
    this.countInStart = now + START_DELAY_SECONDS;
    this.practiceOrigin = this.countInStart + 8 * this.tickDuration;
    this.countInIndex = 0;
    this.nextTickTime = this.practiceOrigin + this.remainingToNextTick;
    this.activeStart = null;
    this.phase = 'countIn';
    this.timer = setInterval(this.schedule, SCHEDULE_INTERVAL_MS);
    this.schedule();
  }

  private schedule = (): void => {
    const context = this.context;
    if (!context || (this.phase !== 'countIn' && this.phase !== 'playing')) return;
    const version = this.scheduleVersion;
    if (context.state !== 'running' || (typeof document !== 'undefined' && document.hidden)) {
      this.interrupt();
      return;
    }
    const now = context.currentTime;
    this.deliverDue(now);
    if (version !== this.scheduleVersion || (this.phase !== 'countIn' && this.phase !== 'playing')) return;
    if (now >= this.practiceOrigin && this.phase === 'countIn') {
      this.phase = 'playing';
      this.activeStart = this.practiceOrigin;
    }
    const horizon = now + LOOKAHEAD_SECONDS;
    while (this.countInIndex < 8 && this.countInStart + this.countInIndex * this.tickDuration <= horizon) {
      const tick = this.countInIndex++;
      this.queueBeat(tick, true, this.countInStart + tick * this.tickDuration);
    }
    while (this.nextTickTime <= horizon) {
      this.queueBeat(this.nextTick, false, this.nextTickTime);
      this.nextTick += 1;
      this.nextTickTime += this.tickDuration;
    }
    this.deliverDue(now);
  };

  private queueBeat(tick: number, countIn: boolean, time: number): void {
    const event: BeatEvent = { tick, beat: Math.floor(tick / 2) % 4, subdivision: tick % 2, countIn, time };
    this.pendingEvents.push(event);
    if (this.options.sound) this.scheduleClick(time, event.subdivision === 0, countIn);
  }

  private deliverDue(now: number): void {
    while (this.pendingEvents.length && this.pendingEvents[0].time <= now) {
      const event = this.pendingEvents.shift()!;
      this.options.onBeat(event);
    }
  }

  private scheduleClick(time: number, strong: boolean, countIn: boolean): void {
    const context = this.context;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(strong ? (countIn ? 920 : 780) : 540, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(strong ? 0.23 : 0.08, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => { this.sources.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    this.sources.add(oscillator);
    oscillator.start(time);
    oscillator.stop(time + 0.05);
  }

  private clearScheduled(): void {
    this.scheduleVersion += 1;
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    this.pendingEvents = [];
    for (const source of this.sources) {
      try { source.stop(); } catch { /* source already ended */ }
    }
    this.sources.clear();
  }

  private futureTick(now: number): { tick: number; remaining: number } {
    const pending = this.pendingEvents.find((event) => !event.countIn && event.time > now);
    return pending
      ? { tick: pending.tick, remaining: Math.max(0, pending.time - now) }
      : { tick: this.nextTick, remaining: Math.max(0, this.nextTickTime - now) };
  }

  pause(): void {
    if (this.phase !== 'starting' && this.phase !== 'countIn' && this.phase !== 'playing') return;
    ++this.generation;
    const context = this.context;
    if (context && (this.phase === 'countIn' || this.phase === 'playing')) {
      const now = context.currentTime;
      this.deliverDue(now);
      if (now >= this.practiceOrigin) {
        this.accumulatedSeconds += Math.max(0, now - (this.activeStart ?? this.practiceOrigin));
        const future = this.futureTick(now);
        this.nextTick = future.tick;
        this.remainingToNextTick = future.remaining;
      }
    }
    this.activeStart = null;
    this.clearScheduled();
    this.phase = 'paused';
  }

  stop(): void {
    if (this.phase === 'disposed') return;
    this.pause();
    ++this.generation;
    this.clearScheduled();
    this.phase = 'idle';
    this.activeStart = null;
    this.nextTick = 0;
    this.remainingToNextTick = 0;
  }

  setBpm(bpm: number): void {
    this.assertBpm(bpm);
    if (bpm === this.options.bpm) return;
    const oldDuration = this.tickDuration;
    const context = this.context;
    if (context && (this.phase === 'countIn' || this.phase === 'playing')) {
      const now = context.currentTime;
      this.deliverDue(now);
      const wasPlaying = now >= this.practiceOrigin;
      if (wasPlaying) {
        this.accumulatedSeconds += Math.max(0, now - (this.activeStart ?? this.practiceOrigin));
        const future = this.futureTick(now);
        this.nextTick = future.tick;
        this.clearScheduled();
        this.options.bpm = bpm;
        this.remainingToNextTick = future.remaining / oldDuration * this.tickDuration;
        this.practiceOrigin = now;
        this.activeStart = now;
        this.nextTickTime = now + this.remainingToNextTick;
        this.phase = 'playing';
        this.timer = setInterval(this.schedule, SCHEDULE_INTERVAL_MS);
        this.schedule();
      } else {
        this.remainingToNextTick *= (30 / bpm) / oldDuration;
        this.options.bpm = bpm;
        this.beginCountIn(now);
      }
    } else {
      if (this.phase === 'paused') this.remainingToNextTick *= (30 / bpm) / oldDuration;
      this.options.bpm = bpm;
    }
  }

  setSound(sound: boolean): void {
    this.options.sound = sound;
    if (!sound) {
      for (const source of this.sources) {
        try { source.stop(); } catch { /* source already ended */ }
      }
      this.sources.clear();
    }
  }

  getElapsedSeconds(): number {
    const context = this.context;
    if (context && (this.phase === 'countIn' || this.phase === 'playing') && context.currentTime >= this.practiceOrigin) {
      return this.accumulatedSeconds + Math.max(0, context.currentTime - (this.activeStart ?? this.practiceOrigin));
    }
    return this.accumulatedSeconds;
  }

  async playChord(chord: Chord): Promise<void> {
    if (this.phase === 'disposed') throw new Error('破棄済みの音声エンジンです。');
    const context = this.getContext();
    await context.resume();
    const start = context.currentTime + 0.01;
    chord.frets.forEach((fret, stringIndex) => {
      if (fret < 0) return;
      const time = start + stringIndex * 0.038;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(OPEN_STRING_HZ[stringIndex] * Math.pow(2, fret / 12), time);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(0.07, time + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.1);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.onended = () => { this.sources.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      this.sources.add(oscillator);
      oscillator.start(time);
      oscillator.stop(time + 1.12);
    });
  }

  private interrupt(): void {
    if (this.phase !== 'starting' && this.phase !== 'countIn' && this.phase !== 'playing') return;
    this.pause();
    this.options.onInterrupt();
  }

  private onVisibilityChange = (): void => {
    if (document.hidden) this.interrupt();
  };

  private onAudioStateChange = (): void => {
    if (this.context?.state === 'suspended' || (this.context?.state as string) === 'interrupted') this.interrupt();
  };

  dispose(): void {
    if (this.phase === 'disposed') return;
    this.stop();
    this.phase = 'disposed';
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibilityChange);
    if (this.context) {
      this.context.removeEventListener('statechange', this.onAudioStateChange);
      void this.context.close();
      this.context = null;
    }
  }
}

let previewContext: AudioContext | null = null;
let previewGeneration = 0;
const previewSources = new Set<OscillatorNode>();

/** Play a short synthesized reference chord, replacing any previous preview. */
export async function playChord(chord: Chord): Promise<void> {
  const generation = ++previewGeneration;
  if (!previewContext || previewContext.state === 'closed') previewContext = createAudioContext();
  const context = previewContext;
  await context.resume();
  if (generation !== previewGeneration) return;
  for (const source of previewSources) {
    try { source.stop(); } catch { /* source already ended */ }
  }
  previewSources.clear();
  const start = context.currentTime + 0.01;
  chord.frets.forEach((fret, stringIndex) => {
    if (fret < 0) return;
    const time = start + stringIndex * 0.038;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(OPEN_STRING_HZ[stringIndex] * Math.pow(2, fret / 12), time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.07, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.1);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => { previewSources.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    previewSources.add(oscillator);
    oscillator.start(time);
    oscillator.stop(time + 1.12);
  });
}
