# サムネイルをMCPレスポンスに付加する機構

## 概要

このMCPサーバーは、生成した画像のサムネイル（プレビュー画像）をMCPレスポンスに含めることができます。これにより、LLMが画像の内容を認識し、会話で参照できるようになります。

## 設定方法

### 環境変数

サムネイル機能は以下の環境変数で制御できます：

| 環境変数 | 説明 | デフォルト値 | 範囲 |
|---------|------|------------|------|
| `VERTEXAI_IMAGEN_THUMBNAIL` | サムネイル生成を有効化 | `false` | `true` / `false` |
| `VERTEXAI_IMAGEN_THUMBNAIL_SIZE` | サムネイルサイズ（ピクセル） | `128` | `1` - `512` |
| `VERTEXAI_IMAGEN_THUMBNAIL_QUALITY` | JPEG品質 | `60` | `1` - `100` |

### ツールパラメータ

各画像生成ツールには `include_thumbnail` パラメータがあります：

```typescript
{
  include_thumbnail: boolean  // 環境変数の設定を上書き可能
}
```

- 指定なし: 環境変数 `VERTEXAI_IMAGEN_THUMBNAIL` の設定に従う
- `true`: サムネイル生成を強制的に有効化
- `false`: サムネイル生成を強制的に無効化

## アーキテクチャ

### ファイル構成

```
src/
├── utils/
│   ├── thumbnail.ts      # サムネイル生成ロジック
│   └── image.ts          # MCPレスポンス生成（サムネイル付加）
└── tools/
    ├── generateImage.ts  # サムネイル設定の判断
    ├── editImage.ts      # 各ツールで同様に実装
    └── ...
```

### 処理フロー

```
1. ツール実行
   ↓
2. 画像生成 & ファイル保存
   ↓
3. サムネイル設定の判断
   - include_thumbnail パラメータの確認
   - 環境変数 VERTEXAI_IMAGEN_THUMBNAIL の確認
   ↓
4. MCPレスポンス生成
   - createUriImageResponse() または
   - createMultiUriImageResponse()
   ↓
5. サムネイル生成（有効な場合）
   - generateThumbnailDataFromFile()
   - Sharp による画像リサイズ & 圧縮
   ↓
6. MCPレスポンスに付加
   - content配列にimage要素を追加
   - annotations設定
```

## 実装詳細

### 1. サムネイル生成ロジック (`src/utils/thumbnail.ts`)

**使用ライブラリ**: Sharp (高速画像処理)

**主要関数**:

```typescript
export async function generateThumbnailDataFromFile(
  filePath: string,
  config: ThumbnailConfig = DEFAULT_THUMBNAIL_CONFIG
): Promise<ThumbnailResult>
```

**処理内容**:

- 画像をロードしてリサイズ
  - `fit: 'inside'`: アスペクト比維持
  - `withoutEnlargement: true`: 元画像より大きくしない
- フォーマットに応じた圧縮
  - JPEG: プログレッシブJPEG、品質設定適用
  - PNG/WebP: 品質設定適用
- Base64エンコードして返却

**設定**:

```typescript
export interface ThumbnailConfig {
  maxWidth: number;    // 環境変数 VERTEXAI_IMAGEN_THUMBNAIL_SIZE
  maxHeight: number;   // 環境変数 VERTEXAI_IMAGEN_THUMBNAIL_SIZE
  quality: number;     // 環境変数 VERTEXAI_IMAGEN_THUMBNAIL_QUALITY
  format: 'jpeg' | 'png' | 'webp';  // デフォルト: 'jpeg'
}
```

### 2. MCPレスポンスへの付加 (`src/utils/image.ts`)

#### 単一画像の場合 (`createUriImageResponse`)

```typescript
export async function createUriImageResponse(
  uri: string,
  mimeType: string,
  fileSize: number,
  filePath: string,
  absoluteFilePath: string,
  additionalInfo?: string,
  includeThumbnail: boolean = true
)
```

**処理**:

1. テキストコンテンツを作成（ファイルパス、URIなど）
2. `includeThumbnail` が `true` の場合:
   - `generateThumbnailDataFromFile()` でサムネイル生成
   - `content` 配列に画像要素を追加

**MCPレスポンス構造**:

```typescript
{
  content: [
    {
      type: "text",
      text: "..."  // ファイル情報とURI
    },
    {
      type: "image",
      data: thumbnailData.base64,      // Base64データ（data URI形式でない）
      mimeType: thumbnailData.mimeType, // "image/jpeg" など
      annotations: {
        audience: ["user", "assistant"], // LLMとユーザー両方に表示
        priority: 0.8                    // 表示優先度
      }
    }
  ]
}
```

#### 複数画像の場合 (`createMultiUriImageResponse`)

```typescript
export async function createMultiUriImageResponse(
  imageInfos: Array<{...}>,
  additionalInfo?: string,
  includeThumbnail: boolean = true
)
```

**処理**:

- 各画像について同様にサムネイルを生成
- `content` 配列に全てのサムネイルを追加

### 3. ツールでの使用例 (`src/tools/generateImage.ts`)

**設定判断部分**:

```typescript
const shouldIncludeThumbnail =
  include_thumbnail !== undefined
    ? include_thumbnail  // パラメータ指定があれば優先
    : process.env.VERTEXAI_IMAGEN_THUMBNAIL === 'true'; // 環境変数
```

**単一画像の場合**:

```typescript
return await createUriImageResponse(
  info.uri,
  info.mimeType,
  info.fileSize,
  info.filePath,
  info.absoluteFilePath,
  baseInfoText,
  shouldIncludeThumbnail  // サムネイル設定を渡す
);
```

**複数画像の場合**:

```typescript
return await createMultiUriImageResponse(
  imageInfos,
  baseInfoText,
  shouldIncludeThumbnail
);
```

## MCPプロトコルとの統合

### Content Type: image

MCPプロトコルの `image` コンテンツタイプを使用:

```typescript
{
  type: "image",
  data: string,       // Base64エンコードされた画像データ
  mimeType: string,   // "image/jpeg", "image/png" など
  annotations?: {
    audience?: ("user" | "assistant")[],
    priority?: number
  }
}
```

### Annotations の役割

| フィールド | 値 | 意味 |
|----------|---|------|
| `audience` | `["user", "assistant"]` | LLMとユーザー両方に表示 |
| `audience` | `["user"]` | ユーザーのみに表示（LLMは無視） |
| `priority` | `0.8` | 表示優先度（0.0-1.0） |

**このサーバーの実装**:

- サムネイル: `audience: ["user", "assistant"]`
  - LLMが画像内容を認識できる
  - 会話で画像について言及可能
- フルサイズ画像（非推奨のbase64モード）: `audience: ["user"]`
  - トークン消費を抑えるため、LLMには渡さない

## トークン消費量

### サムネイルあり（推奨）

| サイズ | 品質 | 概算トークン |
|-------|-----|------------|
| 128px | 60  | ~30-50 tokens |
| 256px | 60  | ~100-150 tokens |
| 512px | 60  | ~300-500 tokens |

### フルサイズ画像（base64モード、非推奨）

- 1024x1024 PNG: ~1,500 tokens
- 注意: `return_base64=true` は v1.0.0 で廃止予定

## エラーハンドリング

サムネイル生成は **ベストエフォート** です：

```typescript
try {
  const thumbnailData = await generateThumbnailDataFromFile(absoluteFilePath);
  content.push({ type: "image", ... });
} catch (error) {
  // サムネイル生成失敗はエラーとせず、警告のみ
  console.error(`[WARNING] Failed to generate thumbnail: ${errorMessage}`);
}
```

- サムネイル生成に失敗してもツール実行は成功
- stderrに警告メッセージを出力
- DEBUGモード時はスタックトレースも出力

## デバッグ

環境変数 `DEBUG=1` を設定すると、詳細なログが出力されます：

```bash
[DEBUG] Thumbnail generation enabled, processing: /path/to/image.png
[DEBUG] Thumbnail generated successfully: ~12345 bytes
```

または無効化時：

```bash
[DEBUG] Thumbnail generation disabled (VERTEXAI_IMAGEN_THUMBNAIL=)
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
        "VERTEXAI_IMAGEN_THUMBNAIL": "true",
        "VERTEXAI_IMAGEN_THUMBNAIL_SIZE": "128",
        "VERTEXAI_IMAGEN_THUMBNAIL_QUALITY": "60"
      }
    }
  }
}
```

### ツール呼び出し時

```typescript
// デフォルト設定を使用
{
  prompt: "A beautiful sunset",
  output_path: "sunset.png"
}

// サムネイルを強制的に有効化
{
  prompt: "A beautiful sunset",
  output_path: "sunset.png",
  include_thumbnail: true
}

// サムネイルを強制的に無効化
{
  prompt: "A beautiful sunset",
  output_path: "sunset.png",
  include_thumbnail: false
}
```

## パフォーマンスへの影響

### サムネイル生成時間

- Sharp は非常に高速（通常 10-50ms）
- 画像生成APIの待ち時間（数秒）と比較して無視できる

### メモリ使用量

- 一時的に元画像とサムネイルをメモリに保持
- 処理完了後は自動的に解放

### ネットワーク

- MCPはローカル通信（stdio）のため、ネットワーク影響なし

## ベストプラクティス

1. **通常使用**: サムネイル有効化（128px, 品質60）
   - LLMが画像を認識できる
   - トークン消費は最小限

2. **高品質プレビュー**: サイズ256px、品質80
   - より詳細なプレビューが必要な場合
   - トークン消費は増加するが許容範囲

3. **トークン節約**: サムネイル無効化
   - LLMに画像内容を認識させる必要がない場合
   - ファイル保存のみが目的の場合

4. **複数画像生成**: サムネイルサイズを小さくする
   - `sample_count=4` の場合、各画像にサムネイルが付く
   - サイズを64-128pxに抑えるとトークン節約

## 対応ツール

サムネイル機能は以下のツールでサポートされています：

- `generate_image`
- `edit_image`
- `customize_image`
- `upscale_image`
- `generate_and_upscale_image`

すべて `include_thumbnail` パラメータと環境変数に対応しています。

## まとめ

サムネイル機構により：

- LLMが生成画像の内容を認識できる
- 会話で画像について言及・参照可能
- トークン消費を最小限に抑える（30-50 tokens）
- フルサイズ画像はResources API経由でアクセス可能

この設計により、効率的で使いやすい画像生成MCPサーバーを実現しています。
