# 資産ダッシュボード

個人用資産管理PWA。月1回確認すれば資産運用の状態を判断できるダッシュボード。

## 目的

- 現在の金融資産・前回月次記録比・資産配分を一目で確認
- FIRE目標までの進捗確認
- 月次更新・バックアップ状況の管理
- 家計簿ではなく、月次確認に特化した個人用ツール

外部サーバー・認証・クラウド同期なし。データはすべてこの端末のIndexedDBに保存。

---

## ローカル起動

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:5173` を開く。

---

## ビルド

```bash
npm run build
```

`dist/` ディレクトリに本番ビルドが生成される。

---

## テスト

```bash
npm test
```

Vitestで計算ロジック・バリデーション・CSV・IndexedDB操作のユニットテストを実行。

---

## 現在の運用URL

**GitHub Pages**: https://mtoya22-commits.github.io/personal-asset-dashboard/

現在の設定: `vite.config.ts` の `VITE_DEPLOY_BASE` のデフォルト値は `/personal-asset-dashboard/`。
manifest の `start_url`・`scope` および Service Worker スコープはすべてこの base に追従する。

---

## GitHub Pagesデプロイ手順

1. `main` ブランチへプッシュすると `.github/workflows/deploy.yml` が自動実行される
2. ビルド → `actions/upload-pages-artifact` → `actions/deploy-pages` の公式Actionsを使用
3. 第三者製デプロイActionは使用しない

---

## カスタムサブドメインへの移行手順（将来）

カスタムドメイン（例: `assets.example.com`）へ移行する際の手順。
すべてGitHub/DNS管理画面で手動で行う。コードにCNAMEファイルは作成しない。

1. **DNS設定**
   `assets` のCNAMEレコードを `mtoya22-commits.github.io` に向ける

2. **GitHubアカウントのドメイン検証**
   GitHub → Settings → Pages → Verified domains でドメインを検証する

3. **リポジトリのPages設定**
   Settings → Pages → Custom domain にカスタムドメインを入力し「Enforce HTTPS」を有効化する

4. **HTTPS確認後に `VITE_DEPLOY_BASE` を変更**
   `vite.config.ts` の `VITE_DEPLOY_BASE` デフォルト値を `/personal-asset-dashboard/` から `/` に変更してビルド・デプロイする。
   **この変更は DNS → GitHub Pages 設定 → HTTPS 有効化の後に行うこと。**
   manifest の `start_url`・`scope` および SW スコープも自動的に `/` に変わる。

---

## データ保存場所

- **主データ**: IndexedDB（`personal-asset-dashboard-v1`）
- **UI設定・下書き**: localStorage（`pad:` プレフィックス）
- **PWAキャッシュ**: Cache Storage（金融データは保存しない）

データはこの端末・このブラウザプロファイルのみに保存される。
ブラウザデータ削除・端末変更・アプリ削除でデータが失われる可能性がある。

---

## JSONバックアップと復元方法

### エクスポート

設定画面 → 「JSONをエクスポート」ボタン

- iPhone: Web Share APIでiCloud Drive・ファイルアプリ・AirDropなどへ保存
- PC: ファイルとしてダウンロード

ファイル名: `asset-backup-YYYY-MM-DD.json`

### インポート

設定画面 → 「JSONをインポート」ボタン → ファイル選択

- **全置換のみ**（マージ不可）
- インポート前に現在データが自動的に復元ポイントとして保存される（最大3件）
- インポート失敗時は既存データを破壊しない

### 復元ポイントからの復元

設定画面 → 「復元ポイントを確認」から直前の状態に戻せる

---

## 主端末と複数端末利用の注意

- 主端末はiPhoneを想定
- **自動同期は行わない**
- 別端末での利用は一方向運用:
  ```
  iPhoneで編集 → JSONを出力 → 別端末でインポートして閲覧
  ```
- 独立して編集した2端末のデータをマージする機能はない

---

## プライバシー上の注意

- ログイン認証なし
- データはこの端末のブラウザ内にのみ保存
- 外部への通信ゼロ（バックアップ共有・ダウンロード操作を除く）
- Google Analytics・Sentry・外部フォント・CDNなし
- 端末のロック・Face IDは利用者自身で管理すること
- バックアップファイルの保管場所も利用者が管理する

---

## PWA更新時の注意

- Service Worker更新で自動リロードしない
- 更新がある場合: 画面上部に「新しいバージョンがあります」バナーが表示
- 未保存の入力がある場合は先に保存してから「更新する」を押すこと

---

## 初期版の非対応事項

以下はMVPでは実装していない:

- 証券会社API連携・株価自動取得
- ログイン・認証
- クラウド同期・複数端末自動同期
- NISA拠出額・残枠の厳密管理
- 実現損益・税引後損益・トータルリターン
- 不動産・住宅ローン・車・退職金見込みを含む純資産
- カテゴリ追加・削除・統合
- JSONマージインポート
- 目標配分と確認ポイント（ドリフト表示）
- 外貨建て評価・為替計算
