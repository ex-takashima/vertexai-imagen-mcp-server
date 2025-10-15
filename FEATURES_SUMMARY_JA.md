# 機能一覧と他モデル対応ガイド

バージョン: 1.0.0
最終更新: 2025-10-15

## 📋 目次

1. [現在実装されている機能](#現在実装されている機能)
2. [他の生成モデルへの対応方法](#他の生成モデルへの対応方法)
3. [実装の難易度と所要時間](#実装の難易度と所要時間)
4. [機能互換性比較表](#機能互換性比較表)

---

## 現在実装されている機能

### 🎨 画像生成ツール（9種類）

#### 1. generate_image - 基本的な画像生成
- テキストプロンプトから画像を生成
- アスペクト比選択（1:1, 16:9, 9:16, 3:4, 4:3）
- 一度に最大4枚まで生成可能
- 解像度選択（1K, 2K）
- 安全性フィルター設定
- 人物生成ポリシー

#### 2. edit_image - 画像編集
- 既存画像の一部を変更（インペイント）
- 背景の置き換え
- 画像の拡張（アウトペイント）
- 自動マスク生成（背景/前景/セマンティック）
- ユーザー指定マスクの使用
- マスク不要の編集モード

#### 3. upscale_image - 画像の高解像度化
- 2倍または4倍にアップスケール
- 画質の向上

#### 4. generate_and_upscale_image - 生成＋アップスケール
- 画像生成と高解像度化を一度に実行
- 高品質な最終結果を取得

#### 5. customize_image - 高度なカスタマイズ生成
- **コントロール画像**: 構造をコピー（Cannyエッジ、スクリブル、顔メッシュ）
- **被写体画像**: 特定の人物/動物/商品の一貫性を保持
- **スタイル画像**: 芸術的スタイルの転写
- 複数のリファレンス画像を組み合わせ可能

#### 6. customize_image_from_yaml - YAML設定ファイルから生成
- 複雑なパラメータをYAMLファイルで管理
- 再現性の高い生成

#### 7. customize_image_from_yaml_inline - インラインYAMLから生成
- チャットに直接YAML内容を貼り付けて実行
- ファイル不要

#### 8. list_generated_images - 生成済み画像の一覧表示

#### 9. list_semantic_classes - セマンティッククラス一覧
- 194種類のオブジェクトクラスID
- edit_imageのセマンティックマスク生成に使用

---

### ⚙️ 非同期ジョブ管理（5種類）

長時間処理をバックグラウンドで実行し、タイムアウトを回避

#### 1. start_generation_job - ジョブの開始
- 任意の画像生成ツールを非同期実行
- ジョブIDを即座に返却

#### 2. check_job_status - ステータス確認
- pending（待機中）
- running（実行中）
- completed（完了）
- failed（失敗）

#### 3. get_job_result - 結果の取得
- 完了したジョブの画像とメタデータを取得

#### 4. cancel_job - ジョブのキャンセル

#### 5. list_jobs - ジョブ一覧
- ステータスでフィルタリング可能

---

### 📊 履歴管理（4種類）

全ての生成を記録し、再現性を確保

#### 1. list_history - 履歴一覧
- ツール名、モデル、アスペクト比、日付でフィルタリング
- ソート機能（作成日時、ファイルサイズ）
- ページネーション対応

#### 2. get_history_by_uuid - UUID指定で履歴取得
- 特定の生成の全パラメータとメタデータを取得

#### 3. search_history - 履歴検索
- プロンプトとパラメータの全文検索
- キーワードで過去の画像を発見

#### 4. get_metadata_from_image - 画像からメタデータ読み取り
- 画像ファイルに埋め込まれた生成パラメータを抽出
- データベースとの整合性検証

---

### 📝 プロンプトテンプレート（6種類）

再利用可能なプロンプトパターンを管理

#### 1. save_prompt_template - テンプレート保存
- `{変数名}` プレースホルダーを使用
- デフォルトパラメータの設定
- タグ付けによる分類

**例**:
```yaml
name: "portrait-cinematic"
description: "映画的なポートレート写真"
template: "{subject}のプロフェッショナルなポートレート、{style}、高品質写真"
variables: ["subject", "style"]
default_params:
  aspect_ratio: "3:4"
  model: "imagen-3.0-generate-002"
tags: ["portrait", "professional"]
```

#### 2. list_prompt_templates - テンプレート一覧
- タグでフィルタリング
- キーワード検索

#### 3. get_template_detail - テンプレート詳細表示

#### 4. generate_from_template - テンプレートから生成
- 変数に値を代入して実行

**例**:
```json
{
  "template_name": "portrait-cinematic",
  "variable_values": {
    "subject": "若い女性",
    "style": "シネマティックライティング"
  }
}
```

#### 5. update_template - テンプレート更新

#### 6. delete_template - テンプレート削除

---

### 🗂️ リソース管理（MCP Resources API）

生成した画像へのアクセス

#### 機能:
- `list_resources`: 全画像のURI一覧
- `read_resource`: file:// URIで画像データを取得
- サムネイル生成（128x128 JPEG、設定可能）
- メタデータ（ファイル名、サイズ、MIMEタイプ）

#### サムネイル設定:
```bash
VERTEXAI_IMAGEN_THUMBNAIL=true
VERTEXAI_IMAGEN_THUMBNAIL_SIZE=128    # 最大512
VERTEXAI_IMAGEN_THUMBNAIL_QUALITY=60  # 1-100
```

---

## 他の生成モデルへの対応方法

### 対応優先度の推奨順位

#### 🥇 第1位: OpenAI DALL-E
**理由**:
- シンプルなAPI
- 広く使われている
- 公式SDKあり

**実装難易度**: ⭐⭐☆☆☆（簡単）
**所要時間**: 2-4時間

**対応手順**:
1. `npm install openai`でSDKインストール
2. `src/providers/openai.ts`を作成
3. アスペクト比を画像サイズにマッピング
   - 1:1 → 1024x1024
   - 16:9 → 1792x1024
   - 9:16 → 1024x1792
4. `generate_image`と`edit_image`を実装
5. 環境変数`OPENAI_API_KEY`を設定

**制限事項**:
- ❌ アップスケール機能なし
- ❌ ControlNet/高度なカスタマイズなし
- ❌ セマンティックセグメンテーションなし
- ✅ 基本的な生成と編集は対応

---

#### 🥈 第2位: Stable Diffusion（Automatic1111 Web UI）
**理由**:
- 完全無料（ローカル実行）
- 最も高機能（ControlNet、IP-Adapter等）
- アップスケール対応

**実装難易度**: ⭐⭐⭐☆☆（中程度）
**所要時間**: 3-6時間

**対応手順**:
1. Automatic1111 Web UIをインストール
   ```bash
   git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui
   cd stable-diffusion-webui
   ./webui.sh --api --listen
   ```

2. `src/providers/stableDiffusion.ts`を作成

3. エンドポイントマッピング:
   - `/sdapi/v1/txt2img` - 基本生成
   - `/sdapi/v1/img2img` - 画像編集
   - `/sdapi/v1/extra-single-image` - アップスケール
   - `/controlnet/txt2img` - ControlNet生成

4. アスペクト比を幅×高さに変換
   - 1:1 → 512x512
   - 16:9 → 768x432
   - カスタム解像度対応

5. 環境変数`SD_API_URL=http://localhost:7860`

**対応可能な機能**:
- ✅ 全ての基本機能
- ✅ ControlNet（コントロール画像）
- ✅ IP-Adapter（被写体一貫性）
- ✅ アップスケール（ESRGAN）
- ✅ セマンティックセグメンテーション（拡張機能）

---

#### 🥉 第3位: Midjourney（Discord API経由）
**理由**:
- 高品質な出力
- 独自の芸術的スタイル

**実装難易度**: ⭐⭐⭐⭐☆（難しい）
**所要時間**: 8-12時間

**対応手順**:
1. Discordボットを作成
2. Midjourney Botのメッセージを監視
3. `/imagine`コマンドをプログラムから実行
4. 生成完了を検知して画像をダウンロード

**制限事項**:
- ❌ 公式APIなし（非公式Discord API使用）
- ❌ 画像編集機能が限定的
- ✅ 高品質な生成
- ✅ スタイルリファレンス対応

---

### マルチプロバイダー対応のアーキテクチャ

#### ステップ1: 共通インターフェース定義

`src/providers/base.ts`:
```typescript
export interface ImageProvider {
  name: string;

  // コア機能
  generateImage(args: GenerateImageArgs): Promise<Buffer[]>;
  editImage?(args: EditImageArgs): Promise<Buffer[]>;
  upscaleImage?(buffer: Buffer, scaleFactor: string): Promise<Buffer>;

  // 対応機能
  supports: {
    generation: boolean;
    editing: boolean;
    upscaling: boolean;
    customization: boolean;
  };
}
```

#### ステップ2: プロバイダーファクトリー

`src/providers/factory.ts`:
```typescript
export class ProviderFactory {
  static create(): ImageProvider {
    const provider = process.env.IMAGE_PROVIDER || 'imagen';

    switch (provider) {
      case 'openai': return new OpenAIProvider();
      case 'stable-diffusion': return new StableDiffusionProvider();
      case 'imagen':
      default: return new ImagenProvider();
    }
  }
}
```

#### ステップ3: ツールハンドラー更新

```typescript
import { ProviderFactory } from '../providers/factory.js';

export async function generateImage(context, args) {
  const provider = ProviderFactory.create();

  // 対応確認
  if (!provider.supports.generation) {
    throw new Error(`${provider.name}は画像生成に対応していません`);
  }

  // 実行
  const buffers = await provider.generateImage(args);

  // ファイル保存とMCPレスポンス作成
  // ...
}
```

---

## 実装の難易度と所要時間

### 📊 比較表

| プロバイダー | 難易度 | 所要時間 | コスト | 機能カバー率 |
|------------|-------|---------|-------|------------|
| **OpenAI DALL-E** | ⭐⭐☆☆☆ | 2-4時間 | 中 | 60% |
| **Stable Diffusion** | ⭐⭐⭐☆☆ | 3-6時間 | 無料 | 95% |
| **Midjourney** | ⭐⭐⭐⭐☆ | 8-12時間 | 高 | 50% |
| **マルチプロバイダー化** | ⭐⭐⭐⭐⭐ | 8-12時間 | - | 100% |

---

## 機能互換性比較表

| 機能 | Vertex AI Imagen | OpenAI DALL-E | Stable Diffusion | Midjourney |
|-----|-----------------|---------------|------------------|------------|
| **基本生成** | ✅ | ✅ | ✅ | ✅ |
| **画像編集** | ✅ | ✅（制限あり） | ✅ | ❌ |
| **アップスケール** | ✅ | ❌ | ✅ | ✅ |
| **ControlNet** | ❌ | ❌ | ✅ | ❌ |
| **セマンティックマスク** | ✅ | ❌ | ✅（拡張） | ❌ |
| **被写体一貫性** | ✅ | ❌ | ✅（IP-Adapter） | ✅（画像参照） |
| **バッチ生成** | 1-4枚 | 1-10枚 | 無制限 | 4枚 |
| **アスペクト比** | 5種類 | 3サイズ | カスタム | カスタム |
| **非同期ジョブ** | ✅ | ❌ | ❌ | ✅（ネイティブ） |
| **ローカル実行** | ❌ | ❌ | ✅ | ❌ |
| **API料金** | $$$ | $$ | 無料 | $$$$ |

### 機能カバー率の詳細

#### OpenAI DALL-E（60%カバー）
**対応可能**:
- ✅ generate_image
- ✅ edit_image（マスク指定のみ）
- ✅ generate_and_upscale_image（外部ツール組み合わせ）
- ✅ 履歴管理
- ✅ ジョブ管理
- ✅ プロンプトテンプレート

**対応不可**:
- ❌ upscale_image（外部サービス必要）
- ❌ customize_image（ControlNet等）
- ❌ list_semantic_classes

#### Stable Diffusion（95%カバー）
**対応可能**:
- ✅ 全ての基本機能
- ✅ ControlNet拡張でcustomize_image対応
- ✅ ESRGAN等でupscale_image対応
- ✅ セマンティックセグメンテーション（拡張機能）

**対応不可**:
- ❌ Imagen固有のセマンティッククラスデータベース
  （代替: 独自のクラス定義が必要）

#### Midjourney（50%カバー）
**対応可能**:
- ✅ generate_image（Discord Bot経由）
- ✅ 画像参照（URLとして）
- ✅ アップスケール（`U1`〜`U4`ボタン）

**対応不可**:
- ❌ 直接的な画像編集API
- ❌ プログラム的な詳細制御
- ❌ 同期的なAPI呼び出し

---

## 環境変数テンプレート

`.env`ファイルの設定例:

```bash
# === プロバイダー選択 ===
IMAGE_PROVIDER=imagen  # imagen | openai | stable-diffusion

# === Vertex AI Imagen ===
GOOGLE_API_KEY=your_api_key_here
GOOGLE_PROJECT_ID=your_project_id
GOOGLE_REGION=us-central1
GOOGLE_IMAGEN_MODEL=imagen-3.0-generate-002

# === OpenAI DALL-E ===
OPENAI_API_KEY=sk-...
OPENAI_ORG_ID=org-...

# === Stable Diffusion ===
SD_API_URL=http://localhost:7860
SD_DEFAULT_MODEL=v1-5-pruned-emaonly.safetensors

# === 共通設定 ===
IMAGE_OUTPUT_DIR=~/Downloads/ai-images
THUMBNAIL_ENABLED=true
THUMBNAIL_SIZE=128
THUMBNAIL_QUALITY=60
MAX_CONCURRENT_JOBS=2
DB_PATH=./data/history.db
DEBUG=false
```

---

## データベース構造

### history テーブル
```sql
CREATE TABLE history (
  uuid TEXT PRIMARY KEY,           -- 一意識別子
  tool_name TEXT,                  -- 使用ツール名
  model TEXT,                      -- モデル名
  provider TEXT,                   -- プロバイダー名
  prompt TEXT,                     -- プロンプト
  parameters TEXT,                 -- JSONパラメータ
  output_paths TEXT,               -- JSON配列（ファイルパス）
  file_sizes INTEGER,              -- ファイルサイズ
  aspect_ratio TEXT,               -- アスペクト比
  created_at DATETIME,             -- 作成日時
  metadata TEXT                    -- JSON追加情報
);
```

### templates テーブル
```sql
CREATE TABLE templates (
  name TEXT PRIMARY KEY,           -- テンプレート名
  description TEXT,                -- 説明
  template TEXT,                   -- プロンプトテンプレート
  variables TEXT,                  -- JSON配列（変数名）
  default_params TEXT,             -- JSONデフォルトパラメータ
  tags TEXT,                       -- JSON配列（タグ）
  created_at DATETIME,             -- 作成日時
  updated_at DATETIME              -- 更新日時
);
```

### jobs テーブル
```sql
CREATE TABLE jobs (
  job_id TEXT PRIMARY KEY,         -- ジョブID
  tool_type TEXT,                  -- ツールタイプ
  status TEXT,                     -- pending | running | completed | failed
  params TEXT,                     -- JSONパラメータ
  result TEXT,                     -- JSON結果
  error TEXT,                      -- エラーメッセージ
  created_at DATETIME,             -- 作成日時
  started_at DATETIME,             -- 開始日時
  completed_at DATETIME            -- 完了日時
);
```

---

## テスト方法

### 1. 基本機能テスト
```bash
# ビルド
npm run build

# MCPインスペクターで実行
npx @modelcontextprotocol/inspector node build/index.js

# または Claude Desktop に接続
```

### 2. 各ツールの動作確認

#### generate_image
```json
{
  "prompt": "富士山と桜の風景",
  "aspect_ratio": "16:9",
  "sample_count": 1
}
```

#### edit_image
```json
{
  "prompt": "空を夕焼けに変更",
  "reference_image_path": "/path/to/image.png",
  "mask_mode": "background"
}
```

#### customize_image
```json
{
  "prompt": "同じ人物が[1]のポーズで立っている",
  "subject_images": [
    { "image_path": "/path/to/person.jpg" }
  ],
  "subject_description": "黒髪の女性",
  "subject_type": "person",
  "control_image_path": "/path/to/pose.jpg",
  "control_type": "face_mesh"
}
```

### 3. プロバイダー切り替えテスト

```bash
# OpenAIに切り替え
export IMAGE_PROVIDER=openai
export OPENAI_API_KEY=sk-...
npm run build

# Stable Diffusionに切り替え
export IMAGE_PROVIDER=stable-diffusion
export SD_API_URL=http://localhost:7860
npm run build
```

---

## トラブルシューティング

### 問題1: サムネイルがClaude Desktopに表示されない

**原因**: Data URI形式が使われている

**解決方法**:
```typescript
// ❌ 間違い
{
  type: "image",
  data: "data:image/png;base64,iVBORw..."
}

// ✅ 正しい
{
  type: "image",
  data: "iVBORw...",  // 純粋なbase64
  mimeType: "image/png"
}
```

### 問題2: OpenAI APIがエラー

**確認項目**:
1. API キーが正しいか
2. 課金設定が有効か
3. レート制限に達していないか

### 問題3: Stable Diffusion接続失敗

**解決方法**:
```bash
# サーバーが起動しているか確認
curl http://localhost:7860/sdapi/v1/sd-models

# APIモードで起動
./webui.sh --api --listen
```

---

## 参考資料

### 公式ドキュメント
- [MCP Protocol](https://modelcontextprotocol.io/docs)
- [Vertex AI Imagen](https://cloud.google.com/vertex-ai/docs/generative-ai/image/overview)
- [OpenAI DALL-E API](https://platform.openai.com/docs/api-reference/images)
- [Automatic1111 API Wiki](https://github.com/AUTOMATIC1111/stable-diffusion-webui/wiki/API)

### ライブラリ
- [Sharp](https://sharp.pixelplumbing.com/) - 画像処理
- [Better-SQLite3](https://github.com/WiseLibs/better-sqlite3) - データベース
- [YAML](https://github.com/eemeli/yaml) - YAML解析

---

## まとめ

このMCPサーバーは以下の25種類のツールを提供:
- 画像生成: 9ツール
- ジョブ管理: 5ツール
- 履歴管理: 4ツール
- テンプレート: 6ツール
- リソース: 1ツール

他の生成モデル（OpenAI、Stable Diffusion等）への対応は、
プロバイダーアダプターパターンを使用して実装可能です。

詳細な実装手順は以下を参照:
- `FEATURES_SPECIFICATION.md` - 英語版詳細仕様
- `IMPLEMENTATION_GUIDE.md` - 英語版実装ガイド

---

**作成日**: 2025-10-15
**バージョン**: 1.0.0
**ライセンス**: MIT
