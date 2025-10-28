# ローカルでのバッチ処理テストガイド

公開リポジトリでIssueを使わずにバッチ処理をローカルでテストする方法です。

## 前提条件

### 1. Google Cloud認証情報

以下のいずれかが必要です：

#### オプションA: サービスアカウントキー（推奨）
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

#### オプションB: APIキー
```bash
export GOOGLE_API_KEY="your-api-key"
export GOOGLE_PROJECT_ID="your-project-id"
```

### 2. プロジェクトのビルド

```bash
npm run build
```

---

## テスト方法

### 方法1: 開発モードで実行（推奨）

TypeScriptファイルを直接実行するため、ビルド不要で素早くテストできます。

```bash
# 環境変数を設定
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"

# 開発モードで実行
npm run dev:batch test.json
```

または、オプションを指定：

```bash
npm run dev:batch test.json -- --output-dir ./test-output --format text
```

### 方法2: ビルド済みCLIで実行

本番環境と同じ方法でテストできます。

```bash
# ビルド
npm run build

# 実行
npm run batch -- test.json

# または、オプション付き
npm run batch -- test.json --output-dir ./test-output --format json
```

### 方法3: 直接実行

```bash
# 開発モード
npx tsx src/cli.ts test.json

# ビルド後
node build/cli.js test.json
```

---

## テスト用の設定ファイル

### test.json（既に作成済み）

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
      "include_thumbnail": false
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

### シンプルなテスト用（test-simple.json）

コスト削減のため、1つのシンプルなプロンプトのみ：

```bash
cat > test-simple.json << 'EOF'
{
  "jobs": [
    {
      "prompt": "A simple red circle on white background",
      "output_filename": "test-circle.png",
      "aspect_ratio": "1:1",
      "model": "imagen-3.0-fast-generate-001"
    }
  ]
}
EOF
```

実行：
```bash
npm run dev:batch test-simple.json
```

---

## 出力の確認

### テキスト形式（デフォルト）

```bash
npm run dev:batch test.json
```

出力例：
```
[CLI] Validating environment variables...
[CLI] Output directory: ./generated-images
[BATCH] Starting batch processing with 2 jobs
[BATCH] Queueing job 1/2: A photorealistic portrait...
[BATCH] Queueing job 2/2: A minimalist abstract art...
[BATCH] All jobs queued. Waiting for completion...
[BATCH] Progress: 1 completed, 0 failed, 1 pending
[BATCH] Progress: 2 completed, 0 failed, 0 pending
[BATCH] Batch processing completed:
[BATCH]   Total: 2
[BATCH]   Succeeded: 2
[BATCH]   Failed: 0
[BATCH]   Duration: 45320ms

=== Batch Processing Result ===
Total Jobs: 2
Succeeded: 2
Failed: 0
Duration: 45320ms
...
```

### JSON形式

```bash
npm run dev:batch test.json -- --format json > result.json
cat result.json
```

出力例：
```json
{
  "total": 2,
  "succeeded": 2,
  "failed": 0,
  "results": [
    {
      "job_id": "abc123...",
      "prompt": "A photorealistic portrait of a smiling woman",
      "status": "completed",
      "output_path": "./generated-images/portrait.png",
      "duration_ms": 23450
    },
    {
      "job_id": "def456...",
      "prompt": "A minimalist abstract art piece with geometric shapes",
      "status": "completed",
      "output_path": "./generated-images/abstract.png",
      "duration_ms": 21870
    }
  ],
  "started_at": "2025-01-28T05:30:00.000Z",
  "finished_at": "2025-01-28T05:30:45.000Z",
  "total_duration_ms": 45320
}
```

---

## 環境変数のカスタマイズ

### 出力ディレクトリ変更

```bash
export VERTEXAI_IMAGEN_OUTPUT_DIR="./my-test-output"
npm run dev:batch test.json
```

### 同時実行数変更

```bash
export VERTEXAI_IMAGEN_MAX_CONCURRENT_JOBS=1
npm run dev:batch test.json
```

### デバッグモード

```bash
export DEBUG=1
npm run dev:batch test.json
```

詳細なログが出力されます：
```
[DEBUG] Environment validation passed
[DEBUG] Auth mode: Service Account (File)
[DEBUG] Credentials file: /path/to/service-account-key.json
[DEBUG] Project ID: your-project-id
[DEBUG] Region: us-central1
[DEBUG] Max concurrent jobs: 3
```

---

## トラブルシューティング

### 認証エラー

```
Error: At least one authentication method must be set
```

**解決策**:
```bash
# 環境変数を確認
echo $GOOGLE_APPLICATION_CREDENTIALS
echo $GOOGLE_API_KEY

# 未設定の場合は設定
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"
```

### ビルドエラー

```
Error: Cannot find module './build/cli.js'
```

**解決策**:
```bash
npm run build
```

### タイムアウト

```
[BATCH] Timeout reached. Cancelling remaining jobs...
```

**解決策**:
```bash
# タイムアウトを延長（20分）
npm run dev:batch test.json -- --timeout 1200000
```

---

## CI/CD環境でのテスト

GitHub Actionsを使わずにローカルでCI/CD環境をシミュレート：

```bash
# .envファイルを作成
cat > .env.test << 'EOF'
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
GOOGLE_PROJECT_ID=your-project-id
VERTEXAI_IMAGEN_OUTPUT_DIR=./ci-output
VERTEXAI_IMAGEN_MAX_CONCURRENT_JOBS=2
EOF

# 環境変数を読み込んで実行
set -a
source .env.test
set +a

npm run batch -- test.json --format json > ci-result.json
echo "Exit code: $?"
cat ci-result.json
```

---

## コスト管理

### 推定コスト

- **imagen-3.0-fast-generate-001**: 約 $0.02/枚
- **imagen-4.0-generate-001**: 約 $0.04/枚
- **imagen-4.0-ultra-generate-001**: 約 $0.08/枚

### コスト削減のヒント

1. **test-simple.json を使用**: 1枚のみ生成
2. **fast モデルを使用**: `imagen-3.0-fast-generate-001`
3. **1K解像度を使用**: `sample_image_size: "1K"`
4. **同時実行数を1に**: `max_concurrent: 1`

---

## クリーンアップ

テスト後の生成ファイル削除：

```bash
# 生成画像の削除
rm -rf ./generated-images
rm -rf ./test-output
rm -rf ./ci-output

# データベース削除（必要に応じて）
rm -f ~/Downloads/vertexai-imagen-files/data/vertexai-imagen.db
```

---

## まとめ

公開リポジトリでIssueを作成せずにバッチ処理をテストする方法：

1. ✅ **開発モード**: `npm run dev:batch test.json`（最速）
2. ✅ **本番モード**: `npm run batch -- test.json`（CI/CDと同じ）
3. ✅ **シンプルテスト**: `test-simple.json` でコスト削減
4. ✅ **デバッグモード**: `DEBUG=1` で詳細ログ

これで、GitHub Actionsを実行せずにローカルで完全にテストできます！
