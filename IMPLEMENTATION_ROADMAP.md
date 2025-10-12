# Implementation Roadmap - VertexAI Imagen MCP Server

このドキュメントは、VertexAI Imagen MCP Server の実装ロードマップです。

## 完了済み

### ✅ Phase 1A: Multi-sample Generation（複数画像生成）
**完了日**: 2025-10-12
**ブランチ**: digicatswork
**コミット**: e239d5b

**実装内容**:
- `generate_image`: 1-4枚の画像生成対応（デフォルト: 1）
- `edit_image`: 1-4枚の画像生成対応（デフォルト: 1）
- `generateMultipleFilePaths()` 関数: 自動ナンバリング機能（image_1.png, image_2.png）
- `createMultiUriImageResponse()` 関数: 複数画像のMCPレスポンス
- Resources API 統合（file:// URI）
- サムネイル生成対応
- 後方互換性維持（sample_count=1 は従来形式）

**変更ファイル**:
- src/utils/path.ts
- src/utils/image.ts
- src/types/tools.ts
- src/index.ts

---

### ✅ Phase 1A': customize_image Multi-sample Support
**完了日**: 2025-10-12
**ブランチ**: digicatswork
**所要時間**: 30分

**実装内容**:
- `customize_image`: 1-4枚の画像生成対応（デフォルト: 1）
- `generateMultipleFilePaths()` を使用した自動ナンバリング
- `createMultiUriImageResponse()` による複数画像のMCPレスポンス
- sample_count パラメータのバリデーション（1-4の範囲チェック）
- 後方互換性維持（sample_count=1 は従来形式）
- base64モード時の警告追加（複数画像時）

**変更ファイル**:
- src/types/tools.ts: CustomizeImageArgs に sample_count 追加
- src/index.ts: Schema定義、customizeImage()関数の更新

**注意点**:
- Reference images (control/subject/style) との組み合わせで API 制限がある可能性
- 特に non-square aspect ratio + 複数 reference types の制限に注意（既存チェック維持）

---

## 実装予定

### Phase 1B: Asynchronous Job Management（非同期ジョブ管理）
**優先度**: 🟡 中（タイムアウト対策により信頼性向上）
**所要時間**: 4-5時間（SQLite統合含む）
**依存関係**: Phase 2との統合を推奨

**目的**: 長時間実行のジョブを非同期で管理し、タイムアウトを回避する

**実装内容**:

1. **ジョブ管理システム**
   ```typescript
   type JobType = 'generate' | 'edit' | 'customize' | 'upscale';
   type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

   interface JobBase {
     id: string;
     type: JobType;
     status: JobStatus;
     createdAt: Date;
     startedAt?: Date;
     completedAt?: Date;
     error?: string;
   }

   interface GenerateJob extends JobBase {
     type: 'generate';
     params: GenerateImageArgs;
     result?: { outputPaths: string[] };
   }

   interface EditJob extends JobBase {
     type: 'edit';
     params: EditImageArgs;
     result?: { outputPaths: string[] };
   }

   interface CustomizeJob extends JobBase {
     type: 'customize';
     params: CustomizeImageArgs;
     result?: { outputPaths: string[] };
   }

   interface UpscaleJob extends JobBase {
     type: 'upscale';
     params: UpscaleImageArgs;
     result?: { outputPath: string };
   }

   type Job = GenerateJob | EditJob | CustomizeJob | UpscaleJob;
   ```

2. **新規ツール**
   - `start_generation_job`: ジョブを開始してIDを返す
     - 入力: 各種生成パラメータ + job_type
     - 出力: job_id

   - `check_job_status`: ジョブの進行状況確認
     - 入力: job_id
     - 出力: status, progress?, estimated_time?

   - `get_job_result`: 完了したジョブの結果取得
     - 入力: job_id
     - 出力: 生成画像の URI など

   - `cancel_job`: ジョブのキャンセル
     - 入力: job_id
     - 出力: success/failure

   - `list_jobs`: ジョブ一覧表示
     - 入力: status?, limit?
     - 出力: jobs[]

3. **ストレージ（Phase 2と統合推奨）**
   - **推奨**: SQLite統合
     - Phase 2（履歴機能）と同じDBを使用
     - テーブル: `jobs` と `history` を同一DB内に配置
     - メリット: 再起動耐性、メトリクス集計、トランザクション管理
     - パス: 環境変数 `VERTEXAI_IMAGEN_DB` または デフォルト `./data/vertexai-imagen.db`
   - 代替案: メモリベース（Map<string, Job>）
     - プロトタイプ向け、再起動で消失

4. **ワーカー実装**
   - Promise ベースの非同期実行
   - 同時実行数の制限（デフォルト: 2-3）
   - タイムアウト設定（ジョブ単位）

**メリット**:
- タイムアウト回避（特に upscale や multiple samples）
- 複数ジョブの並列実行
- UX向上（即座にレスポンス）
- リトライ機能の実装が容易
- **SQLite統合時**:
  - 再起動後もジョブ状態を保持
  - 履歴機能と統合したメトリクス分析
  - トランザクションによる一貫性保証

**考慮事項**:
- 実装の複雑性増加（Phase 2と統合することで軽減）
- ステート管理が必要（SQLiteで永続化）
- MCP クライアント側でポーリングが必要（非同期の制約）

---

### Phase 2: History Tracking（履歴追跡）
**優先度**: 🟡 中
**所要時間**: 2-3時間
**依存関係**: Phase 1Bと統合推奨

**目的**: 生成した画像の履歴とメタデータを記録し、再現性と管理性を向上させる

**実装内容**:

1. **データベース設計**
   ```sql
   CREATE TABLE history (
     id TEXT PRIMARY KEY,
     tool_name TEXT NOT NULL,
     prompt TEXT NOT NULL,
     parameters TEXT NOT NULL,  -- JSON
     output_files TEXT NOT NULL, -- JSON array
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     model TEXT,
     aspect_ratio TEXT,
     sample_count INTEGER,
     success BOOLEAN DEFAULT 1,
     error_message TEXT
   );

   -- Phase 1B との統合時
   CREATE TABLE jobs (
     id TEXT PRIMARY KEY,
     type TEXT NOT NULL,
     status TEXT NOT NULL,
     params TEXT NOT NULL,  -- JSON
     result TEXT,            -- JSON
     error TEXT,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     started_at DATETIME,
     completed_at DATETIME
   );
   ```

2. **保存場所（柔軟性重視）**
   - **優先順位**:
     1. 環境変数 `VERTEXAI_IMAGEN_DB`（Phase 1Bと統合時）
     2. 環境変数 `VERTEXAI_IMAGEN_HISTORY_DB`（履歴のみ）
     3. デフォルト: `./data/vertexai-imagen.db`（プロジェクト直下）
   - **理由**:
     - コンテナ/CI環境対応: ホームディレクトリ依存を回避
     - 相対パス使用可能: プロジェクト単位でDB管理
     - 環境変数で柔軟にカスタマイズ可能

3. **新規ツール**
   - `list_history`: 履歴一覧表示
     - フィルタ: tool_name, date_range, search_prompt
     - ソート: created_at DESC
     - ページネーション対応

   - `get_history_detail`: 特定の履歴詳細取得
     - 入力: history_id
     - 出力: 完全なパラメータと結果

   - `regenerate_from_history`: 履歴から再生成
     - 入力: history_id, override_params?
     - 出力: 新しい画像

   - `delete_history`: 履歴削除（画像ファイルは保持）
     - 入力: history_id

   - `search_history`: プロンプト検索
     - 入力: query, limit?
     - 出力: matching_history[]

4. **自動記録**
   - 各生成ツール実行後に自動で履歴保存
   - 成功/失敗両方を記録
   - エラーメッセージも保存

**メリット**:
- 生成履歴の完全な記録
- パラメータの再現性
- プロンプトの改善サイクル
- トラブルシューティングの効率化
- コスト分析（生成回数の把握）

**拡張案**:
- タグ機能（ユーザーが履歴にタグ付け）
- お気に入り機能
- 履歴のエクスポート（CSV/JSON）
- 統計情報（最も使われたプロンプト、モデルなど）

---

### Phase 4: Prompt Templating（プロンプトテンプレート）
**優先度**: 🟢 低
**所要時間**: 1-2時間
**依存関係**: なし

**目的**: 再利用可能なプロンプトテンプレートを管理し、一貫性のある画像生成を支援

**実装内容**:

1. **テンプレート構造**
   ```json
   {
     "name": "portrait_template",
     "description": "Professional portrait photo template",
     "template": "A professional portrait of {subject}, {style}, high quality, studio lighting",
     "variables": ["subject", "style"],
     "default_params": {
       "aspect_ratio": "3:4",
       "person_generation": "ALLOW_ADULT"
     },
     "tags": ["portrait", "professional"]
   }
   ```

2. **保存場所（規約明確化）**
   - **優先順位**:
     1. 環境変数 `VERTEXAI_IMAGEN_TEMPLATES_DIR`（最優先）
     2. `~/.vertexai-imagen/templates/`（ユーザーレベル）
     3. `./templates/`（プロジェクトレベル、デフォルト）
   - **ファイル形式**: JSON（`.json`）
   - **命名規則**: `{template_name}.json`
   - **共有フロー**:
     - チーム共有: プロジェクト内の `./templates/` を git 管理
     - 個人用: `~/.vertexai-imagen/templates/` にカスタムテンプレート配置
   - **検索順序**: 環境変数 → ユーザーレベル → プロジェクトレベル

3. **新規ツール**
   - `save_prompt_template`: テンプレート保存
     - 入力: name, template, variables, default_params

   - `list_prompt_templates`: テンプレート一覧
     - フィルタ: tags, search

   - `get_template_detail`: テンプレート詳細取得
     - 入力: template_name

   - `generate_from_template`: テンプレートから生成
     - 入力: template_name, variable_values
     - 例: `{subject: "a woman", style: "cinematic"}`
     - 出力: 生成画像

   - `delete_template`: テンプレート削除

   - `update_template`: テンプレート更新

4. **変数置換**
   - シンプルな文字列置換: `{variable_name}`
   - バリデーション: 必須変数のチェック
   - デフォルト値の設定

**メリット**:
- プロンプトの再利用性
- 一貫性のある画像生成
- ベストプラクティスの共有
- チーム内での標準化

**拡張案**:
- テンプレートのインポート/エクスポート
- コミュニティテンプレートのダウンロード
- テンプレートのバージョン管理
- ネストされたテンプレート（テンプレートから別のテンプレートを参照）

---

## その他の検討項目

### バッチ処理
**概要**: 複数の異なるプロンプトを一括処理

**実装内容**:
- `batch_generate`: CSV/JSON ファイルから入力読み込み
- 進捗レポート機能（X/Y 完了）
- エラーハンドリング（一部失敗しても継続）
- 結果のサマリーレポート

**ユースケース**:
- 大量のプロダクト画像生成
- A/Bテスト用のバリエーション生成
- データセット作成

---

### メタデータ埋め込み
**概要**: 生成パラメータを画像のEXIFメタデータに埋め込む

**実装内容**:
- EXIF ライブラリの導入（exif-js, piexifjs）
- カスタムフィールドに JSON 形式で埋め込み
  - Prompt
  - Model
  - Parameters
  - Timestamp
- 既存のファイル保存処理に統合

**メリット**:
- 画像単体で生成条件を保持
- 後から条件を確認可能
- メタデータからの再生成が可能

---

### Variation生成
**優先度**: 🔵 検討中
**概要**: 既存画像の類似バリエーション生成（seed値による決定論的生成）

**実装内容**:
- `generate_variation`: 既存画像の類似画像生成
- seed 値の制御（Imagen API は対応済み）
  - パラメータ型: `Uint32`（非負整数）
  - 有効範囲: 1 ～ 2,147,483,647
  - 用途: 決定論的な画像生成（同じseed + プロンプトで同じ画像生成）
- または元のプロンプト + ランダム要素追加

**API 制約**:
- seed パラメータは `addWatermark: false` の場合のみ使用可能
- `enhancePrompt: true` の場合、seed パラメータは機能しない
  - 理由: enhancePrompt が新しいプロンプトを生成し、異なる画像が生成されるため

**メリット**:
- 完全な再現性（同じパラメータで同じ画像を生成）
- A/Bテスト向けのバリエーション生成
- デバッグとトラブルシューティングの容易化

**導入の容易性**:
- API対応確認済み、実装は比較的容易
- 既存ツールへの seed パラメータ追加のみで実現可能

---

### フォーマット変換
**概要**: PNG/JPEG/WebP間の変換と圧縮最適化

**実装内容**:
- `convert_format`: 画像フォーマット変換
  - 入力: input_path, output_format, quality
  - Sharp ライブラリを使用（既に依存関係にある）
- 圧縮最適化オプション

**メリット**:
- ファイルサイズの最適化
- 用途に応じたフォーマット選択

---

### Safety Filter Customization
**概要**: より細かい安全性フィルター設定

**実装内容**:
- カテゴリ別の閾値調整
  - SEXUALLY_EXPLICIT: BLOCK_MEDIUM_AND_ABOVE
  - HATE_SPEECH: BLOCK_ONLY_HIGH
  - HARASSMENT: BLOCK_LOW_AND_ABOVE
  - DANGEROUS_CONTENT: BLOCK_MEDIUM_AND_ABOVE
- プリセット設定（strict, moderate, permissive）

**現状**: 全カテゴリ同じ閾値を使用
**改善**: カテゴリごとに異なる閾値を設定可能に

---

## 推奨実装順序

1. **Phase 1A'** (customize_image マルチサンプル) - 30分 ✅ 完了
   - 理由: 既存機能との統一、低リスク

2. **Phase 1B + Phase 2 統合** (Async Jobs + History Tracking) - 5-6時間
   - 理由:
     - タイムアウト対策による信頼性向上（Phase 1B）
     - SQLite統合により再起動耐性とメトリクス集計を同時実現
     - 管理性・再現性の大幅向上（Phase 2）
   - 実装順序: Phase 2（DB設計）→ Phase 1B（ジョブ管理）→ 統合テスト

3. **Phase 4** (Templates) - 1-2時間
   - 理由: ユーザビリティ向上、チーム共有フロー整備

4. **その他の検討項目** - 適宜
   - ユーザーフィードバックに基づいて優先順位付け
   - メタデータ埋め込み、バッチ処理など

---

## 備考

### バージョニング
- Phase 1A: v0.6.0 としてリリース予定
- Phase 1A': v0.6.1
- Phase 1B + Phase 2 統合: v0.7.0（メジャーアップデート）
  - SQLite導入、ジョブ管理、履歴機能
- Phase 4: v0.8.0

### ドキュメント更新
各フェーズ完了後、以下を更新:
- README.md: 新機能の説明
- CHANGELOG.md: 変更履歴
- RELEASE_NOTES.md: リリースノート

### テスト
- 各フェーズで手動テスト実施
- 将来的には自動テストの追加を検討（vitest を使用）

---

**最終更新**: 2025-10-12
**ステータス**: Phase 1A, Phase 1A' 完了、Phase 1B 以降は未着手
