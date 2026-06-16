# Project context for Claude Code

WebSocket リアルタイム対戦スネーク。npm workspaces で server / client を統合。

## Architecture

```
client (browser, Vite + Canvas)
    │  WebSocket  /ws
    ▼
server (Node.js + ws, tsx)
    └── Room (per match)
        └── GameState  ──► tick loop (setInterval, every config.tickMs)
```

- **サーバ権威**: ゲーム状態は全てサーバが持ち、tick ごとに `state` メッセージで全クライアントへブロードキャスト。クライアントは描画専用
- **`shared/protocol.ts`**: 型のみのモジュール。両方から相対 import される。**型を変えるなら必ず両方ビルドして確認すること**
- **Room ライフサイクル**: コード生成 → メンバー追加 → `start_game` → `setTimeout(countdownMs)` → tick ループ → 勝敗判定 → `game_over` → `restart` でロビーに戻る

## Makefile を使った起動・デバッグ

```bash
make dev        # 開発: ホットリロード、ソース変更が即反映
make dev-down   # 開発コンテナ停止

make prod       # 本番ビルド (バックグラウンド起動)
make prod-down  # 本番停止
make logs       # 本番ログ追跡 (Ctrl+C で抜ける)

make tunnel     # 本番 + Cloudflare Tunnel
make tunnel-down
```

| 構成 | ポート | サーバ実行 | クライアント |
|---|---|---|---|
| `make dev` | 5173 (client), 8080 (server) | `tsx watch` + volume mount | Vite dev server (HMR) |
| `make prod` | 80 のみ | `tsx` + ソース COPY | nginx で静的配信、`/ws` を proxy |
| `make tunnel` | 公開ドメイン | 同上 | 同上 + cloudflared コンテナ |

**重要**: Docker コンテナと `npm run dev` のローカル起動は **ポートが衝突する**。片方を止めてから他方を起動すること。

```bash
lsof -i :8080 -i :5173 | grep LISTEN   # 占有状況の確認
make dev-down                            # Docker dev を止める
```

## ローカル直接起動 (Docker 不使用)

```bash
npm install      # 初回のみ。workspace 内も解決される
npm run dev      # concurrently で server + client 並列起動
```

サーバは `tsx watch`、`server/src` のファイル変更で自動再起動。client は Vite HMR で即反映。

## 環境変数の上書き

`.env`（gitignore 済み）に書くか、コマンドラインで一時的に：

```bash
# .env で恒久的に
echo "GAME_TICK_MS=80" >> .env

# 一時的にテスト
GAME_BOMB_FOOD_CHANCE=1 GAME_TIME_LIMIT_SEC=30 npm run dev
```

- ローカル: `dotenv` がプロジェクトルートの `.env` を自動読込
- Docker: `compose.yml` の `environment:` で `${VAR:-}` パススルー (compose が `.env` を自動参照)

サーバ起動時のログに有効値が出る:
```
[config] { tickMs: 120, grid: { w: 40, h: 30 }, ... }
```

## デバッグ TIPS

### 1 人プレイデバッグ

`make dev` または `npm run dev` で起動し、1 タブだけで部屋を作って Start → そのまま遊べる（1 人プレイ時は「自分が死ぬまで」で終了）。

### `[DEBUG] Place dummy` ボタン

ゲーム画面に表示される。`import.meta.env.DEV` が true のときのみレンダリングされる（本番ビルドでは tree-shake で消える）。

- 押すたびにランダム位置にグレーの **動かないスネーク** が配置される
- 衝突判定の対象になるので、爆発や切断、衝突回避のテストに使える
- 勝敗判定からは除外される

### サーバログの確認

```bash
# Docker prod
make logs

# Docker dev
docker compose -f compose.yml -f compose.dev.yml logs -f server

# ローカル npm run dev
# stdout に直接出る（[server] プレフィックス）
```

### Vite が WebSocket を proxy できない時

`client/vite.config.ts` の `proxy['/ws']` が `process.env.WS_TARGET` を見る。Docker dev では `WS_TARGET=ws://server:8080` が compose で渡される。ローカル npm run dev では未設定 → `ws://localhost:8080` がデフォルト。

### TypeScript の型チェック

ビルドせずに型のみチェック:
```bash
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit
```

## 重要なファイル

| ファイル | 役割 | 編集時の注意 |
|---|---|---|
| `shared/protocol.ts` | WS メッセージ型 | サーバ・クライアント両方の型整合に影響。必ず両方ビルド確認 |
| `server/src/game.ts` | スネークの純粋ロジック (tick, dropBlock, addDummy, detonateBombs, finishByTimeLimit) | I/O はここに書かない。Room が呼ぶ |
| `server/src/room.ts` | ルーム状態とソケット I/O | `startedAt` は countdown 後の時刻。`stopLoop()` で `loop` と `countdownTimer` 両方を止める |
| `server/src/config.ts` | 環境変数読み込み | `num` / `numFloat` ヘルパーで安全に parse。最小値・最大値のバリデーション付き |
| `server/src/index.ts` | HTTP/WS サーバの起点 | 新規メッセージタイプは `handle()` のスイッチに追加 |
| `client/src/main.ts` | 画面遷移と state 管理 | `State` 型・`leaveRoom()`・`handleServer()` を一貫させる |
| `client/src/render.ts` | Canvas 描画 | 純関数。状態を持たない |

## メッセージプロトコル

クライアント → サーバ:
- `create_room`, `join_room`, `start_game`, `set_direction`, `restart`, `place_dummy`, `drop_block`

サーバ → クライアント:
- `room_joined`, `lobby_update`, `game_start`, `state`, `game_over`, `error`

`game_start` には `grid`, `tickMs`, `timeLimitMs?`, `goalLength?`, `countdownMs?` が含まれる。`state` はゲーム本体の毎 tick ブロードキャストで `snakes`, `foods`, `walls`, `bombs`, `flashes`, `timeRemainingMs?` を持つ。

## やってはいけないこと

- **`shared/protocol.ts` の既存フィールドの非互換変更**: クライアント・サーバを同時にビルド・デプロイする保証がないので、フィールド追加はオプショナル `?` でやる
- **クライアント側にゲームロジックを書く**: サーバ権威モデルを壊す。クライアントは入力送信と描画のみ
- **`game.ts` から I/O を呼ぶ**: 純関数として保つ。`setInterval` / `WebSocket.send` は `room.ts` に
- **本番コンテナで `console.log` を流しっぱなしにする**: tick ごとに大量出力するとログが溢れる。`[config]` の起動時 1 行は OK

## 既知の制約

- `MAX_PLAYERS` を 4 以上にしても `PLAYER_COLORS` が 4 色しかないので色が重複する
- グリッド最小 8×8（config の min バリデーション）
- 認証なし。同名で複数参加可能
- LocalStorage に名前のみ保存。スコア・履歴は保存しない
