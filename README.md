# Guitar Master

<!-- Keep these links. Translations will automatically update with the README. -->
[Deutsch](https://zdoc.app/de/selimsivad49/guitar-master) | 
[English](https://zdoc.app/en/selimsivad49/guitar-master) | 
[Español](https://zdoc.app/es/selimsivad49/guitar-master) | 
[français](https://zdoc.app/fr/selimsivad49/guitar-master) | 
[日本語](https://zdoc.app/ja/selimsivad49/guitar-master) | 
[한국어](https://zdoc.app/ko/selimsivad49/guitar-master) | 
[Português](https://zdoc.app/pt/selimsivad49/guitar-master) | 
[Русский](https://zdoc.app/ru/selimsivad49/guitar-master) | 
[中文](https://zdoc.app/zh/selimsivad49/guitar-master)

アコースティックギター初心者のための、個人用の練習ノートです。
React / TypeScript / Viteで実装したWebアプリで、PWAとしてオフライン利用できる構成です。

## 起動

開発時に確認した環境: Windows、Node.js 24.13.0、npm 11.6.2。

```powershell
cd D:\dev\guitar-master
npm.cmd ci
npm.cmd run dev
```

[開発版を開く](http://127.0.0.1:5173/)

本番相当のPWAを確認する場合:

```powershell
npm.cmd run build
npm.cmd run preview
```

[本番相当のプレビューを開く](http://127.0.0.1:4173/)

開発サーバーはService Workerを使いません。オフライン動作は本番ビルドのプレビューで確認してください。
保存データは接続先ごとに分かれるため、5173と4173、localhostと127.0.0.1で同じ記録は自動共有されません。

## 使える機能

- **今日の練習**: 5・10・20分から選択。過去に難しいと記録したコードを優先。
- **学ぶ**: 8本の基礎レッスン、基本8コードの運指図、合成見本音。
- **練習する**: 4拍カウントイン、40〜160 BPM、コードチェンジ、4分・8分ストローク、自分でコードを選ぶ自由練習。
- **練習曲**: オリジナルの3つのコード進行。小節区間を選んでループ。
- **記録**: 実際に練習した時間、終了時のテンポ、自己評価、メモ。途中終了も記録可能。
- **設定・バックアップ**: 拍の音、基本テンポ、記録と設定のJSON書き出し・取り込み。

コード図は左が太い6弦、右が細い1弦です。見本は合成音で、ギターの録音ではありません。
練習曲は伴奏コードの練習用で、歌詞・メロディー・伴奏音源の再生はありません。
練習時間にカウントイン・一時停止・自己評価の時間は含みません。
画面から離れると一時停止します。戻ったら「練習する」から明示的に再開してください。

## 記録とバックアップ

記録は端末のIndexedDBに保存し、練習記録をサーバーへ送信しません。ngrok経由で利用する場合、アプリへの通信はngrokを通ります。
バックアップは `schemaVersion: 1` のJSONで、設定と保存済みの全記録を含みます。
取り込みは全件を検証した後に一括反映します。同じIDは既存の記録を優先し、設定はバックアップの値へ復元します。
壊れたファイル、未知のバージョン、ファイル内の重複IDは拒否し、既存記録を保持します。

未保存の練習セッションはメモリー上にあります。再読み込み・タブ終了・OSによるアプリ終了では失われるため、終了時に自己評価を選んで保存してください。
ブラウザーのデータ削除や端末変更に備え、定期的に書き出してください。将来のiOS版へはJSON取り込みで移行する想定です。

## iPhoneでの利用

ngrokを使うと、開発PCで作った本番ビルドのプレビューを一時的なHTTPS URLでiPhoneから確認できます。これは試用用のトンネルで、Vite previewは長期の本番配信用サーバーではありません。

### Windows側の準備

1. [ngrokアカウント](https://dashboard.ngrok.com/signup)を作成し、[Windowsのインストール手順](https://ngrok.com/download/windows)に従ってインストールします。`winget`を使う場合は `winget install ngrok -s msstore` です。
2. ngrok Dashboardで認証トークンを確認し、PowerShellで登録します。トークンは秘密情報なので、README、ソースコード、共有ログなどに貼り付けないでください。

   ```powershell
   ngrok config add-authtoken "<YOUR_AUTHTOKEN>"
   ```

3. Dashboardに表示される割り当て済みの開発ドメインを確認します。以下の例 `your-assigned-name.ngrok-free.app` は例示用です。**自分に割り当てられた実際のホスト名に置き換え**てください。Viteの環境変数にはホスト名だけ、ngrokの `--url` には `https://` を含むURLを指定します。

### プレビューとトンネルを起動する

まずビルドし、PowerShellのターミナル1でプレビューを起動します:

```powershell
cd D:\dev\guitar-master
npm.cmd run build
$env:__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS="your-assigned-name.ngrok-free.app"
npm.cmd run preview
```

`npm.cmd run build` が成功したことを確認してから、後続のコマンドへ進んでください。この環境変数には割り当て済みホスト名を1つだけ指定します。プレビューをすでに起動していた場合は `Ctrl+C` で終了し、環境変数を設定してから再起動してください。

PowerShellのターミナル2で、同じ割り当て済みドメインを指定してトンネルを起動します:

```powershell
ngrok http http://127.0.0.1:4173 --url https://your-assigned-name.ngrok-free.app
```

割り当て済みURLは認証なしでアクセスできるため、URLを知る人はアプリを開けます。通信はngrok経由です。練習記録はサーバーに送信されず、各端末・接続先のブラウザー内に保存されます。自分の端末にあるIndexedDBの記録が他人と共有されることはありません。ngrokの無料プランには利用上限があります。詳細は[無料プランの制限](https://ngrok.com/docs/pricing-limits/free-plan-limits)を参照してください。

### iPhoneで開いてホーム画面に追加する

1. iPhoneのSafariで割り当て済みのHTTPS URLを開きます。ngrokの「Visit Site」画面が表示された場合は進みます。
2. アプリが表示されたら「オフライン準備」の完了を待ちます。
3. Safariの共有メニューから「ホーム画面に追加」を選びます。「Webアプリとして開く（Open as Web App）」が表示されたらオンにします。
4. ホーム画面に追加したアイコンからアプリを開き、もう一度オフライン準備の完了を待ってから利用します。
5. 音、画面ロック後の再開、オフライン起動、記録とバックアップを `VERIFICATION.md` に沿って確認します。

PWAはネイティブiOSアプリにはなりません。オンラインでURLにアクセスしたり更新したりするには、PCの電源を入れ、プレビューとngrokの両方を起動しておく必要があります。初回のキャッシュ準備が完了すれば基本機能はオフラインで使えますが、ブラウザーのデータ消去などの後も使える保証はありません。端末や起動方法、URL（origin）が変わると記録は自動共有されないため、必要に応じてJSONバックアップを書き出し、移行先で取り込んでください。記録を維持するには、同じ割り当て済みURLを継続して使ってください。

アプリを終了するときは、ターミナル1と2のそれぞれで `Ctrl+C` を押します。コードを変更した後は、ターミナル1でプレビューを止めて再度 `npm.cmd run build`、`$env:__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS="your-assigned-name.ngrok-free.app"`、`npm.cmd run preview` の順に実行し、ターミナル2のngrokも起動し直してください。iPhoneでアプリを再読み込みし、更新案内が出た場合は画面の指示に従います。

困ったとき:

- **Host blocked**: 環境変数に実際の割り当て済みホスト名だけが設定されていることを確認し、previewを再起動します。
- **接続できない**: PC上のpreviewとngrokが両方動作中で、URLとホスト名が一致しているか確認します。
- **古いPWAが表示される**: previewを再起動してiPhoneで再読み込みし、更新案内があれば適用します。必要ならJSONバックアップ後にホーム画面のWebアプリを削除して追加し直してください。ブラウザーデータの消去は保存記録に影響する場合があります。

参照: [ngrok Windows](https://ngrok.com/download/windows)・[ngrok Agent CLI](https://ngrok.com/docs/gateway/agent/cli)・[Vite server options](https://vite.dev/config/server-options)・[Apple：Webサイトをアプリとして使う](https://support.apple.com/ja-jp/guide/iphone/iphea86e5236/ios)。

将来はCapacitorでWeb資産をiOSアプリに組み込む計画です。ネイティブビルド・署名・実機検証にはMacまたはmacOSのビルド環境が必要です。

## 開発と検証

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd exec playwright -- install chromium webkit
npm.cmd run test:e2e
```

`test:e2e` は本番ビルドの生成完了を待ってからテストを開始します。個別に `npm.cmd exec playwright -- test` を使う場合は先にビルドしてください。
テスト結果とスクリーンショットは `test-results`、HTMLレポートは `playwright-report` に生成します。
統合テスト専用のプレビューは4174番ポートを使い、終了時に同じプロセス内でサーバーを閉じます。
WebKitでの音声API非搭載やオフラインエミュレーション不具合は明示的に未検証として扱います。詳細は `VERIFICATION.md` を参照してください。

構成:

```text
src/App.tsx                4画面と練習セッション
src/styles.css             PC・スマートフォン向け表示
src/domain/                共有型とメニュー生成
src/content/               コード・レッスン・練習曲
src/components/            SVGコード図
src/platform/              Web Audio / IndexedDB
src/PwaNotice.tsx          オフライン準備・更新案内
tests/                     ブラウザー統合テスト
```

`AGENTS.md` に従い、Solが複雑な実装とレビュー、Lunaが教材と独立した表示部品を担当し、親担当が統合します。
アイコンは自作のベクター図案です。PNGの再生成は `powershell -NoProfile -File scripts/create-icons.ps1` で行えます。

## 後続の機能

チューナー、録音、自分用の曲登録、TAB演奏練習、単音判定、iOS版は初版以降の予定です。
開発計画は `DEVELOPMENT_PLAN.md`、モジュールの契約は `IMPLEMENTATION_CONTRACT.md` を参照してください。
