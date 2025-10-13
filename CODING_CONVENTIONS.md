# コーディング規約

このドキュメントは、vertexai-imagen-mcp-server プロジェクトで使用されるコーディング規約をまとめたものです。

## 目次

1. [プロジェクト構成](#プロジェクト構成)
2. [TypeScript設定](#typescript設定)
3. [命名規則](#命名規則)
4. [ファイル構成とモジュール分割](#ファイル構成とモジュール分割)
5. [型定義](#型定義)
6. [エラーハンドリング](#エラーハンドリング)
7. [コメントとドキュメント](#コメントとドキュメント)
8. [インポート規則](#インポート規則)
9. [非同期処理](#非同期処理)
10. [デバッグとログ](#デバッグとログ)

---

## プロジェクト構成

```
src/
├── config/          # 設定ファイル（定数、環境変数）
├── data/            # 静的データ（セマンティッククラスなど）
├── tools/           # MCPツール実装（各ツールごとに1ファイル）
├── types/           # TypeScript型定義
├── utils/           # ユーティリティ関数
│   ├── auth.ts       # 認証関連
│   ├── database.ts   # データベース操作
│   ├── image.ts      # 画像処理
│   ├── metadata.ts   # メタデータ管理
│   ├── path.ts       # パス処理
│   ├── resources.ts  # MCPリソース管理
│   ├── jobManager.ts # ジョブ管理
│   └── templateManager.ts  # テンプレート管理
└── index.ts         # メインエントリーポイント
```

### ディレクトリの役割

- **config/**: 環境変数から読み取る設定や定数を定義
- **data/**: 静的なマスターデータ（変更頻度が低いデータ）
- **tools/**: MCPツールの実装。1ツール = 1ファイル
- **types/**: TypeScript型定義のみ（実装を含まない）
- **utils/**: 再利用可能なユーティリティ関数とクラス
- **index.ts**: MCPサーバーのメインロジック、ツール登録

---

## TypeScript設定

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "allowSyntheticDefaultImports": true
  }
}
```

### 重要な設定

- **strict: true**: 厳格な型チェックを有効化
- **ES2022**: モダンなJavaScript機能を使用
- **ESNext**: ES Modules (import/export) を使用

---

## 命名規則

### ファイル名

- **camelCase**: 通常のファイル（例: `generateImage.ts`, `templateManager.ts`）
- **kebab-case**: データファイル（例: `semantic-classes.ts`）
- **PascalCase**: クラスが主体のファイル（推奨しないが、許容）

### 変数・関数

```typescript
// ✅ Good
const outputPath = './images/test.png';
const sampleCount = 4;
async function generateImage(args: GenerateImageArgs) { ... }

// ❌ Bad
const OutputPath = './images/test.png';
const sample_count = 4;
async function GenerateImage(args: GenerateImageArgs) { ... }
```

- **camelCase**: 変数、関数、メソッド
- **PascalCase**: 型、インターフェース、クラス

### 定数

```typescript
// ✅ Good
const TOOL_GENERATE_IMAGE = "generate_image";
const GOOGLE_IMAGEN_EDIT_MODEL = 'imagen-3.0-capability-001';

// 環境変数から読み取る場合
export const GOOGLE_IMAGEN_EDIT_MODEL =
  process.env.GOOGLE_IMAGEN_EDIT_MODEL || 'imagen-3.0-capability-001';
```

- **UPPER_SNAKE_CASE**: 定数、環境変数

### 型定義

```typescript
// ✅ Good
export interface GenerateImageArgs { ... }
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

// ❌ Bad
export interface generateImageArgs { ... }
export type jobStatus = 'pending' | 'running' | 'completed' | 'failed';
```

- **PascalCase**: インターフェース、型エイリアス

---

## ファイル構成とモジュール分割

### 原則

1. **Single Responsibility Principle (単一責任の原則)**
   - 1ファイル = 1つの責務
   - 1つのMCPツール = 1つのファイル

2. **関数は機能ごとに分割**
   - 1つの関数は1つの処理を担当
   - 再利用可能な部分はユーティリティ関数として分離

### MCPツール実装の例

`src/tools/generateImage.ts`:

```typescript
import { ... } from '../utils/...';
import type { ... } from '../types/...';

/**
 * 画像生成ツール
 */
export async function generateImage(
  context: ToolContext,
  args: GenerateImageArgs,
) {
  // 1. パラメータの取得とデフォルト値設定
  const {
    prompt,
    output_path = 'generated_image.png',
    aspect_ratio = '1:1',
    // ...
  } = args;

  // 2. バリデーション
  if (!prompt || typeof prompt !== 'string') {
    throw new McpError(ErrorCode.InvalidParams, '...');
  }

  // 3. パス処理
  const normalizedPath = await normalizeAndValidatePath(output_path);

  // 4. API呼び出し
  const response = await axios.post(...);

  // 5. 結果処理
  // ...

  return createUriImageResponse(...);
}
```

### ユーティリティ関数の分離

- **path.ts**: パス処理関連（正規化、検証、変換）
- **auth.ts**: 認証関連（トークン取得、プロジェクトID取得）
- **image.ts**: 画像処理関連（レスポンス生成、サムネイル作成）
- **metadata.ts**: メタデータ関連（UUID生成、ハッシュ計算、埋め込み）

---

## 型定義

### 型定義の配置

すべての型定義は `src/types/` ディレクトリに集約します。

```
src/types/
├── tools.ts       # MCPツールの引数型
├── api.ts         # Google Imagen APIのリクエスト・レスポンス型
├── job.ts         # ジョブ管理の型
├── history.ts     # 履歴管理の型
├── template.ts    # テンプレート管理の型
└── png-chunks.d.ts # 外部ライブラリの型定義
```

### インターフェース定義の例

```typescript
/**
 * MCPツール引数型定義
 */
export interface GenerateImageArgs {
  prompt: string;
  output_path?: string;
  aspect_ratio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  return_base64?: boolean;
  include_thumbnail?: boolean;
  safety_level?: "BLOCK_NONE" | "BLOCK_ONLY_HIGH" | "BLOCK_MEDIUM_AND_ABOVE" | "BLOCK_LOW_AND_ABOVE";
  person_generation?: "DONT_ALLOW" | "ALLOW_ADULT" | "ALLOW_ALL";
  language?: "auto" | "en" | "zh" | "zh-TW" | "hi" | "ja" | "ko" | "pt" | "es";
  model?: "imagen-4.0-ultra-generate-001" | "imagen-4.0-fast-generate-001" | "imagen-4.0-generate-001" | "imagen-3.0-generate-002" | "imagen-3.0-fast-generate-001";
  region?: string;
  sample_count?: number;
  sample_image_size?: "1K" | "2K";
}
```

### 型の命名規則

- **Args**: MCPツールの引数型（例: `GenerateImageArgs`）
- **Request/Response**: API通信の型（例: `GoogleImagenRequest`, `GoogleImagenResponse`）
- **Record**: データベースのレコード型（例: `ImageRecord`）
- **Context**: 共有コンテキスト型（例: `ToolContext`）

---

## エラーハンドリング

### McpError の使用

MCPプロトコルの標準エラーを使用します。

```typescript
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// ✅ Good
if (!prompt || typeof prompt !== 'string') {
  throw new McpError(
    ErrorCode.InvalidParams,
    'prompt is required and must be a string',
  );
}

// ❌ Bad
if (!prompt) {
  throw new Error('prompt is required');
}
```

### エラーコードの使い分け

- **InvalidParams**: パラメータが不正
- **InvalidRequest**: 認証エラー、リクエスト自体の問題
- **InternalError**: サーバーエラー、予期しないエラー
- **MethodNotFound**: 存在しないツール・メソッド

### API エラーのハンドリング

```typescript
try {
  const response = await axios.post<GoogleImagenResponse>(apiUrl, requestBody, {
    headers: { ... },
    timeout: 30000,
  });
  // ...
} catch (error) {
  if (axios.isAxiosError(error)) {
    const errorMessage = error.response?.data?.error?.message || error.message;
    const errorCode = error.response?.status;

    if (errorCode === 401 || errorCode === 403) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Google Imagen API authentication error: ${errorMessage}`,
      );
    }
    if (errorCode === 400) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Google Imagen API invalid parameter error: ${errorMessage}`,
      );
    }
    if (errorCode && errorCode >= 500) {
      throw new McpError(
        ErrorCode.InternalError,
        `Google Imagen API server error: ${errorMessage}`,
      );
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Google Imagen API error: ${errorMessage}`,
    );
  }

  throw error;
}
```

### 警告の処理

エラーではないが、ユーザーに通知すべき場合は `console.error` を使用します。

```typescript
// ✅ Good
console.error('[WARNING] return_base64=true is deprecated and consumes ~1,500 tokens.');

if (process.env.DEBUG) {
  console.error(`[DEBUG] API Error ${errorCode}: ${errorMessage}`);
}
```

---

## コメントとドキュメント

### JSDoc コメント

クラス、関数、重要な変数には JSDoc コメントを付けます。

```typescript
/**
 * テンプレート保存ディレクトリを取得
 * 優先順位:
 * 1. 環境変数 VERTEXAI_IMAGEN_TEMPLATES_DIR
 * 2. 画像出力先フォルダ配下 [VERTEXAI_IMAGEN_OUTPUT_DIR]/templates (デフォルト)
 * 3. プロジェクトレベル ./templates
 * 4. ユーザーレベル ~/.vertexai-imagen/templates
 */
export function getTemplateDirectory(): string {
  // ...
}
```

### インラインコメント

複雑なロジックには説明コメントを追加します。

```typescript
// パラメータハッシュの計算（履歴管理用）
const params = { prompt, model, aspect_ratio, ... };
const paramsHash = calculateParamsHash(params);

// メタデータ埋め込み
if (metadataEmbeddingEnabled) {
  const metadata: ImageMetadata = { ... };
  imageBuffer = await embedMetadata(imageBuffer, metadata);
}
```

### セクションコメント

長いファイルはセクションで区切ります。

```typescript
// =====================================
// 画像履歴管理メソッド
// =====================================

/**
 * 画像履歴を作成
 */
createImageHistory(record: ImageRecord): void {
  // ...
}
```

---

## インポート規則

### インポート順序

1. Node.js標準ライブラリ
2. サードパーティライブラリ
3. プロジェクト内部のインポート（utils, types, tools）

```typescript
// ✅ Good
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

import axios from 'axios';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

import { normalizeAndValidatePath } from '../utils/path.js';
import type { GenerateImageArgs } from '../types/tools.js';
import type { ToolContext } from './types.js';
```

### 型インポート

型のみをインポートする場合は `type` キーワードを使用します。

```typescript
// ✅ Good
import type { GenerateImageArgs } from '../types/tools.js';
import type { ToolContext } from './types.js';

// ❌ Bad
import { GenerateImageArgs } from '../types/tools.js';
```

### .js拡張子

ES Modules では相対インポートに `.js` 拡張子が必要です。

```typescript
// ✅ Good
import { getDefaultOutputDirectory } from './utils/path.js';

// ❌ Bad
import { getDefaultOutputDirectory } from './utils/path';
```

---

## 非同期処理

### async/await の使用

Promise は `async/await` で処理します。

```typescript
// ✅ Good
export async function generateImage(
  context: ToolContext,
  args: GenerateImageArgs,
) {
  const normalizedPath = await normalizeAndValidatePath(output_path);
  const response = await axios.post(...);
  await fs.writeFile(absoluteFilePath, imageBuffer);
}

// ❌ Bad
export function generateImage(
  context: ToolContext,
  args: GenerateImageArgs,
) {
  return normalizeAndValidatePath(output_path)
    .then(path => axios.post(...))
    .then(response => fs.writeFile(...));
}
```

### エラーハンドリング

`try-catch` でエラーをキャッチし、適切に処理します。

```typescript
try {
  await fs.writeFile(absoluteFilePath, imageBuffer);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new McpError(
    ErrorCode.InternalError,
    `Failed to save image: ${errorMessage}`
  );
}
```

---

## デバッグとログ

### デバッグログ

`DEBUG` 環境変数が設定されている場合のみログ出力します。

```typescript
if (process.env.DEBUG) {
  console.error(`[DEBUG] generate_image: model=${model}, aspect=${aspect_ratio}`);
  console.error(`[DEBUG] Saving ${predictions.length} generated image(s)`);
}
```

### 警告ログ

非推奨機能や注意すべき挙動には警告を出力します。

```typescript
console.error('[WARNING] return_base64=true is deprecated and consumes ~1,500 tokens.');
console.error(`[WARNING] Failed to embed metadata for ${uuid}: ${errorMsg}`);
```

### ログ出力先

- **console.error**: 標準エラー出力（MCPサーバーのログとして記録される）
- **console.log**: 使用禁止（MCPプロトコルの標準出力と衝突する可能性）

---

## クラス設計

### クラス命名

```typescript
// ✅ Good
export class JobDatabase { ... }
export class JobManager { ... }
export class ImageResourceManager { ... }

// ❌ Bad
export class jobDatabase { ... }
export class job_manager { ... }
```

### プライベートメソッド

外部に公開しないメソッドは `private` を使用します。

```typescript
export class JobDatabase {
  private db: Database.Database;

  constructor(dbPath: string) { ... }

  /**
   * 外部公開メソッド
   */
  createJob(job: Job): void { ... }

  /**
   * 内部専用メソッド
   */
  private rowToJob(row: any): Job { ... }
}
```

---

## まとめ

このコーディング規約は、プロジェクトの保守性と可読性を向上させるためのものです。新しい機能を追加する際は、この規約に従ってコードを記述してください。

### チェックリスト

- [ ] ファイルは適切なディレクトリに配置されているか
- [ ] 型定義は `src/types/` に分離されているか
- [ ] 再利用可能な関数は `src/utils/` に分離されているか
- [ ] 1つの関数は1つの責務のみを持っているか
- [ ] エラーハンドリングは適切に行われているか
- [ ] JSDocコメントは記述されているか
- [ ] インポートは適切な順序で記述されているか
- [ ] `async/await` を使用しているか
- [ ] デバッグログは `DEBUG` 環境変数でコントロールされているか
