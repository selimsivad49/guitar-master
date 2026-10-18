import type { Backup, ChordId, PracticeRecord, Settings } from '../domain/types';

const DB_NAME = 'guitar-master';
const DB_VERSION = 1;
const RECORDS = 'records';
const SETTINGS = 'settings';
const SETTINGS_KEY = 'current';
const chordIds = new Set<ChordId>(['C', 'D', 'E', 'G', 'A', 'Am', 'Dm', 'Em']);

export const defaultSettings: Settings = { bpm: 80, sound: true, preferredMinutes: 10 };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSettings(value: unknown): value is Settings {
  return isObject(value)
    && Number.isInteger(value.bpm) && (value.bpm as number) >= 40 && (value.bpm as number) <= 160
    && typeof value.sound === 'boolean'
    && (value.preferredMinutes === 5 || value.preferredMinutes === 10 || value.preferredMinutes === 20);
}

function isRecord(value: unknown): value is PracticeRecord {
  return isObject(value)
    && typeof value.id === 'string' && value.id.trim().length > 0
    && typeof value.startedAt === 'string' && Number.isFinite(Date.parse(value.startedAt))
    && typeof value.durationSeconds === 'number' && Number.isFinite(value.durationSeconds) && value.durationSeconds > 0
    && typeof value.planTitle === 'string'
    && Number.isInteger(value.bpm) && (value.bpm as number) >= 40 && (value.bpm as number) <= 160
    && Array.isArray(value.chords) && value.chords.every((chord: unknown) => chordIds.has(chord as ChordId))
    && (value.rating === 'good' || value.rating === 'hard')
    && typeof value.note === 'string'
    && typeof value.completed === 'boolean';
}

function parseBackup(json: string): Backup {
  let value: unknown;
  try { value = JSON.parse(json); }
  catch { throw new Error('バックアップのJSONが壊れています。'); }
  if (!isObject(value) || value.schemaVersion !== 1) {
    throw new Error('対応していないバックアップ形式です。');
  }
  if (typeof value.exportedAt !== 'string' || !Number.isFinite(Date.parse(value.exportedAt))
    || !isSettings(value.settings) || !Array.isArray(value.records)) {
    throw new Error('バックアップの内容が正しくありません。');
  }
  const ids = new Set<string>();
  for (const record of value.records) {
    if (!isRecord(record) || ids.has(record.id)) {
      throw new Error('バックアップに不正または重複した練習記録があります。');
    }
    ids.add(record.id);
  }
  return value as unknown as Backup;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECORDS)) db.createObjectStore(RECORDS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('保存領域を開けません。'));
    request.onblocked = () => reject(new Error('別の画面が保存領域を使用しています。'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('保存に失敗しました。'));
    transaction.onerror = () => reject(transaction.error ?? new Error('保存に失敗しました。'));
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('読み込みに失敗しました。'));
  });
}

async function readSnapshot(): Promise<{ records: PracticeRecord[]; settings: Settings }> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction([RECORDS, SETTINGS], 'readonly');
    const done = transactionDone(transaction);
    const records = requestValue<PracticeRecord[]>(transaction.objectStore(RECORDS).getAll());
    const settings = requestValue<Settings | undefined>(transaction.objectStore(SETTINGS).get(SETTINGS_KEY));
    const [recordValue, settingValue] = await Promise.all([records, settings]);
    await done;
    return { records: recordValue, settings: settingValue ?? { ...defaultSettings } };
  } finally { db.close(); }
}

export async function loadData(): Promise<{ records: PracticeRecord[]; settings: Settings }> {
  return readSnapshot();
}

export async function saveRecord(record: PracticeRecord): Promise<void> {
  if (!isRecord(record)) throw new Error('練習記録の内容が正しくありません。');
  const db = await openDatabase();
  try {
    const transaction = db.transaction(RECORDS, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(RECORDS);
    const request = store.get(record.id);
    request.onsuccess = () => { if (request.result === undefined) store.add(record); };
    await done;
  } finally { db.close(); }
}

export async function saveSettings(settings: Settings): Promise<void> {
  if (!isSettings(settings)) throw new Error('設定の内容が正しくありません。');
  const db = await openDatabase();
  try {
    const transaction = db.transaction(SETTINGS, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(SETTINGS).put(settings, SETTINGS_KEY);
    await done;
  } finally { db.close(); }
}

export async function exportBackup(): Promise<string> {
  const { records, settings } = await readSnapshot();
  const backup: Backup = { schemaVersion: 1, exportedAt: new Date().toISOString(), settings, records };
  return JSON.stringify(backup, null, 2);
}

export async function importBackup(json: string): Promise<number> {
  const backup = parseBackup(json);
  const db = await openDatabase();
  try {
    const transaction = db.transaction([RECORDS, SETTINGS], 'readwrite');
    const done = transactionDone(transaction);
    const records = transaction.objectStore(RECORDS);
    let inserted = 0;
    const keys = records.getAllKeys();
    keys.onsuccess = () => {
      const existing = new Set(keys.result.map(String));
      for (const record of backup.records) {
        if (existing.has(record.id)) continue;
        records.add(record);
        inserted += 1;
      }
      transaction.objectStore(SETTINGS).put(backup.settings, SETTINGS_KEY);
    };
    await done;
    return inserted;
  } finally { db.close(); }
}
