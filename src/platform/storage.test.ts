import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { defaultSettings, exportBackup, importBackup, loadData, saveRecord, saveSettings } from './storage';
import type { PracticeRecord } from '../domain/types';

const record: PracticeRecord = {
  id: 'session-1', startedAt: '2026-09-23T00:00:00.000Z', durationSeconds: 41.5,
  planTitle: '自由練習', bpm: 80, chords: ['C', 'G'], rating: 'hard', note: '', completed: false,
};

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('guitar-master');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

beforeEach(deleteDatabase);

describe('IndexedDB storage', () => {
  it('persists settings and saves a session ID once', async () => {
    expect((await loadData()).settings).toEqual(defaultSettings);
    await saveRecord(record);
    await saveRecord({ ...record, note: 'duplicate' });
    await saveSettings({ bpm: 92, sound: false, preferredMinutes: 5 });
    expect(await loadData()).toEqual({
      records: [record], settings: { bpm: 92, sound: false, preferredMinutes: 5 },
    });
  });

  it('exports and merges with existing IDs taking priority', async () => {
    await saveRecord(record);
    const backup = JSON.parse(await exportBackup());
    backup.records = [{ ...record, note: 'should not overwrite' }, { ...record, id: 'session-2' }];
    backup.settings = { bpm: 100, sound: false, preferredMinutes: 20 };
    expect(await importBackup(JSON.stringify(backup))).toBe(1);
    const data = await loadData();
    expect(data.records).toHaveLength(2);
    expect(data.records.find((item) => item.id === record.id)).toEqual(record);
    expect(data.settings).toEqual(backup.settings);
  });

  it('rejects invalid content without changing records or settings', async () => {
    await saveRecord(record);
    const backup = JSON.parse(await exportBackup());
    backup.settings.bpm = 120;
    backup.records.push({ ...record, id: 'new-session', durationSeconds: -1 });
    await expect(importBackup(JSON.stringify(backup))).rejects.toThrow();
    expect(await loadData()).toEqual({ records: [record], settings: defaultSettings });
    await expect(importBackup('{bad json')).rejects.toThrow();
    await expect(importBackup(JSON.stringify({ ...backup, schemaVersion: 2 }))).rejects.toThrow();
  });
});
