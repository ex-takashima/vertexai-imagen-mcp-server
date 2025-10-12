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

## 実装予定

### Phase 1A': customize_image Multi-sample Support
**優先度**: 🟡 中
**所要時間**: 30分程度
**依存関係**: Phase 1A（完了済み）

**目的**: customize_image ツールに sample_count パラメータを追加し、generate_image/edit_image と機能を統一する

**実装内容**:
1. **Schema 更新** (src/index.ts)
   - `TOOL_CUSTOMIZE_IMAGE` の inputSchema に `sample_count` パラメータ追加
   - type: integer, minimum: 1, maximum: 4, default: 1

2. **Type 定義更新** (src/types/tools.ts)
   - `CustomizeImageArgs` に `sample_count?: number` を追加

3. **API リクエスト更新** (src/index.ts)
   - `customizeImage()` 関数のパラメータに `sample_count = 1` を追加
   - `requestBody.parameters.sampleCount` を変数化（現在は固定値 1）
   - Validation 追加: `if (sample_count < 1 || sample_count > 4)`

4. **ファイル保存処理更新**
   - `generateMultipleFilePaths()` を使用してファイルパス生成
   - 複数 predictions のループ処理
   - imageInfos 配列の構築

5. **レスポンス処理更新**
   - `sample_count === 1`: `createUriImageResponse()` を使用
   - `sample_count > 1`: `createMultiUriImageResponse()` を使用
   - base64 モードの警告追加（複数画像時）

**注意点**:
- Reference images (control/subject/style) との組み合わせで API 制限がある可能性
- 特に non-square aspect ratio + 複数 reference types の制限に注意
- 既存の制限チェック（line 818-826）を維持

**テスト項目**:
- [ ] single sample (sample_count=1) で正常動作
- [ ] multiple samples (sample_count=2-4) で正常動作
- [ ] control + sample_count の組み合わせ
- [ ] subject + sample_count の組み合わせ
- [ ] style + sample_count の組み合わせ
- [ ] base64 mode で警告が出ること

---

### Phase 1B: Asynchronous Job Management（非同期ジョブ管理）
**優先度**: 🟢 低
**所要時間**: 3-4時間
**依存関係**: なし

**目的**: 長時間実行のジョブを非同期で管理し、タイムアウトを回避する

**実装内容**:

1. **ジョブ管理システム**
   ```typescript
   interface Job {
     id: string;
     type: 'generate' | 'edit' | 'customize' | 'upscale';
     status: 'pending' | 'running' | 'completed' | 'failed';
     params: any;
     result?: any;
     error?: string;
     createdAt: Date;
     startedAt?: Date;
     completedAt?: Date;
   }
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

3. **ストレージ**
   - 簡易実装: メモリベース（Map<string, Job>）
   - 本格実装: SQLite または外部 Redis

4. **ワーカー実装**
   - Promise ベースの非同期実行
   - 同時実行数の制限（デフォルト: 2-3）
   - タイムアウト設定（ジョブ単位）

**メリット**:
- タイムアウト回避（特に upscale や multiple samples）
- 複数ジョブの並列実行
- UX向上（即座にレスポンス）
- リトライ機能の実装が容易

**デメリット**:
- 実装の複雑性増加
- ステート管理が必要
- MCP クライアント側でポーリングが必要

---

### Phase 2: History Tracking（履歴追跡）
**優先度**: 🟡 中
**所要時間**: 2-3時間
**依存関係**: なし

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
   ```

2. **保存場所**
   - SQLite: `~/.vertexai-imagen-history.db`
   - または環境変数: `VERTEXAI_IMAGEN_HISTORY_DB`

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

### Phase 3: Preview API（低解像度→高解像度）
**優先度**: 🟢 低
**所要時間**: 2-3時間（API仕様調査含む）
**依存関係**: なし

**目的**: まず低解像度でプレビュー生成し、確認後に高解像度生成することでコストを最適化

**調査が必要な項目**:
1. Imagen API に明示的な「プレビューモード」があるか？
2. 解像度の制御方法（aspect_ratio の小さい版？）
3. プレビュー→高解像度の変換フロー

**想定実装**:

1. **プレビュー生成**
   - `generate_preview`: 低解像度画像生成
     - 小さい aspect_ratio を使用（1:1 を縮小？）
     - または特別な preview パラメータ（API仕様次第）
     - 高速・低コスト

2. **高解像度化**
   - プレビュー確認後、`upscale_preview` で高解像度化
   - 既存の upscale 機能との統合
   - または元のパラメータで再生成

3. **ワークフロー**
   ```
   User → generate_preview() → Preview Image (512x512)
        → 確認 OK
        → upscale_preview() → Full Resolution Image
   ```

**代替案（API制限がある場合）**:
- 小さい aspect_ratio + upscale の組み合わせで実現
- sample_count=1 で試行→確認→sample_count=4 で本生成

**メリット**:
- API コスト削減（試行錯誤時）
- 生成時間の短縮（プレビュー段階）
- ユーザー体験の向上

**デメリット**:
- ワークフローが複雑化
- API が対応していない可能性

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

2. **保存場所**
   - `~/.vertexai-imagen-templates/` ディレクトリ
   - または `.claude/prompt_templates/`
   - 環境変数: `VERTEXAI_IMAGEN_TEMPLATES_DIR`

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
**概要**: 既存画像の類似バリエーション生成

**実装内容**:
- `generate_variation`: 既存画像の類似画像生成
- seed 値の制御（API が対応している場合）
- または元のプロンプト + ランダム要素追加

**API 制限**:
- Imagen API が seed 制御に対応しているか要確認
- 対応していない場合は代替手法を検討

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

1. **Phase 1A'** (customize_image マルチサンプル) - 30分
   - 理由: 既存機能との統一、低リスク

2. **Phase 2** (History Tracking) - 2-3時間
   - 理由: 管理性・再現性の大幅向上

3. **Phase 1B** (Async Jobs) - 3-4時間
   - 理由: タイムアウト問題の解決

4. **Phase 4** (Templates) - 1-2時間
   - 理由: ユーザビリティ向上

5. **Phase 3** (Preview API) - 2-3時間
   - 理由: API仕様調査が必要、優先度低

6. **その他の検討項目** - 適宜
   - ユーザーフィードバックに基づいて優先順位付け

---

## 備考

### バージョニング
- Phase 1A: v0.6.0 としてリリース予定
- Phase 1A': v0.6.1
- Phase 2: v0.7.0
- Phase 1B: v0.8.0

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
**ステータス**: Phase 1A 完了、Phase 1A' 以降は未着手
