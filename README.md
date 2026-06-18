# Snake Battle

WebSocket でリアルタイム同期するキーボード操作の対戦スネーク。最大 4 人、ルームコードで合流、ラストマンスタンディング。

## 特徴

- **キーボードのみ操作**（WASD / 矢印キー / Space）。マウス不要
- **ルームコード方式** のマッチング。1 人プレイも可（デバッグ用）
- **ホスト権限の自動委譲** — ホスト切断時に次の参加者が引き継ぐ
- **環境変数で完全カスタマイズ** — 速度・盤面サイズ・勝利条件・時間制限など
- **Docker Compose** で dev / prod / Cloudflare Tunnel の 3 構成を切り替え可能
- **デバッグ用ダミースネーク配置** — `npm run dev` 時のみ表示される `[DEBUG]` ボタン

## 操作

| キー | 動作 |
|---|---|
| WASD / 矢印 | スネークの向きを変える |
| Space | 末尾セグメントを切り離して壁ブロックを設置（末尾が爆弾化していれば爆弾を設置） |
| Enter | ロビーで開始 / リザルトで再戦（ホストのみ） |

## ゲームルール

- 開始時に **3 秒のカウントダウン**
- 餌（黄色）を食べると長さ +1
- 一定確率で **青い餌** が出現。食べると末尾セグメントが爆弾化（`!` マーク）
- 末尾が爆弾の状態で Space → 通常壁ではなく **爆弾** を設置。3 tick 後に十字爆発
- 爆発は壁・他の爆弾に当たると削除して停止（貫通せず）、スネークは貫通
- 爆風で頭に当たると即死、体に当たるとそこから切断（切断部分は壁になり、爆弾セグメントは新しい爆弾としてカウントダウン開始）
- 壁衝突・体衝突・正面衝突で死亡
- 最後の 1 人が勝利

## クイックスタート

### ローカル開発

```bash
npm install
npm run dev
# → http://localhost:5173 をブラウザで開く（複数タブで合流可能）
```

### Docker（Makefile 経由）

```bash
make dev        # ホットリロード付き開発環境
make prod       # 本番ビルド（nginx + tsx）
make tunnel     # Cloudflare Tunnel 経由で公開
```

詳細は [CLAUDE.md](./CLAUDE.md) を参照。

## 環境変数

すべてオプショナル。`.env.example` をコピーして `.env` を作成し、必要なものだけ設定する。

| 変数 | デフォルト | 説明 |
|---|---|---|
| `GAME_TICK_MS` | 120 | tick 間隔 (ms)。小さいほど高速 |
| `GAME_GRID_W` | 40 | グリッド横セル数 (min 8) |
| `GAME_GRID_H` | 30 | グリッド縦セル数 (min 8) |
| `GAME_MAX_PLAYERS` | 4 | ルーム最大人数 |
| `GAME_INITIAL_LENGTH` | 3 | 初期スネーク長 |
| `GAME_TIME_LIMIT_SEC` | 0 | 制限時間（秒）。0 で無制限。時間切れは最長スネーク勝利 |
| `GAME_GOAL_LENGTH` | 0 | ゴール長。先に到達したスネークが勝利。0 で無効 |
| `GAME_COUNTDOWN_SEC` | 3 | カウントダウン秒数。0 で省略 |
| `GAME_BOMB_FUSE_TICKS` | 3 | 爆弾起爆までの tick 数 |
| `GAME_BOMB_RANGE` | 3 | 爆発の各方向最大マス |
| `GAME_BOMB_FOOD_CHANCE` | 0.25 | 青い餌の出現確率 (0.0〜1.0) |
| `GAME_ROOM_DB_PATH` | `data/rooms.sqlite` | ルームコード永続化に使う SQLite ファイルパス |
| `TUNNEL_TOKEN` | — | Cloudflare Tunnel トークン（`make tunnel` 使用時のみ） |

## 技術スタック

- **サーバ**: Node.js 22 + TypeScript + [`ws`](https://github.com/websockets/ws)
- **クライアント**: Vite + Vanilla TypeScript + Canvas
- **共有型定義**: `shared/protocol.ts` を両方から相対 import
- **コンテナ**: Docker Compose (dev / prod / tunnel をオーバーレイで切替)
- **公開**: nginx で `/` に SPA、 `/ws` を server コンテナへプロキシ

## ディレクトリ構成

```
.
├── shared/protocol.ts        # WS メッセージと共有型
├── server/
│   ├── src/
│   │   ├── index.ts          # HTTP + WS サーバ起動
│   │   ├── rooms.ts          # ルームレジストリ
│   │   ├── room.ts           # 1 ルームの状態管理 + tick ループ
│   │   ├── game.ts           # スネークの純粋ロジック
│   │   └── config.ts         # 環境変数の読み込み
│   └── ...
├── client/
│   ├── src/
│   │   ├── main.ts           # 画面遷移
│   │   ├── net.ts            # WebSocket クライアント
│   │   ├── input.ts          # キーボード入力
│   │   ├── render.ts         # Canvas 描画
│   │   └── styles.css
│   └── index.html
├── docker/
│   ├── Dockerfile.server
│   ├── Dockerfile.client
│   └── nginx.conf
├── compose.yml               # ベース定義
├── compose.dev.yml           # 開発 (volume mount + HMR)
├── compose.prod.yml          # 本番 (nginx + tsx)
├── compose.tunnel.yml        # cloudflared 追加
├── Makefile
└── .env.example
```

## ライセンス

MIT
