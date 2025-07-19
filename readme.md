# Google Imagine MCP Server

Google ImagineのAPIを使用して画像を生成するMCP（Model Context Protocol）サーバーです。

## 機能

- **画像生成**: テキストプロンプトから画像を生成
- **安全性フィルター**: コンテンツの安全性レベルを設定可能
- **人物生成制御**: 人物の生成ポリシーを設定可能
- **画像一覧表示**: 生成済み画像ファイルの一覧表示

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Google Cloud APIキーの設定

Google Cloud Console でImagine APIを有効にし、APIキーを取得してください。

```bash
export GOOGLE_API_KEY="your-google-api-key"
```

### 3. ビルド

```bash
npm run build
```

## 使用方法

### 開発時

```bash
npm run dev
```

### 本番環境

```bash
npm start
```

## 利用可能なツール

### 1. generate_image

画像を生成します。

**パラメータ:**
- `prompt` (必須): 画像を描写するテキストプロンプト
- `output_path` (オプション): 保存先パス（デフォルト: "generated_image.png"）
- `safety_level` (オプション): 安全性フィルターレベル
  - `BLOCK_NONE`: フィルターなし
  - `BLOCK_ONLY_HIGH`: 高リスクのみブロック
  - `BLOCK_MEDIUM_AND_ABOVE`: 中リスク以上をブロック（デフォルト）
  - `BLOCK_LOW_AND_ABOVE`: 低リスク以上をブロック
- `person_generation` (オプション): 人物生成ポリシー
  - `DONT_ALLOW`: 人物生成を許可しない（デフォルト）
  - `ALLOW_ADULT`: 成人の生成を許可
  - `ALLOW_ALL`: すべての人物生成を許可

**使用例:**
```json
{
  "name": "generate_image",
  "arguments": {
    "prompt": "美しい夕日が映る湖の風景",
    "output_path": "sunset_lake.png",
    "safety_level": "BLOCK_MEDIUM_AND_ABOVE"
  }
}
```

### 2. list_generated_images

指定されたディレクトリ内の画像ファイル一覧を表示します。

**パラメータ:**
- `directory` (オプション): 検索するディレクトリ（デフォルト: "."）

**使用例:**
```json
{
  "name": "list_generated_images",
  "arguments": {
    "directory": "./images"
  }
}
```

## Claude Desktop での設定

### 設定ファイルの場所

Claude Desktop の MCP 設定ファイルは以下の場所にあります：

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%/Claude/claude_desktop_config.json
```

### 設定方法

#### 方法1: 環境変数でAPIキーを設定（推奨）

```json
{
  "mcpServers": {
    "google-imagine": {
      "command": "node",
      "args": ["/path/to/your/google-imagine-mcp-server/build/index.js"],
      "env": {
        "GOOGLE_API_KEY": "your-actual-google-api-key-here"
      }
    }
  }
}
```

#### 方法2: グローバル環境変数を使用

1. システムの環境変数に `GOOGLE_API_KEY` を設定
2. Claude Desktop設定では環境変数を参照しない

```json
{
  "mcpServers": {
    "google-imagine": {
      "command": "node",
      "args": ["/path/to/your/google-imagine-mcp-server/build/index.js"]
    }
  }
}
```

#### 方法3: npmパッケージとして設定（推奨）

プロジェクトをnpmパッケージとしてグローバルインストールした場合：

```json
{
  "mcpServers": {
    "google-imagine": {
      "command": "google-imagine-mcp-server",
      "env": {
        "GOOGLE_API_KEY": "your-actual-google-api-key-here"
      }
    }
  }
}
```

### 完全な設定例

```json
{
  "mcpServers": {
    "google-imagine": {
      "command": "node",
      "args": ["/Users/yourname/projects/google-imagine-mcp-server/build/index.js"],
      "env": {
        "GOOGLE_API_KEY": "AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  },
  "globalShortcut": "Cmd+Shift+."
}
```

### 設定手順

1. **Claude Desktop を終了**

2. **設定ファイルを開く/作成**
   ```bash
   # macOS
   mkdir -p ~/Library/Application\ Support/Claude
   open ~/Library/Application\ Support/Claude/claude_desktop_config.json
   
   # Windows PowerShell
   New-Item -Path "$env:APPDATA\Claude" -ItemType Directory -Force
   notepad "$env:APPDATA\Claude\claude_desktop_config.json"
   ```

3. **上記のJSON設定を記述**

4. **ファイルパスを正しく設定**
   - プロジェクトをビルドした実際のパスに変更
   - Windows の場合はバックスラッシュをエスケープ: `"C:\\path\\to\\project\\build\\index.js"`

5. **Claude Desktop を再起動**

6. **動作確認**
   - Claude Desktop でチャットを開始
   - "画像を生成して" などと入力して機能を確認

## 注意事項

- Google Cloud APIキーが必要です
- Google Imagine APIの利用料金が発生する場合があります
- 生成される画像は指定したパスに保存されます
- 安全性フィルターにより、一部のプロンプトは生成がブロックされる場合があります

## トラブルシューティング

### API キーエラー
```
GOOGLE_API_KEY environment variable is required
```
環境変数`GOOGLE_API_KEY`が設定されていることを確認してください。

### API呼び出しエラー
Google Imagine APIの制限や利用状況を確認してください。レート制限に達している可能性があります。

### ファイル保存エラー
指定したパスに書き込み権限があることを確認してください。

## ライセンス

MIT License