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

### Phase 1C: Resolution Selection（解像度選択対応）
**優先度**: 🟡 中～高（ユーザー要望、早期実装推奨）
**所要時間**: 1時間
**依存関係**: なし

**目的**: 生成画像の出力解像度を選択可能にし、ユーザーのニーズに応じた品質制御を実現

**実装内容**:

1. **新規パラメータ: `sampleImageSize`**
   - 型: `string`
   - 許可値: `"1K"` | `"2K"`
   - デフォルト: `"1K"`
   - 用途: 生成画像の出力解像度を指定

2. **対象ツール**
   - `generate_image`: 画像生成時の解像度選択
   - `edit_image`: 画像編集時の解像度選択
   - `customize_image`: 画像カスタマイズ時の解像度選択
   - `generate_and_upscale_image`: 生成時の解像度選択（アップスケール前）

3. **型定義の更新**
   ```typescript
   // src/types/tools.ts
   export interface GenerateImageArgs {
     // ... 既存フィールド
     sample_count?: number;
     sample_image_size?: "1K" | "2K";  // 追加
   }

   export interface EditImageArgs {
     // ... 既存フィールド
     sample_count?: number;
     sample_image_size?: "1K" | "2K";  // 追加
   }

   export interface CustomizeImageArgs {
     // ... 既存フィールド
     sample_count?: number;
     sample_image_size?: "1K" | "2K";  // 追加
   }

   export interface GenerateAndUpscaleImageArgs {
     // ... 既存フィールド
     sample_image_size?: "1K" | "2K";  // 追加
   }
   ```

4. **スキーマ定義の更新**
   ```typescript
   // src/index.ts - 各ツールのinputSchemaに追加
   sample_image_size: {
     type: "string",
     enum: ["1K", "2K"],
     description: "Output resolution of generated image (default: 1K). 1K for faster generation, 2K for higher quality.",
   }
   ```

5. **API リクエストへの統合**
   - 各生成関数内でパラメータを Imagen API リクエストに追加
   - バリデーション: "1K" または "2K" 以外の値を拒否
   - デフォルト値の処理（省略時は Imagen API のデフォルト "1K" を使用）

**変更ファイル**:
- `src/types/tools.ts`: 全ての生成系 Args インターフェースに追加
- `src/index.ts`: スキーマ定義と各ツール関数の更新

**メリット**:
- ユーザーが品質と生成速度のトレードオフを制御可能
- 高解像度が必要な場合に 2K を選択（プロダクション向け）
- 低解像度で高速プロトタイピング（1K）
- 後方互換性維持（デフォルト値で既存の動作を保証）

**注意点**:
- 2K 生成は 1K より時間がかかる可能性あり
- コスト面での違いがあるか要確認（Google Cloud の課金体系）
- `upscale_image` ツールとの使い分けを明確化
  - 小さい解像度で生成 → upscale（従来の方法）
  - 最初から高解像度で生成（新しい方法）

---

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

### Phase 2: UUID-based History Tracking & Metadata Integration（UUID履歴管理とメタデータ統合）
**優先度**: 🟡 中～高（画像とDB履歴の完全な紐付け）
**所要時間**: 3-4時間
**依存関係**: Phase 1Bと統合推奨

**目的**: 各画像に一意のUUIDを発行し、画像メタデータとDBレコードを完全に紐付け、再現性と追跡性を大幅に向上させる

**実装内容**:

1. **UUID管理システム**
   ```typescript
   import { randomUUID } from 'crypto';

   // 画像生成時に各画像ごとにUUIDを発行
   interface ImageRecord {
     uuid: string;           // 一意のUUID（プライマリキー）
     filePath: string;       // 保存先パス
     toolName: string;       // 使用したツール
     prompt: string;         // プロンプト
     parameters: object;     // 全パラメータ（JSON）
     createdAt: Date;        // 生成日時
     model: string;          // 使用モデル
     // ... その他のメタデータ
   }
   ```

2. **画像メタデータへのUUID埋め込み**
   - **対応フォーマット**:
     - PNG: テキストチャンク（tEXt/zTXt）を使用
     - JPEG: EXIF UserComment フィールドを使用
     - WebP: EXIF/XMP メタデータを使用

   - **埋め込みデータ構造**:
     ```json
     {
       "vertexai_imagen_uuid": "550e8400-e29b-41d4-a716-446655440000",
       "tool_name": "generate_image",
       "prompt": "A serene mountain landscape...",
       "model": "imagen-3.0-generate-001",
       "created_at": "2025-10-12T10:30:00Z",
       "aspect_ratio": "16:9",
       "sample_image_size": "1K",
       "parameters": { /* 全パラメータ */ }
     }
     ```

   - **ライブラリ選定**:
     - PNG: `png-chunk-text` または `sharp` metadata API
     - JPEG: `piexifjs` または `exiftool-vendored`
     - WebP: `sharp` metadata API（WebP EXIF対応）
     - 推奨: `sharp`（既に依存関係にあり、統一的なAPI）

3. **データベース設計（UUIDベース）**
   ```sql
   CREATE TABLE images (
     -- 画像の一意識別子（メタデータと同期）
     uuid TEXT PRIMARY KEY,

     -- 基本情報
     file_path TEXT NOT NULL,
     tool_name TEXT NOT NULL,
     prompt TEXT NOT NULL,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

     -- 生成パラメータ
     model TEXT,
     aspect_ratio TEXT,
     sample_count INTEGER,
     sample_image_size TEXT,
     safety_level TEXT,
     person_generation TEXT,
     language TEXT,

     -- 完全なパラメータ（JSON）
     parameters TEXT NOT NULL,

     -- ステータス
     success BOOLEAN DEFAULT 1,
     error_message TEXT,

     -- ファイル情報
     file_size INTEGER,
     mime_type TEXT,

     -- 検索用インデックス
     prompt_fts TEXT  -- Full-text search用
   );

   -- フルテキスト検索テーブル
   CREATE VIRTUAL TABLE images_fts USING fts5(
     uuid, prompt, parameters,
     content='images'
   );

   -- Phase 1B との統合時
   CREATE TABLE jobs (
     id TEXT PRIMARY KEY,
     type TEXT NOT NULL,
     status TEXT NOT NULL,
     params TEXT NOT NULL,
     result TEXT,  -- 生成されたUUIDの配列を含む
     error TEXT,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     started_at DATETIME,
     completed_at DATETIME
   );
   ```

4. **保存場所（柔軟性重視）**
   - **優先順位**:
     1. 環境変数 `VERTEXAI_IMAGEN_DB`（Phase 1Bと統合時）
     2. 環境変数 `VERTEXAI_IMAGEN_HISTORY_DB`（履歴のみ）
     3. デフォルト: `./data/vertexai-imagen.db`（プロジェクト直下）
   - **理由**:
     - コンテナ/CI環境対応: ホームディレクトリ依存を回避
     - 相対パス使用可能: プロジェクト単位でDB管理
     - 環境変数で柔軟にカスタマイズ可能

5. **画像生成フローの統合**
   ```typescript
   async function generateImage(...) {
     // 1. 各画像にUUIDを発行
     const imageUUIDs = Array.from(
       { length: sample_count },
       () => randomUUID()
     );

     // 2. API呼び出し
     const response = await imagenAPI.generate(...);

     // 3. 画像保存 + メタデータ埋め込み
     for (let i = 0; i < response.predictions.length; i++) {
       const imageData = response.predictions[i];
       const uuid = imageUUIDs[i];

       // 画像バッファにメタデータを埋め込み
       const imageWithMetadata = await embedMetadata(
         imageData,
         {
           vertexai_imagen_uuid: uuid,
           tool_name: 'generate_image',
           prompt: prompt,
           model: model,
           // ... その他のパラメータ
         }
       );

       // ファイル保存
       await fs.writeFile(filePath, imageWithMetadata);

       // 4. DB記録
       await db.run(
         'INSERT INTO images (uuid, file_path, ...) VALUES (?, ?, ...)',
         [uuid, filePath, ...]
       );
     }
   }
   ```

6. **新規ツール**
   - `list_history`: 履歴一覧表示
     - フィルタ: tool_name, date_range, model, aspect_ratio
     - ソート: created_at DESC
     - ページネーション対応
     - 出力: UUID, prompt, created_at, file_path など

   - `get_history_by_uuid`: UUID指定で履歴詳細取得
     - 入力: uuid
     - 出力: 完全なパラメータ、画像パス、メタデータ
     - **DB不要**: 画像メタデータからも情報取得可能

   - `get_metadata_from_image`: 画像ファイルからメタデータ読み取り
     - 入力: image_path
     - 出力: UUID、生成パラメータ、タイムスタンプ
     - 用途: DBにない画像でも情報取得可能

   - `regenerate_from_uuid`: UUID指定で再生成
     - 入力: uuid, override_params?
     - 動作: DBまたは画像メタデータから元のパラメータ取得 → 再生成
     - 出力: 新しい画像（新しいUUIDを付与）

   - `search_history`: プロンプト検索（フルテキスト検索）
     - 入力: query, limit?, filters?
     - 出力: matching UUIDs, previews
     - FTS5による高速検索

   - `delete_history`: 履歴削除
     - 入力: uuid, delete_file? (default: false)
     - 動作: DB記録削除、オプションで画像ファイルも削除

   - `sync_metadata_to_db`: 画像メタデータをDBに同期
     - 入力: directory?
     - 動作: 指定ディレクトリ内の画像をスキャン、メタデータ読み取り、DB更新
     - 用途: DBを失った場合の復旧、他環境からの画像インポート

7. **自動記録フロー**
   ```
   画像生成 → UUID発行 → API呼び出し → 画像保存 + メタデータ埋め込み → DB記録
                ↓
   成功/失敗両方を記録（エラーメッセージも保存）
   ```

**メリット**:
- **画像とDB履歴の完全な紐付け**: UUIDにより確実に対応関係を保証
- **画像単体で完結**: メタデータから生成条件を確認可能（DB不要）
- **柔軟な履歴管理**: DBを失っても画像から復旧可能
- **再現性の保証**: パラメータの完全な記録
- **高度な検索**: フルテキスト検索、複数条件フィルタ
- **トラブルシューティング**: 画像ファイルだけで問題を特定可能
- **コスト分析**: 生成回数、使用モデルの統計
- **チーム共有**: 画像ファイル共有時にメタデータも伝達

**考慮事項**:
- **メタデータサイズ**: 大きなJSON埋め込み時のファイルサイズ増加（数KB程度）
- **プライバシー**: プロンプト内容が画像に埋め込まれる（環境変数で無効化可能にする）
- **互換性**: 古い画像（UUID未埋め込み）への対応
  - `sync_metadata_to_db` でファイル名/パスベースの紐付けを試行
  - または手動でUUID追加機能を提供

**環境変数設定**:
```bash
# メタデータ埋め込み有効化（デフォルト: true）
VERTEXAI_IMAGEN_EMBED_METADATA=true

# 埋め込むメタデータの詳細レベル
# "minimal" - UUIDのみ
# "standard" - UUID + 主要パラメータ（デフォルト）
# "full" - UUID + 全パラメータ
VERTEXAI_IMAGEN_METADATA_LEVEL=standard
```

**変更ファイル**:
- `src/utils/metadata.ts`: 新規作成（UUID生成、メタデータ埋め込み/読み取り）
- `src/utils/database.ts`: 新規作成（SQLite接続、CRUD操作、FTS5検索）
- `src/index.ts`: 各ツール関数にUUID管理とDB記録を統合
- `src/types/tools.ts`: ImageRecord などの型定義追加
- `package.json`: 依存関係追加（`better-sqlite3` など）

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
**ステータス**: ✅ Phase 2 に統合済み

UUID-based History Tracking & Metadata Integration（Phase 2）として実装予定。
- 各画像に一意のUUIDを発行し、画像メタデータとDBレコードを完全に紐付け
- PNG/JPEG/WebP 対応のメタデータ埋め込み
- DBを失っても画像から履歴復旧可能

詳細は Phase 2 を参照。

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

2. **Phase 1C** (解像度選択対応) - 1時間 ⬅️ 次の実装推奨
   - 理由:
     - ユーザー要望による早期実装
     - 実装が容易かつ低リスク
     - 全ての生成ツールで品質制御が可能に
     - Phase 1B/2 の複雑な実装の前に完了できる小規模改善
   - メリット: 高解像度生成オプション、プロトタイピング速度向上

3. **Phase 1B + Phase 2 統合** (Async Jobs + UUID-based History Tracking) - 7-9時間
   - 理由:
     - タイムアウト対策による信頼性向上（Phase 1B）
     - SQLite統合により再起動耐性とメトリクス集計を同時実現
     - UUID + メタデータ埋め込みによる完全な追跡性（Phase 2）
     - 画像とDB履歴の完全な紐付け、復旧可能性
   - 実装順序: Phase 2（DB設計 + UUID管理）→ Phase 1B（ジョブ管理）→ 統合テスト
   - Phase 2 の独立実装も可能（3-4時間）

4. **Phase 4** (Templates) - 1-2時間
   - 理由: ユーザビリティ向上、チーム共有フロー整備

5. **その他の検討項目** - 適宜
   - ユーザーフィードバックに基づいて優先順位付け
   - seed パラメータ（Variation生成）
   - メタデータ埋め込み、バッチ処理など

---

## 備考

### バージョニング
- Phase 1A: v0.6.0 としてリリース予定
- Phase 1A': v0.6.1
- Phase 1C: v0.6.2（解像度選択対応）
  - sampleImageSize パラメータ追加（全生成ツール）
- Phase 2 単独: v0.7.0（メジャーアップデート）
  - UUID管理システム、画像メタデータ埋め込み、履歴DB、フルテキスト検索
- Phase 1B + Phase 2 統合: v0.7.5 または v0.8.0（統合アップデート）
  - 非同期ジョブ管理 + UUID履歴管理の統合
  - SQLite統合、再起動耐性、完全な追跡性
- Phase 4: v0.9.0 または v1.0.0

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
**ステータス**: Phase 1A, Phase 1A' 完了、Phase 1C が次の実装対象（早期実装推奨）
