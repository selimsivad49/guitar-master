# 初版の実装契約

型は `src/domain/types.ts`。これを変更する必要があれば親担当へ連絡する。

## モジュール契約

- `src/content/library.ts`: `chords: Chord[]`, `lessons: Lesson[]`, `patterns: StrumPattern[]`, `songs: Song[]` をexport。
- `src/components/ChordDiagram.tsx`: default export。props `{ chord: Chord; compact?: boolean }`。SVGで描画。独立CSSは使わずSVG属性とクラス名を使う。
- `src/domain/plans.ts`: `createDailyPlan(minutes: 5|10|20, records: PracticeRecord[]): PracticePlan`、`createFreePlan(chords: ChordId[], pattern: PatternId, title?: string): PracticePlan`。freeは5分1step。daily合計秒数はminutes*60。
- `src/platform/storage.ts`: `defaultSettings: Settings`、async `loadData(): Promise<{records:PracticeRecord[];settings:Settings}>`、`saveRecord(record):Promise<void>`、`saveSettings(settings):Promise<void>`、`exportBackup():Promise<string>`、`importBackup(json:string):Promise<number>`。importは全検証後atomic merge、同じIDは既存優先、設定はバックアップから復元。保存エラーをthrowしUI表示。
- `src/platform/audio.ts`: class `PracticeEngine`: `constructor(options:EngineOptions)`、`start():Promise<void>` (4拍countIn開始)、`pause():void`、`resume():Promise<void>` (4拍countIn後既存tick継続)、`stop():void`、`setBpm(bpm:number):void`、`setSound(sound:boolean):void`、`getElapsedSeconds():number` (countIn・pause除外)、`dispose():void`。onBeatは音声時間に同期、8分単位tick、countInのtickは練習に算入せず、beat=0..3、subdivision=0|1。onInterruptはvisibility/audio中断時。`playChord(chord:Chord):Promise<void>` 合成見本音。
- `src/App.tsx`: default App。上の契約を使用し、起動時loadData、練習・履歴・設定import/exportを実装。
- `src/styles.css`: アプリ全体のスタイル。rootのみmain.tsxとconfig/public/packageを編集。

## 担当

- Sol core: domain/plans、platform/audioとstorage、対応するunit tests。
- Sol UI: App.tsx、styles.cssのみ。必要ならfeatures配下に独立ファイルを作成可。
- Luna content: content/library.ts、components/ChordDiagram.tsxのみ。
- 親担当: scaffold/config/public、統合、ブラウザー検証、修正調整。

## UIと動作

日本語。温かい紙色、濃い茶の文字、テラコッタのアクセント。ギター練習帳の雰囲気。スマホを優先しPCでも読みやすく、サイドバー/下部タブを使い分ける。
4画面: 今日の練習・学ぶ・練習する・記録。設定/バックアップはダイアログ等で開く。
大きな練習開始ボタン、コード図、beatとストローク、次コードを併記。
練習中の画面移動はpause、画面非表示はpause。再開は明示操作。0秒記録を保存しない。
練習中PWA更新を禁止するためAppから `document.documentElement.dataset.practicing = 'true'|'false'` を設定する。
見本音は合成音のラベル。外部素材やフォントCDN不要。コードの向きは6弦が左で明示。
