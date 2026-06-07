# Invidious React Client

React + TypeScript + Chakra UI + Vite で作成した Invidious 互換クライアントです。  
モバイル（360px〜430px）を最優先にしつつ、タブレット/PCでも密度を最適化しています。

## セットアップ

```bash
npm install
npm run dev
```

本番ビルド:

```bash
npm run build
```

## 環境変数

`.env.example` を `.env` にコピーして設定してください。

- `VITE_API_BASE_URL=https://example.com`
- `VITE_INVIDIOUS_API_BASE_URL=https://example.com`（後方互換）
- `VITE_ELECTRON_INVIDIOUS_API_BASE_URL=https://example.com`（Electron用）
- `VITE_CAPACITOR_INVIDIOUS_API_BASE_URL=https://example.com`（Capacitor用）
- `VITE_API_PROXY_URL=/api-proxy`（既定値。API 呼び出しをこのURL経由にします）
- `VITE_ELECTRON_LOCAL_PROXY_BASE_URL=http://127.0.0.1:8282`（Electron内蔵ProxyのベースURL）
- `VITE_CAPACITOR_LOCAL_PROXY_BASE_URL=http://127.0.0.1:8282`（Capacitor内蔵ProxyのベースURL）
- `VITE_CAPACITOR_LOCAL_PROXY_PORT=8282`（Capacitor内蔵Proxyの待受ポート）
- `VITE_ELECTRON_API_PROXY_URL=`（必要なら `/api-proxy` のフルURLを直接指定）
- `VITE_CAPACITOR_API_PROXY_URL=`（必要なら `/api-proxy` のフルURLを直接指定）
- `VITE_DEFAULT_REGION=JP`
- `VITE_DEFAULT_LANGUAGE=ja`
- `VITE_ENABLE_LIVE_PLAYBACK=true`（`false` でライブ配信の再生を無効化）
- `VITE_CHROMECAST_APP_ID=CC1AD845`（未設定時は Default Media Receiver）

`VITE_API_BASE_URL` が優先されます。

`VITE_API_PROXY_URL` の既定値は `/api-proxy` で、`npm run server` 側で Invidious に転送されます。必要に応じて `API_PROXY_UPSTREAM` で転送先を変更できます。

Electron / Capacitor 実行時は、既定で `VITE_*_LOCAL_PROXY_BASE_URL` を使って `.../api-proxy` と `.../companion` を参照します（アプリ内Proxy前提）。

Capacitor Android では Kotlin 実装のネイティブローカルHTTPサーバーを組み込み済みです。起動時に `NativeProxy.start()` を呼び、`/api-proxy`・`/companion`・`/tv-sync` を提供します。

ネイティブ側の起動コード例は [docs/native_proxy_startup.md](./docs/native_proxy_startup.md) を参照してください。

## Chromecast

- Sender: Watch画面に `Chromecast` ボタンを追加済み
- Receiver: `public/cast/receiver.html` を追加済み
- カスタムReceiverを使う場合は Google Cast SDK Developer Console でReceiver Appを登録し、
  `VITE_CHROMECAST_APP_ID` にその App ID を設定してください
- `CC1AD845` のままでも送信はできますが、その場合は Google の Default Media Receiver が使われます

## 実装済み画面

- `/` ホーム（Trending/Popular、カテゴリ、更新ボタン）
- `/search` 検索（候補、フィルタ、モバイルBottomSheet）
- `/watch/:videoId` 視聴（プレイヤー、概要、コメント、関連動画）
- `/channel/:authorId` チャンネル（概要、最新動画、プレイリスト）
- `/channel/:authorId/videos` `/shorts` `/streams`
- `/playlist/:playlistId`
- `/settings`（一般/外観/再生/履歴と検索/Watch/詳細設定）
- `/history`（視聴履歴一覧、個別削除、全削除）
- `/feed` `/subscriptions` `/playlists`（トークン利用時）

## モバイル UI 方針

- iOS 風 Large Title ヘッダー
- 固定 Bottom Navigation（safe-area 対応）
- 全画面検索 Overlay（候補、履歴、戻るで閉じる）
- フィルタは BottomSheet
- Watch 画面は縦積み + プレイヤー上部固定気味
- タップ領域は基本 44px 以上

## PC / タブレット方針

- PC: Header + Sidebar + 高密度グリッド
- タブレット: 2〜3 カラム中心
- PC Watch: 左メイン、右関連動画

## デザインシステム

- 色数は基本 3〜5 色に制限
- ライト背景: `#F7F7F8` 系
- ダーク背景: `#0F0F10` 系
- 控えめアクセント（accent）
- 大きめ radius / 柔らかい shadow / 半透明カード

## 技術メモ

- API クライアントは `fetch API` ベース
- `hl` / `region` を自動付与
- `descriptionHtml` / `contentHtml` は DOMPurify で sanitize
- 直接再生不可時は iframe fallback を表示
- 設定は `SettingsProvider + useSettings` で全体管理
- localStorage キー:
  - `invidious-client-settings`
  - `invidious-client-watch-history`
  - `invidious-client-search-history`
- 最近検索語と視聴履歴は localStorage に保存

## CORS について

インスタンスによっては CORS 制約があります。必要に応じて同一オリジン reverse proxy を使ってください。

## TV Sync 本番ルーティング

`/tv` の独自TV連携は `POST /tv-sync/session` などのAPIを使用します。  
`vite.config.ts` の proxy は開発時のみ有効なので、本番ではリバースプロキシ設定が必要です。

- フロント: `https://youtube.tsub4sa.xyz`
- APIサーバー: `http://127.0.0.1:8282`（`npm run server`）

Nginx 例:

```nginx
location /tv-sync/ {
  proxy_pass http://127.0.0.1:8282/tv-sync/;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

Caddy 例:

```caddy
handle_path /tv-sync/* {
  reverse_proxy 127.0.0.1:8282
}
```

確認手順:

```bash
curl -i -X POST https://youtube.tsub4sa.xyz/tv-sync/session
```

`200` と `{"sessionId":"..."}` が返れば設定完了です。

## 今後の TODO

- DASH 本再生対応
- PWA（manifest / service worker）
- mini player
- keyboard shortcuts
"# InverView"  
