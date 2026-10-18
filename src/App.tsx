import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { BeatEvent, Chord, ChordId, PatternId, PracticePlan, PracticeRecord, Settings, Song } from './domain/types';
import { createDailyPlan, createFreePlan } from './domain/plans';
import { chords, lessons, patterns, songs } from './content/library';
import ChordDiagram from './components/ChordDiagram';
import { PracticeEngine, playChord } from './platform/audio';
import { defaultSettings, exportBackup, importBackup, loadData, saveRecord, saveSettings } from './platform/storage';
import './styles.css';

type Page = 'home' | 'learn' | 'practice' | 'history';
type SessionPhase = 'countin' | 'playing' | 'paused' | 'review';
type Session = {
  id: string;
  plan: PracticePlan;
  startedAt: string;
  bpm: number;
  phase: SessionPhase;
  elapsed: number;
  beat: BeatEvent | null;
  completed: boolean;
};
type IconName = 'home' | 'book' | 'guitar' | 'history' | 'settings' | 'arrow' | 'play' | 'pause' | 'stop' | 'sound' | 'mute' | 'check' | 'download' | 'upload' | 'close' | 'chevron' | 'clock';

const NAV: { id: Page; label: string; icon: IconName }[] = [
  { id: 'home', label: '今日の練習', icon: 'home' },
  { id: 'learn', label: '学ぶ', icon: 'book' },
  { id: 'practice', label: '練習する', icon: 'guitar' },
  { id: 'history', label: '記録', icon: 'history' },
];
const MINUTES = [5, 10, 20] as const;
const ALL_CHORDS: ChordId[] = ['C', 'G', 'Am', 'Em', 'D', 'A', 'E', 'Dm'];
const patternName = (id: PatternId) => patterns.find((p) => p.id === id)?.name ?? id;
const chordById = (id: ChordId) => chords.find((chord) => chord.id === id);
const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
const formatDuration = (seconds: number) => seconds % 60 === 0 ? `${seconds / 60}分` : `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `practice-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function Icon({ name, size = 22, strokeWidth = 1.8 }: { name: IconName; size?: number; strokeWidth?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };
  const path: Record<IconName, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M9 21v-7h6v7" /></>,
    book: <><path d="M4 5.5c3.2-1 5.7-.4 8 1.1 2.3-1.5 4.8-2.1 8-1.1v14c-3.2-1-5.7-.4-8 1.1-2.3-1.5-4.8-2.1-8-1.1z" /><path d="M12 6.6v14" /></>,
    guitar: <><path d="M8.2 15.8c-2.8-2.8-5.8-2.8-6.2.2-.3 2.4 2.2 5 4.8 4.8 3-.2 3.3-3.3 1.4-5z" /><path d="m8 16 7.5-7.5M13.7 7l3.1 3.1M15.5 5.5l3 3M18 6l2.5-2.5 1.5 1.5L19.5 7.5" /><circle cx="5.8" cy="17.3" r=".8" /></>,
    history: <><circle cx="12" cy="12" r="9" /><path d="M12 6.5V12l3.7 2.2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .9 1.6-2 2-.9-.5a8 8 0 0 1-1.5.6l-.3 1.3h-3.2l-.3-1.3a8 8 0 0 1-1.5-.6l-1 .5-2-2 .6-1a8 8 0 0 1-.6-1.5L6.3 14v-3l1.3-.3a8 8 0 0 1 .6-1.5l-.6-1 2-2 1 .6a8 8 0 0 1 1.5-.6l.3-1.3h3.2l.3 1.3a8 8 0 0 1 1.5.6l1-.6 2 2-.6 1a8 8 0 0 1 .6 1.5l1.3.3v3l-1.3.3a8 8 0 0 1-1 1.7Z" transform="translate(-1 -1)" /></>,
    arrow: <><path d="M4 12h16m-7-7 7 7-7 7" /></>,
    play: <path d="m8 5 11 7-11 7z" />,
    pause: <><path d="M8 5v14M16 5v14" /></>,
    stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
    sound: <><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M17 9a5 5 0 0 1 0 6m2-9a9 9 0 0 1 0 12" /></>,
    mute: <><path d="M4 9v6h4l5 4V5L8 9zM17 9l5 6m0-6-5 6" /></>,
    check: <path d="m4 12 5 5L20 6" />,
    download: <><path d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3" /></>,
    upload: <><path d="M12 16V4m-4 4 4-4 4 4M4 17v3h16v-3" /></>,
    close: <path d="M5 5 19 19M19 5 5 19" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  };
  return <svg {...common}>{path[name]}</svg>;
}

function Brand() {
  return <div className="brand"><div className="brand-mark"><span>gm</span><i /></div><div className="brand-word"><strong>guitar master</strong><span>小さな一歩を、毎日の音に。</span></div></div>;
}

function ChordPill({ id }: { id: ChordId }) { return <span className="chord-pill">{id}</span>; }

function ChordCard({ chord, onSound, compact = false }: { chord: Chord; onSound?: (chord: Chord) => void; compact?: boolean }) {
  return <article className={`chord-card ${compact ? 'chord-card--compact' : ''}`}>
    <div className="chord-card-top"><div><span className="eyebrow">CHORD</span><h3>{chord.name}</h3></div>{onSound && <button className="icon-button chord-sound" aria-label={`${chord.name}の合成見本音を鳴らす`} title="合成見本音" onClick={() => onSound(chord)}><Icon name="sound" size={20} /></button>}</div>
    <ChordDiagram chord={chord} compact={compact} />
    {!compact && <p className="chord-tip">{chord.tip}</p>}
  </article>;
}

function SectionTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action}</div>;
}

function App() {
  const [page, setPage] = useState<Page>('home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [rating, setRating] = useState<'good' | 'hard' | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [freeChords, setFreeChords] = useState<ChordId[]>(['C', 'G', 'Am', 'Em']);
  const [freePattern, setFreePattern] = useState<PatternId>('basic');
  const [selectedSong, setSelectedSong] = useState<string | null>(null);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(3);
  const engineRef = useRef<PracticeEngine | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const savedIds = useRef(new Set<string>());
  const savingRef = useRef(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  const modalOpenerRef = useRef<HTMLElement | null>(null);

  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => {
    let mounted = true;
    loadData().then((data) => { if (mounted) { setRecords(data.records); setSettings(data.settings); setStorageReady(true); setReady(true); } }).catch((cause) => { if (mounted) { setError(`記録を読み込めませんでした。${messageOf(cause)}`); setReady(true); } });
    return () => { mounted = false; engineRef.current?.dispose(); engineRef.current = null; };
  }, []);
  useEffect(() => { document.documentElement.dataset.practicing = session ? 'true' : 'false'; return () => { document.documentElement.dataset.practicing = 'false'; }; }, [session?.id]);
  useEffect(() => { if (session?.phase === 'review') engineRef.current?.stop(); }, [session?.phase]);
  useEffect(() => {
    if (!settingsOpen) return;
    modalOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modal = modalRef.current;
    modal?.querySelector<HTMLButtonElement>('.modal-header button')?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') { setSettingsOpen(false); return; }
      if (event.key !== 'Tab' || !modal) return;
      const focusable = Array.from(modal.querySelectorAll<HTMLElement>('button:not([disabled]), select, input:not([disabled]), textarea:not([disabled])')).filter((element) => !element.hidden && element.getAttribute('type') !== 'hidden');
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); modalOpenerRef.current?.focus(); };
  }, [settingsOpen]);
  useEffect(() => {
    if (!session || (session.phase !== 'playing' && session.phase !== 'countin')) return;
    const timer = window.setInterval(() => {
      const seconds = engineRef.current?.getElapsedSeconds() ?? 0;
      setSession((current) => {
        if (!current || current.phase === 'review' || current.phase === 'paused') return current;
        const total = current.plan.steps.reduce((sum, step) => sum + step.seconds, 0);
        if (seconds >= total) {
          return { ...current, elapsed: seconds, phase: 'review', completed: true };
        }
        return { ...current, elapsed: seconds, phase: current.phase === 'countin' && seconds > current.elapsed ? 'playing' : current.phase, beat: current.phase === 'countin' && seconds > current.elapsed ? null : current.beat };
      });
    }, 120);
    return () => window.clearInterval(timer);
  }, [session?.id, session?.phase]);

  const selectedMinutes = settings.preferredMinutes;
  const dailyPlan = useMemo(() => createDailyPlan(selectedMinutes, records), [selectedMinutes, records]);
  const featuredChords = useMemo(() => Array.from(new Set(dailyPlan.steps.flatMap((step) => step.chords))).slice(0, 4) as ChordId[], [dailyPlan]);
  const chosenSong = songs.find((song) => song.id === selectedSong) ?? null;
  const minutesPracticed = Math.floor(records.reduce((sum, record) => sum + record.durationSeconds, 0) / 60);
  const practiceDays = new Set(records.filter((r) => r.durationSeconds > 0).map((r) => new Date(r.startedAt).toLocaleDateString('ja-JP'))).size;

  function messageOf(cause: unknown) { return cause instanceof Error ? cause.message : String(cause); }
  function reportError(prefix: string, cause: unknown) { setError(`${prefix} ${messageOf(cause)}`); }
  async function retryLoad() {
    try { const data = await loadData(); setRecords(data.records); setSettings(data.settings); setStorageReady(true); setError(''); }
    catch (cause) { reportError('記録を読み込めませんでした。', cause); }
  }
  async function updateSettings(next: Settings) {
    if (!storageReady) return;
    setSettings(next);
    engineRef.current?.setSound(next.sound);
    if (sessionRef.current && sessionRef.current.bpm !== next.bpm) {
      engineRef.current?.setBpm(next.bpm);
      setSession((current) => current ? { ...current, bpm: next.bpm } : current);
    }
    try { await saveSettings(next); setError(''); } catch (cause) { reportError('設定を保存できませんでした。', cause); }
  }
  function changePage(next: Page) {
    if (sessionRef.current && (sessionRef.current.phase === 'playing' || sessionRef.current.phase === 'countin')) pausePractice();
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function openSettings() { if (sessionRef.current && (sessionRef.current.phase === 'playing' || sessionRef.current.phase === 'countin')) pausePractice(); setSettingsOpen(true); }
  async function playExample(chord: Chord) { try { await playChord(chord); } catch (cause) { reportError('見本音を再生できませんでした。', cause); } }
  async function startPractice(plan: PracticePlan, bpm = settings.bpm) {
    if (!storageReady || sessionRef.current || !plan.steps.length) return;
    setError(''); setNotice(''); setRating(null); setNote('');
    const id = makeId();
    const next: Session = { id, plan, startedAt: new Date().toISOString(), bpm, phase: 'countin', elapsed: 0, beat: null, completed: false };
    sessionRef.current = next;
    setSession(next); setPage('practice');
    const engine = new PracticeEngine({
      bpm, sound: settings.sound,
      onBeat: (beat) => setSession((current) => current?.id === id && current.phase !== 'review' && current.phase !== 'paused' ? { ...current, beat, phase: beat.countIn ? 'countin' : 'playing' } : current),
      onInterrupt: () => { engineRef.current?.pause(); setSession((current) => current?.id === id && current.phase !== 'review' ? { ...current, phase: 'paused', elapsed: engineRef.current?.getElapsedSeconds() ?? current.elapsed } : current); },
    });
    engineRef.current = engine;
    try { await engine.start(); } catch (cause) { engine.dispose(); engineRef.current = null; sessionRef.current = null; setSession(null); reportError('練習を開始できませんでした。', cause); }
  }
  function pausePractice() {
    engineRef.current?.pause();
    setSession((current) => current && current.phase !== 'review' ? { ...current, phase: 'paused', elapsed: engineRef.current?.getElapsedSeconds() ?? current.elapsed } : current);
  }
  async function resumePractice() {
    const current = sessionRef.current;
    if (!current || current.phase !== 'paused') return;
    setError(''); setSession({ ...current, phase: 'countin', beat: null });
    try { await engineRef.current?.resume(); } catch (cause) { setSession((value) => value ? { ...value, phase: 'paused' } : value); reportError('練習を再開できませんでした。', cause); }
  }
  function finishPractice() {
    const current = sessionRef.current;
    if (!current || current.phase === 'review') return;
    const seconds = engineRef.current?.getElapsedSeconds() ?? current.elapsed;
    engineRef.current?.stop();
    if (seconds < 1) { clearSession(); setNotice('練習時間が1秒未満のため、記録は保存しませんでした。'); return; }
    const total = current.plan.steps.reduce((sum, step) => sum + step.seconds, 0);
    setSession({ ...current, phase: 'review', elapsed: seconds, completed: seconds >= total });
  }
  function clearSession() { engineRef.current?.dispose(); engineRef.current = null; sessionRef.current = null; setSession(null); document.documentElement.dataset.practicing = 'false'; }
  async function commitRecord() {
    const current = sessionRef.current;
    if (!storageReady || !current || !rating || current.elapsed < 1 || savedIds.current.has(current.id) || savingRef.current) return;
    savingRef.current = true; setSaving(true);
    let remaining = current.elapsed;
    const practicedSteps = current.plan.steps.filter((step) => { const included = remaining > 0; remaining -= step.seconds; return included; });
    const record: PracticeRecord = { id: current.id, startedAt: current.startedAt, durationSeconds: Math.floor(current.elapsed), planTitle: current.plan.title, bpm: current.bpm, chords: Array.from(new Set(practicedSteps.flatMap((step) => step.chords))) as ChordId[], rating, note: note.trim(), completed: current.completed };
    try {
      await saveRecord(record);
      savedIds.current.add(current.id);
      setRecords((prior) => [record, ...prior]);
      clearSession(); setPage('history'); setNotice('練習を記録しました。今日もおつかれさま！'); setError('');
    } catch (cause) { reportError('練習記録を保存できませんでした。', cause); }
    finally { savingRef.current = false; setSaving(false); }
  }
  async function downloadBackup() {
    if (!storageReady) return;
    try {
      const json = await exportBackup();
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `guitar-master-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('バックアップを書き出しました。'); setError('');
    } catch (cause) { reportError('バックアップを書き出せませんでした。', cause); }
  }
  async function restoreBackup(file: File | undefined) {
    if (!file || !storageReady || sessionRef.current) return;
    try {
      const count = await importBackup(await file.text());
      const loaded = await loadData();
      setRecords(loaded.records); setSettings(loaded.settings); setNotice(`${count}件の記録を取り込みました。`); setError('');
    } catch (cause) { reportError('バックアップを取り込めませんでした。', cause); }
    finally { if (uploadRef.current) uploadRef.current.value = ''; }
  }
  function toggleFreeChord(id: ChordId) { setFreeChords((current) => current.includes(id) ? current.length > 1 ? current.filter((item) => item !== id) : current : [...current, id]); }
  function selectSong(song: Song) { setSelectedSong(song.id); setLoopStart(0); setLoopEnd(song.chords.length - 1); }
  function startSong(song: Song) { const segment = song.chords.slice(loopStart, loopEnd + 1); startPractice(createFreePlan(segment, song.pattern, `${song.title} · 区間ループ`), song.bpm); }

  if (!ready) return <div className="loading-screen"><Brand /><div className="loading-ring" /><p>練習ノートを開いています…</p></div>;

  return <div className="app-shell">
    <aside className="sidebar"><Brand /><nav className="side-nav" aria-label="メインナビゲーション">{NAV.map((item) => <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => changePage(item.id)}><Icon name={item.icon} /><span>{item.label}</span>{page === item.id && <span className="nav-dot" />}</button>)}</nav><div className="sidebar-bottom"><div className="sidebar-quote">“昨日より、ひとつ<br />きれいな音を。”<span>YOUR DAILY PRACTICE NOTE</span></div><button className="nav-item settings-link" onClick={openSettings}><Icon name="settings" /><span>設定・バックアップ</span></button></div></aside>
    <div className="main-area"><header className="topbar"><div className="mobile-brand"><Brand /></div><div className="topbar-breadcrumb"><span>MY PRACTICE JOURNAL</span><Icon name="chevron" size={14} /><strong>{NAV.find((item) => item.id === page)?.label}</strong></div><div className="topbar-actions"><span className="date-label">{new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date())}</span><button className="icon-button settings-top" aria-label="設定・バックアップを開く" onClick={openSettings}><Icon name="settings" size={21} /></button></div></header>
      <main className="content">
        {error && <div role="alert" className="message message--error"><span>{error}</span>{!storageReady && <button className="retry-link" onClick={retryLoad}>再試行</button>}{storageReady && <button aria-label="閉じる" onClick={() => setError('')}><Icon name="close" size={17} /></button>}</div>}
        {notice && <div role="status" className="message message--success"><Icon name="check" size={18} /><span>{notice}</span><button aria-label="閉じる" onClick={() => setNotice('')}><Icon name="close" size={17} /></button></div>}
        {session && page !== 'practice' && <div className="session-reminder"><span>{session.phase === 'review' ? '練習が終わりました。記録を保存しましょう。' : '練習を一時停止しています。'}</span><button onClick={() => changePage('practice')}>{session.phase === 'review' ? '記録へ戻る' : '練習へ戻る'} <Icon name="arrow" size={15} /></button></div>}
        {page === 'home' && <>
          <div className="page-intro"><span className="eyebrow">TODAY'S PRACTICE</span><h1>今日の練習</h1><p>ギターに触れる、その一歩から。今日も自分のペースで始めましょう。</p></div>
          <section className="hero"><div className="hero-copy"><span className="hero-label"><span className="hero-sparkle">✳</span> YOUR DAILY ROUTINE</span><h2>今日の一音が、<br /><em>明日の自信に。</em></h2><p>短い時間でも大丈夫。基本のコードを少しずつ、心地よいリズムでつないでいきましょう。</p><div className="hero-actions"><button className="button button--dark" onClick={() => startPractice(dailyPlan)} disabled={!!session || !storageReady}><Icon name="play" size={18} /> 今日の練習をはじめる <Icon name="arrow" size={18} /></button><span><Icon name="clock" size={16} /> 約{selectedMinutes}分</span></div></div><div className="hero-art" aria-hidden="true"><div className="art-circle art-circle--one" /><div className="art-circle art-circle--two" /><div className="art-ring">♪</div><div className="art-card art-card--back">D</div><div className="art-card art-card--front"><span>今日のコード</span><strong>{featuredChords[0] ?? 'C'}</strong><i>♩ ♩ ♪ ♪</i></div><div className="art-line" /></div></section>
          <div className="stats-row"><div className="stat"><span className="stat-icon"><Icon name="history" size={21} /></span><div><strong>{practiceDays}<small>日</small></strong><span>練習した日</span></div></div><div className="stat"><span className="stat-icon"><Icon name="clock" size={21} /></span><div><strong>{minutesPracticed}<small>分</small></strong><span>これまでの練習</span></div></div><div className="stat stat-note"><span className="stat-icon">✳</span><p>続けるコツは、<br /><strong>短くても、毎日触れること。</strong></p></div></div>
          <section className="section"><SectionTitle eyebrow="CHOOSE YOUR PACE" title="今日のペースを選ぶ" /><div className="duration-row">{MINUTES.map((minutes) => <button key={minutes} className={`duration-option ${selectedMinutes === minutes ? 'selected' : ''}`} disabled={!storageReady} onClick={() => updateSettings({ ...settings, preferredMinutes: minutes })} aria-pressed={selectedMinutes === minutes}><span className="duration-time">{minutes}<small>分</small></span><span>{minutes === 5 ? '気軽にひと弾き' : minutes === 10 ? 'いつもの練習' : 'じっくり上達'}</span>{selectedMinutes === minutes && <span className="duration-check"><Icon name="check" size={14} /></span>}</button>)}</div></section>
          <section className="section"><SectionTitle eyebrow="YOUR PRACTICE PLAN" title="このメニューで練習" /><div className="plan-list">{dailyPlan.steps.map((step, index) => <div className="plan-step" key={step.id}><span className="step-number">{String(index + 1).padStart(2, '0')}</span><div className="step-copy"><h3>{step.title}</h3><p>{step.instruction}</p><div className="step-chords">{step.chords.map((id) => <ChordPill id={id} key={id} />)}</div></div><span className="step-duration">{formatDuration(step.seconds)}</span></div>)}</div></section>
          <section className="section"><SectionTitle eyebrow="TODAY'S CHORDS" title="今日使うコード" action={<button className="text-link" onClick={() => changePage('learn')}>すべて見る <Icon name="arrow" size={16} /></button>} /><div className="chord-grid">{featuredChords.map((id) => { const chord = chordById(id); return chord ? <ChordCard key={id} chord={chord} compact onSound={playExample} /> : null; })}</div><p className="helper-text">見本音はギターの録音ではなく合成音です。図は左が6弦、右が1弦です。</p></section>
        </>}
        {page === 'learn' && <><div className="page-intro"><span className="eyebrow">LEARN THE BASICS</span><h1>学ぶ</h1><p>はじめての音から、少しずつ。気になるところをいつでも読み返せます。</p></div><SectionTitle eyebrow="THE ESSENTIALS" title="基礎からはじめる" /><div className="lesson-grid">{lessons.map((lesson, index) => <article className={`lesson-card ${selectedLesson === lesson.id ? 'expanded' : ''}`} key={lesson.id}><button onClick={() => setSelectedLesson(selectedLesson === lesson.id ? null : lesson.id)} aria-expanded={selectedLesson === lesson.id}><span className="lesson-index">{String(index + 1).padStart(2, '0')}</span><span className="lesson-title"><span className="eyebrow">{lesson.eyebrow}</span><strong>{lesson.title}</strong><small>{lesson.minutes}分で読める</small></span><span className="lesson-arrow"><Icon name="arrow" size={19} /></span></button>{selectedLesson === lesson.id && <div className="lesson-body">{lesson.paragraphs.map((text, i) => <p key={i}>{text}</p>)}<div className="lesson-takeaway"><strong>覚えておこう</strong><p>{lesson.takeaway}</p></div></div>}</article>)}</div><section className="section"><SectionTitle eyebrow="CHORD LIBRARY" title="8つの基本コード" /><p className="section-description">「×」は弾かない弦、「○」は押さえずに弾く開放弦。図は左から6弦、右へ1弦です。</p><div className="chord-grid chord-grid--all">{chords.map((chord) => <ChordCard key={chord.id} chord={chord} onSound={playExample} />)}</div><p className="helper-text">見本音は合成音です。実際のギターとは音色が異なります。</p></section></>}
        {page === 'practice' && (session ? renderSession() : renderPracticePicker())}
        {page === 'history' && <><div className="page-intro"><span className="eyebrow">YOUR JOURNEY</span><h1>練習の記録</h1><p>一回ずつの積み重ねが、あなたの音になります。</p></div><div className="history-summary"><div><span>合計練習時間</span><strong>{Math.floor(records.reduce((sum, r) => sum + r.durationSeconds, 0) / 3600)}<small>時間</small> {minutesPracticed % 60}<small>分</small></strong></div><div><span>練習した日</span><strong>{practiceDays}<small>日</small></strong></div><div><span>練習した回数</span><strong>{records.length}<small>回</small></strong></div></div><section className="section"><SectionTitle eyebrow="PRACTICE LOG" title="これまでの練習" action={<button className="text-link" onClick={openSettings}>バックアップ <Icon name="arrow" size={16} /></button>} />{records.length === 0 ? <div className="empty-state"><span>♪</span><h3>最初の一歩を記録しよう</h3><p>練習を終えると、ここに記録が並びます。</p><button className="button button--dark" onClick={() => changePage('home')}>今日の練習を見る <Icon name="arrow" size={17} /></button></div> : <div className="record-list">{[...records].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).map((record) => <article className="record-card" key={record.id}><div className="record-date"><strong>{new Date(record.startedAt).getDate()}</strong><span>{new Intl.DateTimeFormat('ja-JP', { month: 'short' }).format(new Date(record.startedAt))}</span></div><div className="record-main"><div><h3>{record.planTitle}</h3><span className={`rating-badge ${record.rating === 'hard' ? 'rating-badge--hard' : ''}`}>{record.rating === 'good' ? 'できた' : 'まだ難しい'}</span></div><p>{formatTime(record.durationSeconds)} · {record.bpm} BPM · {record.completed ? '完了' : '途中まで'}</p><div className="step-chords">{record.chords.map((id) => <ChordPill id={id} key={id} />)}</div>{record.note && <p className="record-note">“{record.note}”</p>}</div></article>)}</div>}</section></>}
      </main><footer className="footer">GUITAR MASTER <span>·</span> A LITTLE PRACTICE, EVERY DAY</footer>
    </div>
    <nav className="bottom-nav" aria-label="メインナビゲーション">{NAV.map((item) => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => changePage(item.id)}><Icon name={item.icon} size={22} /><span>{item.label}</span></button>)}</nav>
    {settingsOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}><section ref={modalRef} className="settings-modal" role="dialog" aria-modal="true" aria-label="設定・バックアップ"><div className="modal-header"><div><span className="eyebrow">PREFERENCES</span><h2>設定・バックアップ</h2></div><button className="icon-button" aria-label="閉じる" onClick={() => setSettingsOpen(false)}><Icon name="close" /></button></div><div className="modal-body"><div className="setting-row"><div><strong>基本のテンポ</strong><p>練習中にも調整できます。</p></div><div className="tempo-control"><button aria-label="テンポを5下げる" disabled={!storageReady} onClick={() => updateSettings({ ...settings, bpm: Math.max(40, settings.bpm - 5) })}>−</button><span>{settings.bpm} <small>BPM</small></span><button aria-label="テンポを5上げる" disabled={!storageReady} onClick={() => updateSettings({ ...settings, bpm: Math.min(160, settings.bpm + 5) })}>＋</button></div></div><div className="setting-row"><div><strong>拍の音</strong><p>メトロノームの音を鳴らす</p></div><button className={`toggle ${settings.sound ? 'on' : ''}`} role="switch" aria-checked={settings.sound} aria-label="拍の音" disabled={!storageReady} onClick={() => updateSettings({ ...settings, sound: !settings.sound })}><span /></button></div><div className="backup-box"><span className="eyebrow">YOUR DATA</span><h3>練習記録を持ち運ぶ</h3><p>記録と設定をJSONファイルに保存できます。取り込み時は同じIDの記録を重複させません。</p><div className="backup-actions"><button className="button button--outline" disabled={!storageReady} onClick={downloadBackup}><Icon name="download" size={18} /> 書き出す</button><button className="button button--outline" disabled={!storageReady || !!session} onClick={() => uploadRef.current?.click()}><Icon name="upload" size={18} /> 読み込む</button><input ref={uploadRef} type="file" accept=".json,application/json" hidden onChange={(event) => restoreBackup(event.target.files?.[0])} /></div></div><p className="settings-footnote">記録はこの端末のブラウザーに保存されます。大切な記録は定期的に書き出してください。</p></div></section></div>}
  </div>;

  function renderPracticePicker() {
    return <><div className="page-intro"><span className="eyebrow">MAKE SOME MUSIC</span><h1>練習する</h1><p>今日のメニューでも、好きなコードや曲でも。弾きたい気分に合わせて選びましょう。</p></div><section className="practice-feature"><div><span className="eyebrow">RECOMMENDED</span><h2>今日のメニューを弾く</h2><p>{selectedMinutes}分で、基礎からコードチェンジまでひととおり。</p><div className="step-chords">{featuredChords.map((id) => <ChordPill id={id} key={id} />)}</div></div><button className="button button--dark" disabled={!storageReady} onClick={() => startPractice(dailyPlan)}><Icon name="play" size={18} /> 練習を始める <Icon name="arrow" size={18} /></button></section><section className="section"><SectionTitle eyebrow="FREE PRACTICE" title="自由に練習する" /><p className="section-description">練習したいコードを選んで、5分間のループを作ります。</p><div className="free-panel"><div className="free-panel-group"><strong>コードを選ぶ</strong><div className="choice-chords">{ALL_CHORDS.map((id) => <button key={id} className={freeChords.includes(id) ? 'chosen' : ''} aria-pressed={freeChords.includes(id)} onClick={() => toggleFreeChord(id)}>{id}</button>)}</div></div><div className="free-panel-group"><strong>リズムを選ぶ</strong><div className="pattern-options">{patterns.map((pattern) => <button key={pattern.id} className={freePattern === pattern.id ? 'chosen' : ''} aria-pressed={freePattern === pattern.id} onClick={() => setFreePattern(pattern.id)}><span>{pattern.name}</span><small>{pattern.description}</small></button>)}</div></div><button className="button button--accent" disabled={!storageReady} onClick={() => startPractice(createFreePlan(freeChords, freePattern, '自由練習'))}><Icon name="play" size={18} /> 自由練習を始める <Icon name="arrow" size={18} /></button></div></section><section className="section"><SectionTitle eyebrow="PLAY A SONG" title="小さな練習曲" /><p className="section-description">オリジナルの短い練習曲。好きな区間を選んで、何度でも繰り返せます。</p><div className="song-grid">{songs.map((song, index) => <button className={`song-card ${selectedSong === song.id ? 'selected' : ''}`} key={song.id} onClick={() => selectSong(song)}><span className="song-number">SONG {String(index + 1).padStart(2, '0')}</span><span className="song-glyph">{index === 1 ? '♫' : '♪'}</span><strong>{song.title}</strong><small>{song.subtitle}</small><span className="song-footer">{song.bpm} BPM <span>·</span> {song.chords.length}コード <Icon name="arrow" size={17} /></span></button>)}</div>{chosenSong && <div className="song-detail"><div className="song-detail-heading"><div><span className="eyebrow">SECTION LOOP</span><h3>{chosenSong.title}の区間を選ぶ</h3></div><button className="icon-button" aria-label="曲の選択を閉じる" onClick={() => setSelectedSong(null)}><Icon name="close" size={18} /></button></div><div className="song-progressions">{chosenSong.chords.map((id, index) => <span className={index >= loopStart && index <= loopEnd ? 'in-loop' : ''} key={`${id}-${index}`}>{id}</span>)}</div><div className="loop-controls"><label>はじめ <select value={loopStart} onChange={(event) => setLoopStart(Math.min(Number(event.target.value), loopEnd))}>{chosenSong.chords.map((id, i) => <option key={i} value={i}>{i + 1} · {id}</option>)}</select></label><label>おわり <select value={loopEnd} onChange={(event) => setLoopEnd(Math.max(Number(event.target.value), loopStart))}>{chosenSong.chords.map((id, i) => <option key={i} value={i}>{i + 1} · {id}</option>)}</select></label><button className="button button--accent" disabled={!storageReady} onClick={() => startSong(chosenSong)}><Icon name="play" size={18} /> この区間を練習</button></div><p>選んだ区間を5分間繰り返します。リズム: {patternName(chosenSong.pattern)}</p></div>}</section></>;
  }

  function renderSession() {
    if (!session) return null;
    const total = session.plan.steps.reduce((sum, step) => sum + step.seconds, 0);
    let accumulated = 0;
    let stepIndex = session.plan.steps.length - 1;
    for (let i = 0; i < session.plan.steps.length; i++) { accumulated += session.plan.steps[i].seconds; if (session.elapsed < accumulated) { stepIndex = i; break; } }
    const step = session.plan.steps[stepIndex];
    const stepStart = accumulated - step.seconds;
    const chordTick = session.beat?.countIn ? 0 : session.beat?.tick ?? 0;
    const chordIndex = step.chords.length ? Math.floor(chordTick / 8) % step.chords.length : 0;
    const currentChord = step.chords[chordIndex];
    const nextChord = step.chords.length ? step.chords[(chordIndex + 1) % step.chords.length] : undefined;
    const currentPattern = patterns.find((pattern) => pattern.id === step.pattern);
    const strokeIndex = session.beat ? session.beat.tick % (currentPattern?.strokes.length ?? 1) : 0;
    const stroke = currentPattern?.strokes[strokeIndex];
    const count = session.beat?.countIn ? session.beat.beat + 1 : 0;
    return <><div className="practice-top"><button className="back-link" onClick={() => changePage('home')}><Icon name="arrow" size={16} /> メニューに戻る</button><span className={`live-pill ${session.phase === 'paused' ? 'paused' : ''}`}><i /> {session.phase === 'countin' ? 'カウントイン' : session.phase === 'playing' ? '練習中' : session.phase === 'paused' ? '一時停止中' : 'おつかれさま'}</span></div><div className="practice-header"><span className="eyebrow">NOW PRACTICING</span><h1>{session.plan.title}</h1><p>{step.title} — {step.instruction}</p></div>{session.phase === 'review' ? <div className="review-panel"><div className="review-icon">✳</div><h2>今日も、いい練習でした。</h2><p>{formatTime(session.elapsed)}の練習を記録しましょう。弾いてみてどうでしたか？</p><div className="review-rating"><button className={rating === 'good' ? 'selected' : ''} onClick={() => setRating('good')} aria-pressed={rating === 'good'}><span>◎</span><strong>できた</strong><small>手ごたえがあった</small></button><button className={rating === 'hard' ? 'selected' : ''} onClick={() => setRating('hard')} aria-pressed={rating === 'hard'}><span>↗</span><strong>まだ難しい</strong><small>次も練習したい</small></button></div><label className="note-label">ひとことメモ <span>任意</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="押さえ方のコツ、気づいたことなど…" maxLength={500} /></label><div className="review-actions"><button className="button button--dark" disabled={!rating || saving} onClick={commitRecord}><Icon name="check" size={18} /> {saving ? "保存中…" : "記録を保存する"}</button><button className="button button--quiet" disabled={saving} onClick={() => { clearSession(); setPage('home'); }}>保存せず戻る</button></div></div> : <><div className="session-layout"><div className="session-primary"><div className="session-timer"><div className="timer-top"><span>練習時間</span><span>{Math.min(100, Math.round(session.elapsed / total * 100))}%</span></div><strong>{formatTime(session.elapsed)} <small>/ {formatTime(total)}</small></strong><div className="progress-track"><span style={{ width: `${Math.min(100, session.elapsed / total * 100)}%` }} /></div></div><div className="now-chord"><div className="now-chord-head"><span className="eyebrow">PLAY THIS CHORD</span><span>いま弾くコード</span></div>{currentChord && chordById(currentChord) && <><div className="now-chord-main"><strong>{currentChord}</strong><ChordDiagram chord={chordById(currentChord)!} /></div><p>左が6弦、右が1弦。力を抜いて、ゆっくり。</p></>}</div><div className="next-chord"><div><span>次のコード</span><strong>{nextChord ?? '—'}</strong></div><p>{session.beat?.countIn ? 'カウントインのあとに始まります' : `あと ${(8 - chordTick % 8) / 2} 拍で切り替え`}</p><Icon name="arrow" /></div></div><div className="session-secondary"><div className="beat-card"><span className="eyebrow">KEEP THE RHYTHM</span><h2>{session.phase === 'countin' ? 'もうすぐ始まります' : session.phase === 'paused' ? 'ひと休み' : 'リズムにのって'}</h2><div className="beat-bubbles">{[1, 2, 3, 4].map((beat) => <span key={beat} className={session.beat && session.beat.beat + 1 === beat && session.phase !== 'paused' ? 'active' : ''}>{beat}</span>)}</div><div className="stroke-display"><span>{session.phase === 'countin' ? `準備の拍 ${count} / 4` : session.phase === 'paused' ? '再開すると4拍で始まります' : '今のストローク'}</span><strong>{session.phase === 'countin' ? count || '♪' : session.phase === 'paused' ? '—' : stroke === 'down' ? '↓' : stroke === 'up' ? '↑' : '・'}</strong><small>{session.phase === 'countin' ? '4拍のあとに練習開始' : stroke === 'down' ? 'ダウン' : stroke === 'up' ? 'アップ' : 'おやすみ'}</small></div><div className="pattern-strip">{currentPattern?.strokes.map((direction, i) => <span className={session.phase === 'playing' && i === strokeIndex ? 'active' : ''} key={i}>{direction === 'down' ? '↓' : direction === 'up' ? '↑' : '・'}</span>)}</div><p>4/4拍子 · {patternName(step.pattern)}{step.pattern !== 'quarters' ? ' · 8分刻み' : ''}</p></div><div className="session-step"><span className="eyebrow">CURRENT STEP</span><strong>{String(stepIndex + 1).padStart(2, '0')} <small>/ {String(session.plan.steps.length).padStart(2, '0')}</small></strong><h3>{step.title}</h3><p>{step.instruction}</p><div className="progress-track"><span style={{ width: `${Math.min(100, Math.max(0, (session.elapsed - stepStart) / step.seconds * 100))}%` }} /></div></div></div></div><div className="practice-controls"><div className="bpm-control"><span>テンポ</span><button aria-label="テンポを5下げる" disabled={session.bpm <= 40} onClick={() => changeTempo(Math.max(40, session.bpm - 5))}>−</button><strong>{session.bpm} <small>BPM</small></strong><button aria-label="テンポを5上げる" disabled={session.bpm >= 160} onClick={() => changeTempo(Math.min(160, session.bpm + 5))}>＋</button></div><div className="main-controls"><button className="button button--outline" onClick={finishPractice}><Icon name="stop" size={18} /> 終了する</button><button className="button button--dark" onClick={session.phase === 'paused' ? resumePractice : pausePractice}><Icon name={session.phase === 'paused' ? 'play' : 'pause'} size={19} /> {session.phase === 'paused' ? '再開する' : '一時停止'}</button></div></div><p className="session-footnote">画面を離れたり、端末がスリープすると自動で一時停止します。再開時は4拍のカウントインがあります。</p></>}</>;
  }
  function changeTempo(bpm: number) { engineRef.current?.setBpm(bpm); setSession((current) => current ? { ...current, bpm } : current); }
}

export default App;
