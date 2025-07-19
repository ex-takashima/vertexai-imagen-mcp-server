# Google Imagine MCP Server - グローバルインストールガイド

## グローバルインストール方法

### 方法1: npm link を使用（開発用）

```bash
# プロジェクトディレクトリで
npm run build
npm link

# これで `google-imagine-mcp-server` コマンドがグローバルで使用可能になります
```

### 方法2: npm install -g を使用（ローカルパッケージ）

```bash
# プロジェクトディレクトリで
npm run build
npm pack

# 生成された .tgz ファイルをグローバルインストール
npm install -g google-imagine-mcp-server-0.1.0.tgz
```

### 方法3: npm publish & install（推奨）

```bash
# 1. npmレジストリに公開
npm publish

# 2. どこからでもインストール可能
npm install -g google-imagine-mcp-server
```

## Claude Desktop での設定（グローバルインストール後）

### 基本設定

```json
{
  "mcpServers": {
    "google-imagine": {
      "command": "google-imagine-mcp-server",
      "env": {
        "GOOGLE_API_KEY": "your-google-api-key-here"
      }
    }
  }
}
```

### 作業ディレクトリを指定する場合

```json
{
  "mcpServers": {
    "google-imagine": {
      "command": "google-imagine-mcp-server",
      "cwd": "/path/to/images/directory",
      "env": {
        "GOOGLE_API_KEY": "your-google-api-key-here"
      }
    }
  }
}
```

## インストール確認

```bash
# コマンドが利用可能か確認
which google-imagine-mcp-server

# バージョン確認（サーバーを直接実行）
google-imagine-mcp-server --version
```

## アンインストール

### npm link の場合

```bash
# グローバルリンクを削除
npm unlink -g google-imagine-mcp-server

# プロジェクトディレクトリでローカルリンクを削除
npm unlink
```

### npm install -g の場合

```bash
npm uninstall -g google-imagine-mcp-server
```

## 開発ワークフロー

### 1. 初回セットアップ

```bash
git clone <your-repo>
cd google-imagine-mcp-server
npm install
npm run build
npm link
```

### 2. 開発中の更新

```bash
# コードを変更後
npm run build

# 既にlinkされているので、すぐに最新版が使用可能
```

### 3. Claude Desktop での動作確認

設定ファイルは変更不要。Claude Desktop を再起動するだけで最新版が使用されます。

## パッケージ配布用設定

### .npmignore ファイル

```
src/
*.ts
*.log
node_modules/
.git/
.DS_Store
tests/
examples/
docs/
```

### リリース用スクリプト

```bash
# バージョンアップ
npm version patch  # または minor, major

# ビルド & 公開
npm run build
npm publish
```

## 利点

1. **簡単な設定**: パスを指定する必要がない
2. **自動更新**: `npm update -g` で最新版に更新可能
3. **ポータビリティ**: どのマシンでも同じ設定で使用可能
4. **バージョン管理**: npmでバージョン管理が可能

## 使用例

グローバルインストール後、Claude Desktop で以下のように使用できます：

```
美しい夕日の画像を生成して、ファイル名は "sunset.png" にしてください
```

```
現在のディレクトリにある画像ファイルを一覧表示してください
```

## トラブルシューティング

### コマンドが見つからない場合

```bash
# npm のグローバルインストールパスを確認
npm config get prefix

# パスが環境変数に含まれているか確認
echo $PATH  # macOS/Linux
echo %PATH%  # Windows
```

### 権限エラーの場合

```bash
# macOS/Linux の場合、sudo を使用
sudo npm install -g google-imagine-mcp-server

# または npm の設定を変更
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

### Windows での権限エラー

PowerShell を管理者として実行してインストールしてください。

## 開発用の追加機能

### デバッグモード

環境変数 `DEBUG=1` を設定すると詳細なログが出力されます：

```json
{
  "mcpServers": {
    "google-imagine": {
      "command": "google-imagine-mcp-server",
      "env": {
        "GOOGLE_API_KEY": "your-google-api-key-here",
        "DEBUG": "1"
      }
    }
  }
}
```