# バッチ画像生成ガイド

このドキュメントでは、VertexAI Imagen MCP Serverを使用したバッチ画像生成機能について説明します。

## 目次

1. [概要](#概要)
2. [CLIを使用したバッチ処理](#cliを使用したバッチ処理)
3. [GitHub Actionsを使用したバッチ処理](#github-actionsを使用したバッチ処理)
4. [バッチ設定のJSON形式](#バッチ設定のjson形式)
5. [環境変数](#環境変数)
6. [トラブルシューティング](#トラブルシューティング)

---

## 概要

バッチ画像生成機能を使用すると、複数の画像を一度に生成できます。この機能は以下の2つの方法で利用できます：

- **CLI（コマンドライン）**: ローカル環境またはCI/CD環境から直接実行
- **GitHub Actions**: Issueコメントをトリガーとして自動実行

### 特徴

- ✅ **非同期ジョブ管理**: JobManagerを使用した効率的な並列処理
- ✅ **同時実行数制御**: リソース使用量を制限可能
- ✅ **詳細な結果レポート**: テキストまたはJSON形式で出力
- ✅ **エラーハンドリング**: 個別のジョブが失敗しても継続実行
- ✅ **タイムアウト制御**: 長時間実行の防止

---

## CLIを使用したバッチ処理

### インストール

```bash
npm install -g @dondonudonjp/vertexai-imagen-mcp-server
```

または、リポジトリをクローンしてローカルビルド：

```bash
git clone https://github.com/ex-takashima/vertexai-imagen-mcp-server.git
cd vertexai-imagen-mcp-server
npm install
npm run build
```

### 基本的な使用方法

```bash
vertexai-imagen-batch <batch-config.json> [OPTIONS]
```

#### オプション

| オプション | 説明 | デフォルト |
|----------|------|-----------|
| `--output-dir <path>` | 出力ディレクトリ | `VERTEXAI_IMAGEN_OUTPUT_DIR`または`~/Downloads/vertexai-imagen-files` |
| `--format <text\|json>` | 結果の出力形式 | `text` |
| `--timeout <ms>` | タイムアウト（ミリ秒） | `600000`（10分） |
| `--help`, `-h` | ヘルプメッセージを表示 | - |
| `--version`, `-v` | バージョン情報を表示 | - |

### 使用例

#### 1. 基本的な実行

```bash
# batch-config.jsonを使用して画像を生成
vertexai-imagen-batch batch-config.json
```

#### 2. カスタム出力ディレクトリ

```bash
# ./my-imagesディレクトリに保存
vertexai-imagen-batch batch-config.json --output-dir ./my-images
```

#### 3. JSON形式で結果を取得

```bash
# 結果をJSON形式でファイルに保存
vertexai-imagen-batch batch-config.json --format json > result.json
```

#### 4. タイムアウトの設定

```bash
# 20分のタイムアウトを設定
vertexai-imagen-batch batch-config.json --timeout 1200000
```

### 開発環境での実行

TypeScriptファイルを直接実行する場合：

```bash
npm run dev:batch batch-config.json
```

---

## GitHub Actionsを使用したバッチ処理

GitHub Actionsワークフローを使用すると、Issueコメントをトリガーとしてバッチ画像生成を実行できます。

### ランナーの選択

このプロジェクトでは2種類のワークフローを提供しています：

| ワークフロー | トリガー | ランナー | 用途 |
|------------|---------|---------|------|
| `batch-image-generation.yml` | `/batch` | GitHub-hosted (ubuntu-latest) | 標準的なバッチ処理 |
| `batch-image-generation-macos.yml` | `/batch-macos` | Self-hosted (macOS1) | macOS環境での処理 |

#### GitHub-hosted vs Self-hosted

**GitHub-hosted ランナー (`/batch`)**
- ✅ セットアップ不要
- ✅ 常に最新の環境
- ✅ 課金は使用量に応じて（無料枠あり）
- ❌ 実行時間制限あり
- ❌ ネットワーク速度に制限がある場合がある

**Self-hosted macOS ランナー (`/batch-macos`)**
- ✅ 高速なネットワーク
- ✅ カスタム環境設定可能
- ✅ 実行時間制限なし
- ✅ ローカルリソースへのアクセス可能
- ❌ 自分でランナーをセットアップ・管理する必要がある
- ❌ セキュリティ管理が必要

### セットアップ

#### 1. リポジトリシークレットの設定

GitHub リポジトリの Settings > Secrets and variables > Actions で以下のシークレットを設定：

##### 認証方法A: サービスアカウント（推奨）

| シークレット名 | 説明 | 必須 |
|--------------|------|------|
| `GOOGLE_APPLICATION_CREDENTIALS` | サービスアカウントキーJSONの**内容全体** | ✅ |
| `GOOGLE_PROJECT_ID` | Google CloudプロジェクトID（任意、JSONから自動検出可） | ❌ |
| `GOOGLE_REGION` | リージョン（例: `us-central1`） | ❌ |
| `MAX_CONCURRENT_JOBS` | 最大同時実行数 | ❌ |

> **重要**: `GOOGLE_APPLICATION_CREDENTIALS` には、サービスアカウントキーJSONファイルの**ファイルパスではなく、JSON内容全体**を設定してください。

<details>
<summary><b>GOOGLE_APPLICATION_CREDENTIALS の設定方法（クリックして展開）</b></summary>

1. **サービスアカウントキーJSONファイルを取得**
   - Google Cloud Console > IAM & Admin > Service Accounts
   - サービスアカウントを選択 > Keys タブ > Add Key > Create new key
   - JSON形式でダウンロード

2. **JSONファイルの内容をコピー**
   ```bash
   # ファイル内容をクリップボードにコピー（macOS）
   cat service-account-key.json | pbcopy

   # ファイル内容を表示（Linux/Windows）
   cat service-account-key.json
   ```

3. **GitHubリポジトリのSecretsに登録**
   - リポジトリ > Settings > Secrets and variables > Actions
   - "New repository secret" をクリック
   - Name: `GOOGLE_APPLICATION_CREDENTIALS`
   - Secret: コピーしたJSON内容全体を貼り付け
   - "Add secret" をクリック

4. **JSON形式の例**
   ```json
   {
     "type": "service_account",
     "project_id": "your-project-id",
     "private_key_id": "...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "...",
     "client_id": "...",
     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
     "token_uri": "https://oauth2.googleapis.com/token",
     "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
     "client_x509_cert_url": "..."
   }
   ```

</details>

##### 認証方法B: APIキー

| シークレット名 | 説明 | 必須 |
|--------------|------|------|
| `GOOGLE_API_KEY` | Google Cloud APIキー | ✅ |
| `GOOGLE_PROJECT_ID` | Google CloudプロジェクトID | ✅ |
| `GOOGLE_REGION` | リージョン（例: `us-central1`） | ❌ |
| `MAX_CONCURRENT_JOBS` | 最大同時実行数 | ❌ |

#### 2. ワークフローファイルの配置

以下のワークフローファイルがリポジトリに存在することを確認してください：
- `.github/workflows/batch-image-generation.yml` (GitHub-hosted用)
- `.github/workflows/batch-image-generation-macos.yml` (Self-hosted macOS用)

#### 3. Self-hosted ランナーのセットアップ（macOS使用時のみ）

Self-hosted macOS ランナーを使用する場合は、以下の手順でセットアップしてください：

1. **GitHub Actionsランナーのインストール**
   - リポジトリ > Settings > Actions > Runners
   - "New self-hosted runner" をクリック
   - macOS用の指示に従ってランナーをインストール

2. **ランナーにラベルを追加**
   - ランナー名: 任意（例: `macOS1`）
   - ラベル: `macOS`, `macOS1` を追加

3. **Node.js 20以上をインストール**
   ```bash
   brew install node@20
   ```

4. **ランナーサービスの起動**
   ```bash
   ./run.sh
   # または、バックグラウンドで実行
   nohup ./run.sh &
   ```

### 使用方法

#### 1. Issueを作成

任意のタイトルと説明でIssueを作成します。

#### 2. バッチ設定をコメント

Issueコメントにトリガーキーワードと共にJSON設定を投稿：

- **GitHub-hosted ランナーを使用**: `/batch` をコメント
- **Self-hosted macOS ランナーを使用**: `/batch-macos` をコメント

##### GitHub-hosted ランナーを使用する場合

````markdown
/batch

```json
{
  "jobs": [
    {
      "prompt": "A beautiful sunset over the ocean",
      "output_filename": "sunset.png",
      "aspect_ratio": "16:9"
    },
    {
      "prompt": "A futuristic city skyline at night",
      "output_filename": "city.png",
      "aspect_ratio": "16:9",
      "safety_level": "BLOCK_MEDIUM_AND_ABOVE"
    },
    {
      "prompt": "A serene mountain landscape",
      "output_filename": "mountain.png",
      "aspect_ratio": "4:3"
    }
  ]
}
```
````

##### Self-hosted macOS ランナーを使用する場合

````markdown
/batch-macos

```json
{
  "jobs": [
    {
      "prompt": "A beautiful sunset over the ocean",
      "output_filename": "sunset.png",
      "aspect_ratio": "16:9"
    },
    {
      "prompt": "A futuristic city skyline at night",
      "output_filename": "city.png",
      "aspect_ratio": "16:9"
    }
  ]
}
```
````

#### 3. ワークフローの実行

コメント投稿後、GitHub Actionsワークフローが自動的に開始されます。

- `/batch` → `batch-image-generation.yml` が実行（GitHub-hosted runner）
- `/batch-macos` → `batch-image-generation-macos.yml` が実行（Self-hosted macOS runner）

#### 4. 結果の確認

- ワークフロー完了後、結果サマリーがIssueコメントとして自動投稿されます
- 生成された画像は、GitHub Actionsのアーティファクトとしてダウンロード可能（保持期間: 7日間）
- macOS版の場合は、コメントに「**Runner:** macOS Self-Hosted (macOS1)」と表示されます

### ワークフロー結果の例

```markdown
## ✅ Batch Image Generation Completed Successfully

**Summary:**
- Total Jobs: 3
- Succeeded: 3
- Failed: 0
- Duration: 45.32s
- Started: 2025-01-15T10:00:00Z
- Finished: 2025-01-15T10:00:45Z

### ✅ Successfully Generated Images

- `sunset.png`: A beautiful sunset over the ocean
- `city.png`: A futuristic city skyline at night
- `mountain.png`: A serene mountain landscape

📦 Download all generated images from the [workflow artifacts](https://github.com/user/repo/actions/runs/123456).
```

---

## バッチ設定のJSON形式

### 基本構造

```json
{
  "jobs": [
    {
      "prompt": "画像生成プロンプト",
      "output_filename": "ファイル名.png",
      "aspect_ratio": "16:9",
      "safety_level": "BLOCK_MEDIUM_AND_ABOVE",
      "person_generation": "ALLOW_ADULT",
      "language": "en",
      "model": "imagen-3.0-generate-002",
      "region": "us-central1",
      "sample_count": 1,
      "sample_image_size": "1K",
      "include_thumbnail": true
    }
  ],
  "output_dir": "./output",
  "max_concurrent": 2,
  "timeout": 600000
}
```

### フィールド説明

#### `jobs` (必須)

画像生成ジョブの配列。各ジョブは以下のフィールドを持ちます：

| フィールド | 型 | 必須 | 説明 | デフォルト |
|-----------|---|------|------|-----------|
| `prompt` | string | ✅ | 画像生成プロンプト | - |
| `output_filename` | string | ❌ | 出力ファイル名（ファイル名のみ） | 自動生成 |
| `aspect_ratio` | string | ❌ | アスペクト比: `1:1`, `3:4`, `4:3`, `9:16`, `16:9` | `1:1` |
| `safety_level` | string | ❌ | 安全性フィルター（後述） | `BLOCK_MEDIUM_AND_ABOVE` |
| `person_generation` | string | ❌ | 人物生成ポリシー（後述） | `DONT_ALLOW` |
| `language` | string | ❌ | 言語: `auto`, `en`, `zh`, `zh-TW`, `hi`, `ja`, `ko`, `pt`, `es` | `auto` |
| `model` | string | ❌ | 使用モデル（後述） | 環境変数で設定 |
| `region` | string | ❌ | Google Cloudリージョン | 環境変数で設定 |
| `sample_count` | number | ❌ | 生成サンプル数 | 1 |
| `sample_image_size` | string | ❌ | 画像サイズ: `1K`, `2K` | `1K` |
| `include_thumbnail` | boolean | ❌ | サムネイル生成 | 環境変数で設定 |

##### `safety_level` の値

- `BLOCK_NONE`: フィルターなし
- `BLOCK_ONLY_HIGH`: 高リスクのみブロック
- `BLOCK_MEDIUM_AND_ABOVE`: 中リスク以上をブロック（推奨）
- `BLOCK_LOW_AND_ABOVE`: 低リスク以上をブロック

##### `person_generation` の値

- `DONT_ALLOW`: 人物生成を許可しない
- `ALLOW_ADULT`: 成人の生成を許可
- `ALLOW_ALL`: 全年齢の人物生成を許可

##### `model` の値

- `imagen-4.0-ultra-generate-001`: Imagen 4.0 Ultra（最高品質）
- `imagen-4.0-fast-generate-001`: Imagen 4.0 Fast（高速）
- `imagen-4.0-generate-001`: Imagen 4.0（標準）
- `imagen-3.0-generate-002`: Imagen 3.0
- `imagen-3.0-fast-generate-001`: Imagen 3.0 Fast

#### `output_dir` (任意)

出力ディレクトリのパス。CLIの `--output-dir` オプションで上書き可能。

#### `max_concurrent` (任意)

最大同時実行ジョブ数。環境変数 `VERTEXAI_IMAGEN_MAX_CONCURRENT_JOBS` で上書き可能。

#### `timeout` (任意)

タイムアウト時間（ミリ秒）。CLIの `--timeout` オプションで上書き可能。

### サンプル設定

#### 1. シンプルな設定

```json
{
  "jobs": [
    {
      "prompt": "A beautiful sunset over the ocean"
    },
    {
      "prompt": "A futuristic city skyline"
    }
  ]
}
```

#### 2. 詳細設定

```json
{
  "jobs": [
    {
      "prompt": "A photorealistic portrait of a smiling woman",
      "output_filename": "portrait.png",
      "aspect_ratio": "3:4",
      "safety_level": "BLOCK_MEDIUM_AND_ABOVE",
      "person_generation": "ALLOW_ADULT",
      "language": "en",
      "model": "imagen-4.0-generate-001",
      "sample_image_size": "2K",
      "include_thumbnail": true
    },
    {
      "prompt": "A minimalist abstract art piece with geometric shapes",
      "output_filename": "abstract.png",
      "aspect_ratio": "1:1",
      "safety_level": "BLOCK_ONLY_HIGH",
      "model": "imagen-4.0-fast-generate-001"
    }
  ],
  "output_dir": "./generated-images",
  "max_concurrent": 3,
  "timeout": 900000
}
```

#### 3. 大量バッチ生成

```json
{
  "jobs": [
    { "prompt": "A red sports car", "output_filename": "car_red.png" },
    { "prompt": "A blue sports car", "output_filename": "car_blue.png" },
    { "prompt": "A green sports car", "output_filename": "car_green.png" },
    { "prompt": "A yellow sports car", "output_filename": "car_yellow.png" },
    { "prompt": "A black sports car", "output_filename": "car_black.png" },
    { "prompt": "A white sports car", "output_filename": "car_white.png" },
    { "prompt": "A silver sports car", "output_filename": "car_silver.png" },
    { "prompt": "A orange sports car", "output_filename": "car_orange.png" },
    { "prompt": "A purple sports car", "output_filename": "car_purple.png" },
    { "prompt": "A pink sports car", "output_filename": "car_pink.png" }
  ],
  "max_concurrent": 5,
  "timeout": 1800000
}
```

---

## 環境変数

バッチ処理では以下の環境変数が使用されます：

### 認証（いずれか1つ必須）

#### 方法A: サービスアカウントファイル（推奨）

| 変数名 | 説明 |
|--------|------|
| `GOOGLE_APPLICATION_CREDENTIALS` | サービスアカウントキーJSONファイルのパス |

#### 方法B: サービスアカウントJSON文字列

| 変数名 | 説明 |
|--------|------|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | サービスアカウントキーJSONの内容（文字列） |

#### 方法C: APIキー

| 変数名 | 説明 |
|--------|------|
| `GOOGLE_API_KEY` | Google Cloud APIキー |
| `GOOGLE_PROJECT_ID` | Google CloudプロジェクトID（APIキー使用時は必須） |

### 任意

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `VERTEXAI_IMAGEN_OUTPUT_DIR` | デフォルト出力ディレクトリ | `~/Downloads/vertexai-imagen-files` |
| `VERTEXAI_IMAGEN_MAX_CONCURRENT_JOBS` | 最大同時実行数 | `2` |
| `VERTEXAI_IMAGEN_DB` | データベースパス | `{output_dir}/data/vertexai-imagen.db` |
| `GOOGLE_REGION` | Google Cloudリージョン | `us-central1` |
| `GOOGLE_IMAGEN_MODEL` | デフォルトモデル | `imagen-3.0-generate-001` |
| `DEBUG` | デバッグログ有効化 | - |

### 環境変数の設定例

#### Bash/Zsh（サービスアカウント）

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
export VERTEXAI_IMAGEN_OUTPUT_DIR="./output"
export VERTEXAI_IMAGEN_MAX_CONCURRENT_JOBS="3"
```

#### Bash/Zsh（APIキー）

```bash
export GOOGLE_API_KEY="your-api-key"
export GOOGLE_PROJECT_ID="your-project-id"
export VERTEXAI_IMAGEN_OUTPUT_DIR="./output"
export VERTEXAI_IMAGEN_MAX_CONCURRENT_JOBS="3"
```

#### `.env` ファイル（サービスアカウント）

```env
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
VERTEXAI_IMAGEN_OUTPUT_DIR=./output
VERTEXAI_IMAGEN_MAX_CONCURRENT_JOBS=3
```

#### `.env` ファイル（APIキー）

```env
GOOGLE_API_KEY=your-api-key
GOOGLE_PROJECT_ID=your-project-id
VERTEXAI_IMAGEN_OUTPUT_DIR=./output
VERTEXAI_IMAGEN_MAX_CONCURRENT_JOBS=3
```

---

## トラブルシューティング

### 1. 認証エラー

**エラー**: `Error: At least one authentication method must be set: GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_API_KEY, or GOOGLE_APPLICATION_CREDENTIALS`

**解決策**:
- 以下のいずれかの環境変数が設定されていることを確認：
  - `GOOGLE_APPLICATION_CREDENTIALS`（サービスアカウントファイルパス）
  - `GOOGLE_SERVICE_ACCOUNT_KEY`（サービスアカウントJSON文字列）
  - `GOOGLE_API_KEY`（APIキー + `GOOGLE_PROJECT_ID`）
- APIキーまたはサービスアカウントが有効であることを確認
- Vertex AI APIが有効化されていることを確認
- GitHub Actionsの場合、シークレット名が正しいことを確認（`GOOGLE_APPLICATION_CREDENTIALS`）

### 2. タイムアウトエラー

**エラー**: `Timeout reached. Cancelling remaining jobs...`

**解決策**:
- `--timeout` オプションで時間を延長
- `max_concurrent` を増やして並列度を上げる
- ジョブ数を減らす

### 3. ジョブ失敗

**エラー**: `Some jobs failed`

**解決策**:
- 結果のJSON出力を確認して失敗理由を特定
- プロンプトが安全性フィルターに違反していないか確認
- APIクォータを確認

### 4. GitHub Actionsでワークフローが実行されない

**解決策**:
- Issueコメントに `/batch` キーワードが含まれているか確認
- Issueが`open`状態であることを確認
- リポジトリシークレットが正しく設定されているか確認
- `.github/workflows/batch-image-generation.yml` が存在するか確認

### 5. 画像が生成されない

**解決策**:
- 出力ディレクトリの書き込み権限を確認
- ディスク容量を確認
- ログで詳細なエラーメッセージを確認：`DEBUG=1 vertexai-imagen-batch ...`

### 6. JSONパースエラー

**エラー**: `Invalid JSON`

**解決策**:
- JSON構文が正しいか確認（トレーリングカンマ、クォート等）
- オンラインのJSON validatorで検証
- `jobs` 配列が存在し、空でないことを確認

---

## まとめ

バッチ画像生成機能を使用することで、複数の画像を効率的に生成できます。

### 次のステップ

1. サンプル設定ファイルを作成して試してみる
2. GitHub Actionsワークフローを設定してIssue経由で実行
3. プロダクション環境に導入してCI/CDパイプラインに統合

### サポート

問題が発生した場合は、GitHubリポジトリでIssueを作成してください：
https://github.com/ex-takashima/vertexai-imagen-mcp-server/issues
