import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PracticeEngine } from './audio';
import type { BeatEvent } from '../domain/types';

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state = 'running';
  destination = {};
  private listeners = new Set<() => void>();
  constructor() { FakeAudioContext.instances.push(this); }
  get currentTime() { return Date.now() / 1000; }
  async resume() { this.state = 'running'; }
  async close() { this.state = 'closed'; }
  addEventListener(_type: string, listener: () => void) { this.listeners.add(listener); }
  removeEventListener(_type: string, listener: () => void) { this.listeners.delete(listener); }
  dispatchState() { for (const listener of this.listeners) listener(); }
  createOscillator() {
    return {
      type: 'sine', frequency: { setValueAtTime() {} }, onended: null as (() => void) | null,
      connect() {}, disconnect() {}, start() {}, stop() {},
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {}, disconnect() {},
    };
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  FakeAudioContext.instances = [];
  vi.stubGlobal('AudioContext', FakeAudioContext);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('PracticeEngine', () => {
  it('uses four count-in beats, keeps eighth-note ticks, and excludes pauses from elapsed time', async () => {
    const beats: BeatEvent[] = [];
    const engine = new PracticeEngine({ bpm: 120, sound: false, onBeat: (event) => beats.push(event), onInterrupt() {} });
    await engine.start();
    expect(engine.getElapsedSeconds()).toBe(0);
    await vi.advanceTimersByTimeAsync(2600);
    expect(beats.filter((event) => event.countIn)).toHaveLength(8);
    expect(beats.filter((event) => !event.countIn).map((event) => event.tick)).toEqual([0, 1, 2]);
    expect(beats[0]).toMatchObject({ beat: 0, subdivision: 0, countIn: true });
    const elapsed = engine.getElapsedSeconds();
    expect(elapsed).toBeGreaterThan(0.5);
    expect(elapsed).toBeLessThan(0.6);
    engine.pause();
    const countAtPause = beats.length;
    await vi.advanceTimersByTimeAsync(3000);
    expect(engine.getElapsedSeconds()).toBeCloseTo(elapsed, 5);
    expect(beats).toHaveLength(countAtPause);
    await engine.resume();
    await vi.advanceTimersByTimeAsync(2600);
    expect(beats.filter((event) => !event.countIn).map((event) => event.tick)).toEqual([0, 1, 2, 3, 4]);
    expect(engine.getElapsedSeconds()).toBeGreaterThan(elapsed + 0.5);
    engine.stop();
    const stoppedElapsed = engine.getElapsedSeconds();
    await vi.advanceTimersByTimeAsync(1000);
    expect(engine.getElapsedSeconds()).toBe(stoppedElapsed);
    engine.dispose();
  });

  it('pauses once when audio is interrupted', async () => {
    const onInterrupt = vi.fn();
    const engine = new PracticeEngine({ bpm: 80, sound: false, onBeat() {}, onInterrupt });
    await engine.start();
    const context = FakeAudioContext.instances[0];
    context.state = 'suspended';
    context.dispatchState();
    context.dispatchState();
    expect(onInterrupt).toHaveBeenCalledTimes(1);
    engine.dispose();
  });

  it('does not schedule further beats if a beat callback pauses the engine', async () => {
    const beats: BeatEvent[] = [];
    let engine: PracticeEngine;
    engine = new PracticeEngine({
      bpm: 120, sound: false,
      onBeat(event) { beats.push(event); engine.pause(); },
      onInterrupt() {},
    });
    await engine.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(beats).toHaveLength(1);
    engine.dispose();
  });

  it('keeps the tick sequence and elapsed clock when tempo changes', async () => {
    const beats: BeatEvent[] = [];
    const engine = new PracticeEngine({ bpm: 120, sound: false, onBeat: (event) => beats.push(event), onInterrupt() {} });
    await engine.start();
    await vi.advanceTimersByTimeAsync(2400);
    const elapsed = engine.getElapsedSeconds();
    engine.setBpm(60);
    expect(engine.getElapsedSeconds()).toBeCloseTo(elapsed, 5);
    await vi.advanceTimersByTimeAsync(1200);
    const ticks = beats.filter((event) => !event.countIn).map((event) => event.tick);
    expect(ticks).toEqual([0, 1, 2, 3]);
    expect(engine.getElapsedSeconds()).toBeGreaterThan(elapsed + 1);
    engine.dispose();
  });
});
