import { test, expect, type Page } from '@playwright/test';

async function goTo(page: Page, name: string) {
  await page.getByRole('navigation').filter({ visible: true }).getByRole('button', { name, exact: true }).click();
}

async function openSettings(page: Page) {
  await page.getByRole('button', { name: '設定・バックアップを開く', exact: true }).click();
  return page.getByRole('dialog', { name: '設定・バックアップ' });
}

test('教材・コード・練習曲をモバイルでも横スクロールなしに使える', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '今日の練習', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
  await goTo(page, '学ぶ');
  await page.getByRole('button', { name: /コード図の読み方/ }).click();
  await expect(page.getByText('太いナットの次から1フレット。弦の×・○も確認します。')).toBeVisible();
  await expect(page.locator('.chord-card')).toHaveCount(8);
  if (await page.evaluate(() => typeof AudioContext !== 'undefined')) {
    await page.getByRole('button', { name: 'Cの合成見本音を鳴らす', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  await goTo(page, '練習する');
  await page.getByRole('button', { name: /朝の窓辺/ }).click();
  await expect(page.getByRole('heading', { name: '朝の窓辺の区間を選ぶ' })).toBeVisible();
  await page.getByLabel('はじめ', { exact: false }).selectOption('1');
  await page.getByLabel('おわり', { exact: false }).selectOption('2');
  await expect(page.locator('.song-progressions .in-loop')).toHaveText(['G', 'C']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('実音声エンジンで開始・中断・再開し一重に保存する', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  test.skip(!(await page.evaluate(() => typeof AudioContext !== 'undefined')), 'このWindows WebKitビルドにはAudioContextがない。音声の実機検証は別途必要。');
  await page.getByRole('button', { name: '今日の練習をはじめる', exact: true }).click();
  await expect(page.locator('.live-pill')).toContainText('練習中');
  await expect(page.locator('.session-timer > strong')).toContainText('00:02', { timeout: 12_000 });
  await page.screenshot({ path: testInfo.outputPath('practice.png'), fullPage: true });
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  const time = await page.locator('.session-timer > strong').textContent();
  await page.waitForTimeout(1200); // Check elapsed time is frozen across real wall-clock time.
  expect(await page.locator('.session-timer > strong').textContent()).toBe(time);
  await expect(page.locator('html')).toHaveAttribute('data-practicing', 'true');
  await goTo(page, '学ぶ');
  await goTo(page, '練習する');
  await expect(page.getByRole('button', { name: '再開する' })).toBeVisible();
  await page.getByRole('button', { name: '再開する' }).click();
  await expect(page.locator('.live-pill')).toContainText('練習中');
  await page.getByRole('button', { name: '終了する', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今日も、いい練習でした。' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-practicing', 'true');
  await page.getByRole('button', { name: /まだ難しい/ }).click();
  await page.getByPlaceholder('押さえ方のコツ、気づいたことなど…').fill('CからGをゆっくり練習');
  await page.getByRole('button', { name: '記録を保存する' }).click();
  await expect(page.locator('.record-card')).toHaveCount(1);
  await expect(page.locator('.record-card')).toContainText('CからGをゆっくり練習');
  await expect(page.locator('.record-card .chord-pill')).toHaveText(['C', 'G']);
  await page.reload();
  await goTo(page, '記録');
  await expect(page.locator('.record-card')).toHaveCount(1);
  const dialog = await openSettings(page);
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '書き出す' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^guitar-master-backup-.*\.json$/);
  await download.saveAs(testInfo.outputPath('backup.json'));
  expect(errors).toEqual([]);
});

test('バックアップを復元し重複・破損した取り込みから既存記録を守る', async ({ page }) => {
  const backup = {
    schemaVersion: 1, exportedAt: '2026-09-23T00:00:00.000Z',
    settings: { bpm: 75, sound: false, preferredMinutes: 5 },
    records: [{ id: 'fixture-1', startedAt: '2026-09-23T00:00:00.000Z', durationSeconds: 120,
      planTitle: '復元した練習', bpm: 75, chords: ['Em', 'Am'], rating: 'hard', note: 'バックアップ復元テスト', completed: false }],
  };
  const file = (value: unknown) => ({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
  await page.goto('/');
  const dialog = await openSettings(page);
  await dialog.locator('input[type=file]').setInputFiles(file(backup));
  await expect(page.getByText('1件の記録を取り込みました。')).toBeAttached();
  await dialog.locator('input[type=file]').setInputFiles(file(backup));
  await expect(page.getByText('0件の記録を取り込みました。')).toBeAttached();
  await dialog.locator('input[type=file]').setInputFiles(file({ ...backup, schemaVersion: 99 }));
  await expect(page.getByRole('alert')).toContainText('対応していない');
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
  await goTo(page, '記録');
  await expect(page.locator('.record-card')).toHaveCount(1);
  await expect(page.locator('.record-card')).toContainText('復元した練習');
  await page.reload();
  await expect(page.getByRole('button', { name: /5分 気軽/ })).toHaveAttribute('aria-pressed', 'true');
});

test('初回取得後はオフラインで教材と練習を起動できる', async ({ page, context, browserName }) => {
  test.fixme(browserName === 'webkit', 'Playwright 1.63のofflineエミュレーション不具合: https://github.com/microsoft/playwright/issues/42775 。実機未確認。');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '今日の練習', exact: true })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '今日の練習', exact: true })).toBeVisible();
  await goTo(page, '学ぶ');
  await expect(page.locator('.chord-card')).toHaveCount(8);
  await goTo(page, '練習する');
  await page.getByRole('button', { name: '自由練習を始める', exact: true }).click();
  await expect(page.locator('.live-pill')).toContainText('練習中');
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  await expect(page.getByRole('button', { name: '再開する' })).toBeVisible();
});

test('仮想時計で10分メニューの全ステップを完走して完了記録を保存する', async ({ page }) => {
  // Explicit AudioContext test double: verifies UI lifecycle, not hardware audio.
  await page.clock.install();
  await page.addInitScript(() => {
    class TestAudioContext {
      state = 'running'; destination = {};
      get currentTime() { return Date.now() / 1000; }
      async resume() { this.state = 'running'; }
      async close() { this.state = 'closed'; }
      addEventListener() {} removeEventListener() {}
      createOscillator() { return { type: '', frequency: { setValueAtTime() {} }, connect() {}, disconnect() {}, start() {}, stop() {}, onended: null }; }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
    }
    Object.defineProperty(window, 'AudioContext', { value: TestAudioContext, configurable: true });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '今日の練習をはじめる', exact: true }).click();
  await page.clock.runFor(3200);
  await expect(page.locator('.session-step h3')).toHaveText('ゆっくり音を出す');
  await page.clock.fastForward(90_000);
  await expect(page.locator('.session-step h3')).toHaveText('コードを押さえる');
  await page.clock.fastForward(180_000);
  await expect(page.locator('.session-step h3')).toHaveText('コードチェンジ');
  await page.clock.fastForward(180_000);
  await expect(page.locator('.session-step h3')).toHaveText('リズムに合わせる');
  await page.clock.fastForward(151_000);
  await expect(page.getByRole('heading', { name: '今日も、いい練習でした。' })).toBeVisible();
  await page.getByRole('button', { name: /できた 手ごたえ/ }).click();
  await page.getByRole('button', { name: '記録を保存する' }).click();
  await expect(page.locator('.record-card')).toHaveCount(1);
  await expect(page.locator('.record-card')).toContainText('完了');
  await expect(page.locator('html')).toHaveAttribute('data-practicing', 'false');
});
