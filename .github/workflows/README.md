# GitHub Actions ワークフロー

このディレクトリには、バッチ画像生成用のGitHub Actionsワークフローが含まれています。

## ワークフロー一覧

### 1. batch-image-generation.yml

**ランナー**: GitHub-hosted (ubuntu-latest)

**トリガー**: Issueコメントに `/batch` が含まれている場合

**用途**: 標準的なバッチ画像生成

**特徴**:
- セットアップ不要
- 常に最新の環境
- 実行時間制限あり（最大6時間）

**使用例**:

Issueコメントに以下を投稿：

````markdown
/batch

```json
{
  "jobs": [
    {
      "prompt": "A beautiful sunset",
      "output_filename": "sunset.png"
    }
  ]
}
```
````

---

### 2. batch-image-generation-macos.yml

**ランナー**: Self-hosted macOS (macOS1)

**トリガー**: Issueコメントに `/batch-macos` が含まれている場合

**用途**: macOS環境でのバッチ画像生成

**特徴**:
- 高速なネットワーク
- カスタム環境設定可能
- 実行時間制限なし
- ローカルリソースへのアクセス可能

**使用例**:

Issueコメントに以下を投稿：

````markdown
/batch-macos

```json
{
  "jobs": [
    {
      "prompt": "A beautiful sunset",
      "output_filename": "sunset.png"
    }
  ]
}
```
````

---

### 3. claude.yml

**ランナー**: GitHub-hosted (ubuntu-latest)

**トリガー**:
- Issue コメント（`@claude` メンション）
- PR レビューコメント
- Issues 作成・割り当て

**用途**: Claude Code による自動対応

---

### 4. claude-code-review.yml

**ランナー**: GitHub-hosted (ubuntu-latest)

**トリガー**: PR 作成・更新時

**用途**: 自動コードレビュー

---

## 必要なシークレット設定

GitHub リポジトリの **Settings > Secrets and variables > Actions** で以下を設定：

### 認証方法A: サービスアカウント（推奨）

| シークレット名 | 説明 | 必須 |
|--------------|------|------|
| `GOOGLE_APPLICATION_CREDENTIALS` | サービスアカウントキーJSONの内容全体 | ✅ |
| `GOOGLE_PROJECT_ID` | Google CloudプロジェクトID | ❌ |

### 認証方法B: APIキー

| シークレット名 | 説明 | 必須 |
|--------------|------|------|
| `GOOGLE_API_KEY` | Google Cloud APIキー | ✅ |
| `GOOGLE_PROJECT_ID` | Google CloudプロジェクトID | ✅ |

### その他のオプション

| シークレット名 | 説明 | デフォルト |
|--------------|------|-----------|
| `GOOGLE_REGION` | Google Cloudリージョン | `us-central1` |
| `MAX_CONCURRENT_JOBS` | 最大同時実行数 | `2` |

---

## Self-hosted macOS ランナーのセットアップ

Self-hosted macOS ランナーを使用する場合は、以下の手順が必要です：

### 1. ランナーのインストール

リポジトリ > Settings > Actions > Runners > "New self-hosted runner"

macOS用の指示に従ってインストール：

```bash
# ランナーディレクトリを作成
mkdir actions-runner && cd actions-runner

# ランナーをダウンロード
curl -o actions-runner-osx-x64-2.311.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-osx-x64-2.311.0.tar.gz

# 解凍
tar xzf ./actions-runner-osx-x64-2.311.0.tar.gz

# ランナーを設定
./config.sh --url https://github.com/YOUR_USERNAME/YOUR_REPO --token YOUR_TOKEN
```

### 2. ラベルの設定

設定時にラベルを追加：
- `macOS`
- `macOS1`

### 3. 依存関係のインストール

```bash
# Node.js 20以上
brew install node@20

# その他の必要なツール
brew install git
```

### 4. ランナーの起動

```bash
# フォアグラウンドで実行
./run.sh

# または、バックグラウンドで実行
nohup ./run.sh > runner.log 2>&1 &

# または、サービスとして登録（推奨）
sudo ./svc.sh install
sudo ./svc.sh start
```

### 5. ランナーの確認

リポジトリ > Settings > Actions > Runners で、ランナーが「Idle」状態になっていることを確認。

---

## トラブルシューティング

### ワークフローが実行されない

**原因**: トリガーキーワードが正しくない

**解決策**:
- GitHub-hosted: `/batch` を使用
- Self-hosted macOS: `/batch-macos` を使用
- Issueが `open` 状態であることを確認

### 認証エラー

**原因**: シークレットが設定されていない

**解決策**:
- Settings > Secrets で `GOOGLE_APPLICATION_CREDENTIALS` または `GOOGLE_API_KEY` が設定されているか確認
- シークレットの値が正しいか確認（JSON形式など）

### macOS ランナーが応答しない

**原因**: ランナーが停止している

**解決策**:
```bash
# ランナーのステータスを確認
ps aux | grep Runner.Listener

# ランナーを再起動
sudo ./svc.sh restart
```

### 画像生成に失敗する

**原因**: Vertex AI APIのクォータ超過

**解決策**:
- Google Cloud Console でクォータを確認
- `MAX_CONCURRENT_JOBS` を減らす
- リクエスト数を減らす

---

## 詳細ドキュメント

詳しい使用方法とサンプルについては、以下を参照してください：

- [バッチ処理ガイド](../../docs/BATCH_PROCESSING.md)
- [サンプル集](../../examples/README.md)
- [メインREADME](../../README.md)

---

## サポート

問題が発生した場合は、GitHubリポジトリでIssueを作成してください：
https://github.com/ex-takashima/vertexai-imagen-mcp-server/issues
