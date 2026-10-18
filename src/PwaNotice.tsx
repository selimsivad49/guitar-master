import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function PwaNotice() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [minimized, setMinimized] = useState(false);
  const { offlineReady: [offlineReady, setOfflineReady], needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisterError() { setError('オフライン準備に失敗しました。接続を確認して再読み込みしてください。'); },
  });
  useEffect(() => {
    const sync = () => setBusy(document.documentElement.dataset.practicing === 'true');
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-practicing'] });
    return () => observer.disconnect();
  }, []);
  if (busy || (!offlineReady && !needRefresh && !error)) return null;
  return <aside aria-label="アプリの更新" role="status" style={{ position: 'fixed', zIndex: 90, bottom: 'calc(88px + env(safe-area-inset-bottom))', right: 16, left: 'auto', maxWidth: 'min(390px, calc(100vw - 32px))', padding: '16px 20px', background: '#fffdf7', border: '1px solid #d8cabc', boxShadow: '0 8px 30px #30291d20', borderRadius: 14, color: '#342c24', fontSize: 14 }}>
    {needRefresh && minimized && !error ? <button onClick={() => setMinimized(false)}>更新があります</button> : <>
    <p style={{ margin: '0 0 12px' }}>{error || (needRefresh ? '新しいバージョンが使えます。保存を終えてから更新してください。' : 'オフラインで練習できる準備ができました。')}</p>
    <div style={{ display: 'flex', gap: 12 }}>
      {needRefresh && <button onClick={() => { if (document.documentElement.dataset.practicing !== 'true') void updateServiceWorker(true).catch(() => setError('更新に失敗しました。接続を確認してください。')); }}>更新する</button>}
      <button onClick={() => { setOfflineReady(false); setMinimized(true); setError(''); }}>{needRefresh ? 'あとで' : '閉じる'}</button>
    </div>
    </>}
  </aside>;
}
