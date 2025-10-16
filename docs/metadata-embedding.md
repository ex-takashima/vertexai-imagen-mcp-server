# 画像メタデータ埋め込み機構

## 概要

このMCPサーバーは、生成した画像ファイルに生成パラメータなどのメタデータを直接埋め込む機能を提供します。これにより、画像ファイル単体で以下の情報を保持できます：

- 画像の一意なUUID
- 生成パラメータのハッシュ値（整合性検証用）
- 生成ツール名、モデル名、作成日時
- アスペクト比、解像度などの設定
- プロンプト（フルレベルの場合）

## 目的

1. **トレーサビリティ**: 画像がどのように生成されたかを追跡可能
2. **整合性検証**: パラメータハッシュで改ざん検出
3. **再現性**: 同じパラメータで再生成可能
4. **ポータビリティ**: ファイル単体で情報を持ち運び可能
5. **データベース連携**: UUIDでデータベース履歴と紐付け

## 設定方法

### 環境変数

| 環境変数 | 説明 | デフォルト値 | 設定値 |
|---------|------|------------|--------|
| `VERTEXAI_IMAGEN_EMBED_METADATA` | メタデータ埋め込みを有効化 | `true` | `true`, `false`, `0` |
| `VERTEXAI_IMAGEN_METADATA_LEVEL` | 埋め込むメタデータの詳細度 | `standard` | `minimal`, `standard`, `full` |

### メタデータレベルの詳細

#### 1. minimal（最小限）

**埋め込まれる情報**:
- `vertexai_imagen_uuid`: 画像の一意なUUID
- `params_hash`: パラメータのSHA-256ハッシュ

**使用ケース**:
- ファイルサイズを最小限に抑えたい
- UUIDによる識別のみ必要
- データベースに詳細情報がある

**ファイルサイズ影響**: +100-200 bytes

#### 2. standard（標準）

**埋め込まれる情報**:
- minimal のすべて
- `tool_name`: 使用したツール名
- `model`: 使用したモデル名
- `created_at`: 作成日時（ISO 8601形式）
- `aspect_ratio`: アスペクト比
- `sample_image_size`: 解像度（1K/2K）

**使用ケース**:
- バランスの取れた情報量
- 基本的な生成情報を保持
- **推奨設定**

**ファイルサイズ影響**: +300-500 bytes

#### 3. full（完全）

**埋め込まれる情報**:
- standard のすべて
- `prompt`: テキストプロンプト
- `parameters`: 全生成パラメータ（JSON）

**使用ケース**:
- 完全な再現性が必要
- データベースなしで情報を保持
- アーカイブ・バックアップ目的

**ファイルサイズ影響**: +1KB-5KB（プロンプト長に依存）

## アーキテクチャ

### ファイル構成

```
src/
├── utils/
│   ├── metadata.ts           # メタデータ処理のコアロジック
│   └── database.ts           # SQLiteデータベース管理
├── types/
│   └── history.ts            # メタデータ型定義
└── tools/
    ├── generateImage.ts      # メタデータ埋め込みを実行
    ├── getMetadataFromImage.ts  # メタデータ読み取り
    └── ...
```

### 処理フロー

```
画像生成
  ↓
1. UUID生成
   - randomUUID() でユニークなIDを発行
  ↓
2. パラメータハッシュ計算
   - SHA-256ハッシュ生成
   - キーをソートして一貫性を保証
  ↓
3. メタデータオブジェクト構築
   - レベルに応じて情報をフィルタリング
  ↓
4. 画像バッファに埋め込み
   - PNG: tEXtチャンク
   - JPEG/WebP: EXIF ImageDescription
  ↓
5. ファイル保存
  ↓
6. データベース記録
   - 同じUUIDで履歴を保存
   - 詳細なパラメータを記録
```

## 実装詳細

### 1. UUID生成 (`generateImageUUID`)

```typescript
import { randomUUID } from 'crypto';

export function generateImageUUID(): string {
  return randomUUID();
}
```

- Node.js標準の `crypto.randomUUID()` を使用
- RFC 4122準拠のv4 UUID
- 128ビット（16バイト）のランダム識別子

**例**: `"f47ac10b-58cc-4372-a567-0e02b2c3d479"`

### 2. パラメータハッシュ計算 (`calculateParamsHash`)

```typescript
export function calculateParamsHash(params: Record<string, any>): string {
  // キーをソートして一貫性を保証
  const sortedKeys = Object.keys(params).sort();
  const sortedParams: Record<string, any> = {};

  for (const key of sortedKeys) {
    sortedParams[key] = params[key];
  }

  const paramsJson = JSON.stringify(sortedParams);
  return createHash('sha256').update(paramsJson, 'utf8').digest('hex');
}
```

**特徴**:
- SHA-256アルゴリズム使用
- キーをソートして順序に依存しない
- JSON文字列化して一貫性を確保
- 64文字の16進数文字列を返却

**例**: `"a3c65f...89def2"` (64文字)

### 3. メタデータ埋め込み (`embedMetadata`)

#### PNG形式の場合

**使用ライブラリ**:
- `png-chunks-extract`: PNGチャンクの抽出
- `png-chunks-encode`: PNGチャンクの再構築
- `png-chunk-text`: tEXtチャンクの作成

**処理**:

```typescript
// 1. PNGチャンクを抽出
const chunks = extract(imageBuffer);

// 2. tEXtチャンクを作成
const textChunk = text.encode('vertexai_imagen_metadata', metadataJson);

// 3. IENDチャンクの前に挿入（PNGの仕様）
const iendIndex = chunks.findIndex(chunk => chunk.name === 'IEND');
chunks.splice(iendIndex, 0, textChunk);

// 4. PNGバッファを再構築
return Buffer.from(encode(chunks));
```

**PNGチャンク構造**:

```
PNG Signature
IHDR (ヘッダ)
...その他のチャンク...
tEXt (← ここにメタデータを挿入)
  - Keyword: "vertexai_imagen_metadata"
  - Text: JSON文字列
IEND (終端、必ず最後)
```

#### JPEG/WebP形式の場合

**使用ライブラリ**:
- `sharp`: 画像処理ライブラリ

**処理**:

```typescript
return await image
  .jpeg({ quality: 95 })  // または .webp({ quality: 95 })
  .withMetadata({
    exif: {
      IFD0: {
        ImageDescription: metadataJson  // ← ここにJSONを格納
      }
    }
  })
  .toBuffer();
```

**注意点**:
- 品質95で再エンコード（非可逆圧縮）
- 元のJPEG品質より劣化する可能性あり
- PNGより情報量が多い場合は注意

### 4. メタデータ抽出 (`extractMetadataFromImage`)

#### PNG形式の場合

```typescript
// ファイルを読み込み
const fileBuffer = await fs.readFile(imagePath);
const chunks = extract(fileBuffer);

// vertexai_imagen_metadataチャンクを探す
const metadataChunk = chunks.find(
  chunk => chunk.name === 'tEXt' &&
  text.decode(chunk.data).keyword === 'vertexai_imagen_metadata'
);

if (metadataChunk) {
  const decoded = text.decode(metadataChunk.data);
  const extractedMetadata = JSON.parse(decoded.text);
  return extractedMetadata;
}
```

#### JPEG/WebP形式の場合

```typescript
const metadata = await image.metadata();

if (metadata.exif) {
  const exifBuffer = metadata.exif;
  const exifString = exifBuffer.toString('utf8', 0, Math.min(exifBuffer.length, 10000));

  // JSON文字列を探す（vertexai_imagen_uuidを含む）
  const jsonMatch = exifString.match(/\{[^{}]*vertexai_imagen_uuid[^{}]*\}/);

  if (jsonMatch) {
    const extractedMetadata = JSON.parse(jsonMatch[0]);
    return extractedMetadata;
  }
}
```

### 5. 整合性検証 (`verifyIntegrity`)

```typescript
export function verifyIntegrity(
  imageMetadata: ImageMetadata,
  dbParams: Record<string, any>
): { valid: boolean; message: string }
```

**処理**:

1. 画像から抽出したメタデータの `params_hash` を取得
2. データベースのパラメータから新たにハッシュを計算
3. 両者を比較

**検証結果**:

```typescript
// 一致する場合
{
  valid: true,
  message: 'Image integrity verified: hash values match'
}

// 不一致の場合
{
  valid: false,
  message: 'Image integrity check failed: hash mismatch...'
}
```

**使用ケース**:
- 画像ファイルが改ざんされていないか確認
- データベースとの整合性チェック
- 再現性の保証

## データ構造

### ImageMetadata型

```typescript
export interface ImageMetadata {
  // 必須（全レベル共通）
  vertexai_imagen_uuid: string;
  params_hash: string;

  // standard レベル以上
  tool_name?: string;
  model?: string;
  created_at?: string;
  aspect_ratio?: string;
  sample_image_size?: string;

  // full レベルのみ
  prompt?: string;
  parameters?: Record<string, any>;
}
```

### メタデータJSONの例

#### minimal レベル

```json
{
  "vertexai_imagen_uuid": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "params_hash": "a3c65f7b89def2..."
}
```

#### standard レベル（デフォルト）

```json
{
  "vertexai_imagen_uuid": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "params_hash": "a3c65f7b89def2...",
  "tool_name": "generate_image",
  "model": "imagen-3.0-generate-002",
  "created_at": "2024-01-15T10:30:00.000Z",
  "aspect_ratio": "16:9",
  "sample_image_size": "1K"
}
```

#### full レベル

```json
{
  "vertexai_imagen_uuid": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "params_hash": "a3c65f7b89def2...",
  "tool_name": "generate_image",
  "model": "imagen-3.0-generate-002",
  "created_at": "2024-01-15T10:30:00.000Z",
  "aspect_ratio": "16:9",
  "sample_image_size": "1K",
  "prompt": "A beautiful sunset over the ocean",
  "parameters": {
    "prompt": "A beautiful sunset over the ocean",
    "model": "imagen-3.0-generate-002",
    "aspect_ratio": "16:9",
    "safety_level": "BLOCK_MEDIUM_AND_ABOVE",
    "person_generation": "DONT_ALLOW",
    "language": "auto",
    "sample_count": 1,
    "sample_image_size": "1K"
  }
}
```

## ツールとの連携

### 画像生成時の埋め込み

```typescript
// src/tools/generateImage.ts

const metadataEmbeddingEnabled = isMetadataEmbeddingEnabled();

if (metadataEmbeddingEnabled) {
  const metadata: ImageMetadata = {
    vertexai_imagen_uuid: uuid,
    params_hash: paramsHash,
    tool_name: 'generate_image',
    model,
    created_at: new Date().toISOString(),
    aspect_ratio,
    sample_image_size: sample_image_size || undefined,
  };

  try {
    imageBuffer = await embedMetadata(imageBuffer, metadata);
  } catch (error) {
    // 埋め込み失敗は警告のみ（画像生成は継続）
    console.error(`[WARNING] Failed to embed metadata: ${error.message}`);
  }
}
```

### メタデータ読み取りツール (`get_metadata_from_image`)

**ツール説明**:

画像ファイルから埋め込まれたメタデータを読み取り、データベース情報と統合して表示します。

**パラメータ**:

```typescript
{
  image_path: string  // 読み取る画像のパス
}
```

**出力例**:

```
📷 Image Metadata

File: /path/to/image.png
Format: png
Size: 1024×1024
File size: 1234.5 KB

🔖 Embedded Metadata

UUID: f47ac10b-58cc-4372-a567-0e02b2c3d479
Parameters Hash: a3c65f7b89def2...
Tool: generate_image
Model: imagen-3.0-generate-002
Created: 2024-01-15T10:30:00.000Z
Aspect Ratio: 1:1
Resolution: 1K

Prompt: A beautiful sunset over the ocean

📊 Database Record Found

Status: ✓ Success
Aspect Ratio: 1:1
Sample Count: 1
Safety Level: BLOCK_MEDIUM_AND_ABOVE
Person Generation: DONT_ALLOW
Language: auto

🔐 Integrity Check: ✓ Valid
```

## エラーハンドリング

### メタデータ埋め込み失敗

メタデータ埋め込みは**ベストエフォート**です：

```typescript
try {
  imageBuffer = await embedMetadata(imageBuffer, metadata);
} catch (error) {
  // 警告を出力するが、画像生成は継続
  console.error(`[WARNING] Failed to embed metadata: ${error.message}`);
}
```

**失敗する可能性**:
- サポートされていない画像フォーマット
- メモリ不足
- ファイルシステムエラー

**対応**:
- 元の画像バッファをそのまま保存
- データベースには正常に記録
- stderrに警告メッセージを出力

### メタデータ抽出失敗

```typescript
const metadata = await extractMetadataFromImage(imagePath);

if (!metadata) {
  return {
    content: [{
      type: 'text',
      text: 'No Vertex AI Imagen metadata found in image'
    }]
  };
}
```

**失敗する理由**:
- 画像にメタデータが埋め込まれていない
- 異なるツールで生成された画像
- メタデータが破損している

## データベースとの連携

### 二重管理の理由

1. **画像ファイル内**:
   - ポータビリティ
   - ファイル単体での情報保持
   - 軽量な基本情報

2. **SQLiteデータベース**:
   - 高速な検索
   - 完全な履歴管理
   - 統計・分析機能

### UUIDによる紐付け

```
画像ファイル (metadata.vertexai_imagen_uuid)
    ↓
データベース (image_history.uuid)
```

同じUUIDで両方を検索・照合できます。

### 整合性チェック

```typescript
const imageMetadata = await extractMetadataFromImage(imagePath);
const dbRecord = historyDb.getImageHistory(imageMetadata.vertexai_imagen_uuid);

if (dbRecord) {
  const paramsMatch = dbRecord.paramsHash === imageMetadata.params_hash;

  if (!paramsMatch) {
    console.warn('Hash mismatch: image may have been modified');
  }
}
```

## デバッグ

環境変数 `DEBUG=1` を設定すると、詳細なログが出力されます：

```bash
[DEBUG] Metadata embedding enabled. UUIDs generated: 1
[DEBUG] Image history recorded: f47ac10b-58cc-4372-a567-0e02b2c3d479
```

メタデータ埋め込み失敗時:

```bash
[WARNING] Failed to embed metadata for f47ac10b-58cc-4372-a567-0e02b2c3d479: ...
```

サポートされていないフォーマット:

```bash
[DEBUG] Unsupported image format for metadata embedding: tiff
```

## 使用例

### Claude Desktop での設定

```json
{
  "mcpServers": {
    "vertexai-imagen": {
      "command": "node",
      "args": ["/path/to/build/index.js"],
      "env": {
        "GOOGLE_API_KEY": "...",
        "GOOGLE_PROJECT_ID": "...",
        "VERTEXAI_IMAGEN_EMBED_METADATA": "true",
        "VERTEXAI_IMAGEN_METADATA_LEVEL": "standard"
      }
    }
  }
}
```

### メタデータの読み取り

```typescript
// 画像からメタデータを取得
const result = await mcp.callTool('get_metadata_from_image', {
  image_path: '/path/to/image.png'
});

// データベースからUUIDで検索
const historyResult = await mcp.callTool('get_history_by_uuid', {
  uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
});
```

### 整合性検証の活用

```typescript
// 画像とデータベースの整合性を確認
const metadata = await extractMetadataFromImage(imagePath);
const dbRecord = historyDb.getImageHistory(metadata.vertexai_imagen_uuid);
const integrity = verifyIntegrity(metadata, JSON.parse(dbRecord.parameters));

if (integrity.valid) {
  console.log('✓ Image is authentic and unmodified');
} else {
  console.warn('⚠ Image integrity check failed');
}
```

## パフォーマンスへの影響

### メタデータ埋め込み時間

| 処理 | 時間 |
|-----|------|
| UUID生成 | < 1ms |
| ハッシュ計算 | < 5ms |
| PNG tEXt埋め込み | 5-20ms |
| JPEG EXIF埋め込み | 10-50ms（再エンコード含む） |

### ファイルサイズへの影響

| レベル | 増加量 | 例（元1MB） |
|--------|--------|------------|
| minimal | +100-200 bytes | 1.0001 MB |
| standard | +300-500 bytes | 1.0005 MB |
| full | +1-5 KB | 1.005 MB |

### メモリ使用量

- 埋め込み時: 元画像サイズの約2倍（一時的）
- 抽出時: 画像サイズ + 数KB
- 処理完了後は自動解放

## ベストプラクティス

### 推奨設定

1. **通常使用**: `standard` レベル
   - バランスの取れた情報量
   - ファイルサイズへの影響は最小限
   - 基本的な情報を保持

2. **アーカイブ**: `full` レベル
   - 完全な再現性
   - データベースなしで情報保持
   - 長期保存向け

3. **パフォーマンス重視**: `minimal` レベル
   - 最小限のオーバーヘッド
   - UUIDによる識別のみ
   - データベースと併用

### セキュリティ考慮事項

1. **プロンプトの機密性**:
   - `full` レベルではプロンプトが画像に埋め込まれる
   - 機密情報を含むプロンプトの場合は `standard` 以下を推奨

2. **改ざん検出**:
   - パラメータハッシュで改ざんを検出可能
   - ただし、メタデータ自体も改ざん可能
   - 重要な用途では外部署名を併用

3. **プライバシー**:
   - メタデータにはタイムスタンプなどが含まれる
   - 公開する画像では `minimal` レベルを検討

## トラブルシューティング

### メタデータが埋め込まれない

**確認事項**:
1. `VERTEXAI_IMAGEN_EMBED_METADATA` が `false` または `0` でないか
2. 画像フォーマットがサポートされているか（PNG, JPEG, WebP）
3. DEBUGモードでエラーメッセージを確認

### メタデータが読み取れない

**確認事項**:
1. 画像が本MCPサーバーで生成されたか
2. 画像編集ツールでメタデータが削除されていないか
3. ファイルが破損していないか

### ハッシュ不一致エラー

**原因**:
- 画像ファイルが編集された
- データベースが更新された
- パラメータの計算方法が変更された

**対応**:
- 元の画像とデータベースを確認
- 必要に応じて再生成

## まとめ

メタデータ埋め込み機構により：

- **トレーサビリティ**: 画像の生成履歴を追跡
- **整合性検証**: パラメータハッシュで改ざん検出
- **再現性**: 同じパラメータで再生成可能
- **ポータビリティ**: ファイル単体で情報保持
- **データベース連携**: UUIDで履歴と紐付け

適切なメタデータレベルを選択することで、ニーズに応じた情報管理を実現できます。
