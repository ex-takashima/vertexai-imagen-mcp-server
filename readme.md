# Google Imagine MCP Server

Google ImagineのAPIを使用して画像を生成するMCP（Model Context Protocol）サーバーです。Claude DesktopなどのMCPクライアントで使用することで、チャット内から直接AI画像生成が可能になります。

## 🌟 機能

- **🎨 画像生成**: テキストプロンプトから高品質な画像を生成
- **🛡️ 安全性フィルター**: コンテンツの安全性レベルを細かく設定可能
- **👤 人物生成制御**: 人物の生成ポリシーを柔軟に設定
- **📁 画像管理**: 生成済み画像ファイルの一覧表示と管理
- **🔧 デバッグモード**: トラブルシューティング用の詳細ログ出力

## 📋 必要条件

- **Node.js**: v18以上
- **Google Cloud API**: Imagen APIが有効なプロジェクトとAPIキー
- **MCP対応クライアント**: Claude Desktop等

## 🚀 クイックスタート

### 1. Google Cloud APIキーの取得

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを作成または選択
3. 「APIとサービス」→「ライブラリ」から「**Imagen API**」を検索して有効化
4. 「認証情報」→「認証情報を作成」→「**APIキー**」
5. 生成されたAPIキーをコピー（後で使用）

### 2. プロジェクトのセットアップ

```bash
# プロジェクトをクローンまたはダウンロード
git clone <repository-url>
cd google-imagine-mcp-server

# 依存関係をインストール
npm install

# TypeScriptをコンパイル
npm run build
```

### 3. インストール方法の選択

以下のいずれかの方法でインストールできます：

#### 🎯 方法A: npm link（開発・テスト用）

```bash
# プロジェクトディレクトリで
npm link

# 確認
google-imagine-mcp-server --version
```

#### 📦 方法B: ローカルパッケージ（推奨）

```bash
# パッケージを作成
npm pack

# グローバルインストール（Windows: PowerShellを管理者として実行）
npm install -g ./google-imagine-mcp-server-0.1.0.tgz

# 確認
google-imagine-mcp-server --version
```

#### 🌐 方法C: 直接パス指定（バックアップ案）

グローバルインストールで問題がある場合は、Claude Desktop設定で直接パスを指定：

```json
{
  "mcpServers": {
    "google-imagine": {
      "command": "node",
      "args": ["C:\\projects\\google-imagine-mcp-server\\build\\index.js"],
      "env": {
        "GOOGLE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

**💡 推奨**: 方法Bを試して、問題があれば方法Cを使用してください。

### 4. Claude Desktop での設定

Claude Desktop の設定ファイルを編集します：

**設定ファイルの場所:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**設定内容:**
```json
{
  "mcpServers": {
    "google-imagine": {
      "command": "google-imagine-mcp-server",
      "env": {
        "GOOGLE_API_KEY": "AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

### 5. Claude Desktop を再起動

設定ファイルを保存後、Claude Desktop を完全に終了して再起動してください。

## 🎯 使用方法

Claude Desktop で以下のように話しかけるだけで画像生成ができます：

### 基本的な使用例

```
美しい夕日が映る湖の風景の画像を生成してください
```

```
猫が宇宙服を着ている可愛いイラストを作って、ファイル名は "space_cat.png" で保存してください
```

```
現在のフォルダにある画像ファイルを一覧表示してください
```

### 詳細なパラメーター指定

より細かい制御をしたい場合は、以下のように具体的に指定できます：

```
ドラゴンの画像を生成してください。ファイル名は "dragon.png"、安全性レベルは高リスクのみブロック、人物生成は許可しないでお願いします。
```

```
人物の画像を生成したいです。成人の生成を許可して、安全性レベルは中リスク以上をブロックしてください。ファイル名は "portrait.png" でお願いします。
```

```
安全性フィルターを最も緩く設定して、"fantasy_art.png" というファイル名で幻想的なアート作品を生成してください。
```

### パラメーターの自然な指定方法

Claude Desktopでは、以下のような**自然な日本語**でパラメーターを指定できます：

| 指定したい内容 | 自然な表現例 |
|---------------|-------------|
| ファイル名 | "ファイル名は○○にして"<br>"○○.pngで保存して"<br>"○○という名前で保存" |
| 安全性レベル | "安全性フィルターを緩くして"<br>"高リスクのみブロック"<br>"フィルターなしで" |
| 人物生成 | "人物は生成しないで"<br>"成人の生成を許可"<br>"人物も含めて生成" |
| 保存場所 | "Desktopに保存"<br>"画像フォルダに保存"<br>"C:\images\ フォルダに保存" |

## 🛠️ 利用可能なツール

### 1. generate_image

**説明**: テキストプロンプトから画像を生成します

**⚠️ 重要**: パラメーターはClaude Desktopの**チャット内で自然な日本語**で指定します。JSON形式で直接入力する必要はありません。

#### パラメーター詳細

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|------------|----|----|-----------|------|
| `prompt` | string | ✅ | - | 画像を描写するテキストプロンプト |
| `output_path` | string | ❌ | "generated_image.png" | 保存先ファイルパス |
| `safety_level` | string | ❌ | "BLOCK_MEDIUM_AND_ABOVE" | 安全性フィルターレベル |
| `person_generation` | string | ❌ | "DONT_ALLOW" | 人物生成ポリシー |

#### 安全性レベルの設定方法

| レベル | 説明 | Claude Desktopでの指定方法 |
|--------|------|---------------------------|
| `BLOCK_NONE` | フィルターなし | "安全性フィルターなしで"<br>"フィルターを無効にして" |
| `BLOCK_ONLY_HIGH` | 高リスクのみブロック | "安全性フィルターを緩くして"<br>"高リスクのみブロック" |
| `BLOCK_MEDIUM_AND_ABOVE` | 中リスク以上をブロック | "標準の安全性で"<br>"通常の安全性レベルで" |
| `BLOCK_LOW_AND_ABOVE` | 低リスク以上をブロック | "安全性を厳しくして"<br>"厳格な安全性フィルターで" |

#### 人物生成ポリシーの設定方法

| ポリシー | 説明 | Claude Desktopでの指定方法 |
|----------|------|---------------------------|
| `DONT_ALLOW` | 人物生成を許可しない | "人物は生成しないで"<br>"人を含めずに生成" |
| `ALLOW_ADULT` | 成人の生成を許可 | "成人の生成を許可して"<br>"大人の人物は含めてもOK" |
| `ALLOW_ALL` | すべての人物生成を許可 | "人物も含めて生成して"<br>"人を含めてもOK" |

#### 📝 実際の使用例（Claude Desktopでの会話）

**例1: 基本的な画像生成**
```
ユーザー: 美しい桜の木の画像を生成してください

Claude: [generate_imageツールを使用]
→ prompt: "美しい桜の木"
→ output_path: "generated_image.png" (デフォルト)
→ safety_level: "BLOCK_MEDIUM_AND_ABOVE" (デフォルト)
→ person_generation: "DONT_ALLOW" (デフォルト)
```

**例2: ファイル名を指定**
```
ユーザー: 猫の画像を生成して、ファイル名は "cute_cat.png" にしてください

Claude: [generate_imageツールを使用]
→ prompt: "猫"
→ output_path: "cute_cat.png"
→ その他はデフォルト値
```

**例3: 詳細なパラメーター指定**
```
ユーザー: 人物のポートレートを生成してください。成人の生成を許可して、安全性レベルは高リスクのみブロック、ファイル名は "portrait.png" でお願いします。

Claude: [generate_imageツールを使用]
→ prompt: "人物のポートレート"
→ output_path: "portrait.png"
→ safety_level: "BLOCK_ONLY_HIGH"
→ person_generation: "ALLOW_ADULT"
```

**例4: 保存場所を指定**
```
ユーザー: ドラゴンの画像を Desktop/images フォルダに "dragon.png" として保存してください

Claude: [generate_imageツールを使用]
→ prompt: "ドラゴン"
→ output_path: "Desktop/images/dragon.png"
→ その他はデフォルト値
```

#### 🚨 注意事項

- **JSON形式での入力は不要**: Claude Desktopでは自然な日本語で指定するだけです
- **プロンプトの質**: より詳細で具体的なプロンプトほど高品質な画像が生成されます
- **英語プロンプト**: 英語でプロンプトを書くとより良い結果が得られる場合があります
- **ファイルパス**: 相対パス（例: "images/photo.png"）と絶対パス（例: "C:\Users\Name\Desktop\photo.png"）の両方に対応

### 2. list_generated_images

**説明**: 指定されたディレクトリ内の画像ファイル一覧を表示します

**パラメータ:**

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|------------|----|----|-----------|------|
| `directory` | string | ❌ | "." | 検索するディレクトリパス |

#### 📝 実際の使用例

**例1: 現在のフォルダの画像一覧**
```
ユーザー: 現在のフォルダにある画像ファイルを一覧表示してください

Claude: [list_generated_imagesツールを使用]
→ directory: "." (デフォルト)
```

**例2: 特定フォルダの画像一覧**
```
ユーザー: Desktop/photos フォルダにある画像ファイルを表示してください

Claude: [list_generated_imagesツールを使用]
→ directory: "Desktop/photos"
```

## 🔧 開発・カスタマイズ

### 開発環境でのテスト

```bash
# 開発モードで実行
npm run dev

# デバッグモードで実行
DEBUG=1 npm run dev
```

### カスタムビルド

```bash
# TypeScriptコンパイル
npm run build

# 配布用パッケージ作成
npm pack
```

### デバッグモード

詳細なログを確認したい場合は、Claude Desktop設定で `DEBUG` 環境変数を追加：

```json
{
  "mcpServers": {
    "google-imagine": {
      "command": "google-imagine-mcp-server",
      "env": {
        "GOOGLE_API_KEY": "your-api-key",
        "DEBUG": "1"
      }
    }
  }
}
```

## 🔍 トラブルシューティング

### よくある問題と解決方法

#### 🚫 サーバーが認識されない

**原因**: パスまたは権限の問題

**解決策**:
```bash
# コマンドの存在確認
which google-imagine-mcp-server  # macOS/Linux
where google-imagine-mcp-server  # Windows

# 権限で問題がある場合（Windows）
# PowerShellを管理者として実行してインストール
```

#### 🔑 API キーエラー

**エラーメッセージ**: `GOOGLE_API_KEY environment variable is required`

**解決策**:
1. Google Cloud Console でAPIキーが有効か確認
2. Imagen API が有効化されているか確認
3. 設定ファイルでAPIキーが正しく設定されているか確認

#### 💰 課金設定エラー

**エラーメッセージ**: Billing account related errors

**解決策**:
1. Google Cloud で請求先アカウントが設定されているか確認
2. Imagen API の利用料金について確認

#### 🖼️ 画像生成エラー

**原因**: プロンプトが安全性フィルターに引っかかった場合

**解決策**:
1. プロンプトの内容を調整
2. `safety_level` を `BLOCK_ONLY_HIGH` に緩和
3. 具体的で建設的な表現に変更

#### 📝 ログの確認

**Claude Desktop のログ場所:**
- **macOS**: `~/Library/Logs/Claude/`
- **Windows**: `%APPDATA%\Claude\logs\`

### バージョン確認

```bash
# MCPサーバーのバージョン
google-imagine-mcp-server --version

# Node.js バージョン（v18以上必要）
node --version

# npm バージョン
npm --version
```

## 📖 APIリファレンス

### コマンドライン引数

```bash
# ヘルプ表示
google-imagine-mcp-server --help

# バージョン表示
google-imagine-mcp-server --version
```

### 環境変数

| 変数名 | 必須 | 説明 |
|--------|-----|------|
| `GOOGLE_API_KEY` | ✅ | Google Cloud APIキー |
| `DEBUG` | ❌ | デバッグログの有効化（"1"で有効） |

## 🔒 セキュリティ注意事項

- **APIキーの管理**: APIキーは機密情報です。設定ファイルを他人と共有しないでください
- **定期的なローテーション**: セキュリティのため、APIキーを定期的に更新することを推奨
- **アクセス制限**: Google Cloud Console でAPIキーの使用制限を設定することを推奨
- **不要なキーの削除**: 使用しなくなったAPIキーは速やかに削除してください

## 💰 費用について

Google Imagine API は従量課金制です。詳細な料金については [Google Cloud Pricing](https://cloud.google.com/vertex-ai/pricing) をご確認ください。

## 🤝 コントリビューション

プルリクエストやイシューの報告を歓迎します！

1. このリポジトリをフォーク
2. feature ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを開く

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルをご覧ください。

## 🙏 謝辞

- [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic
- [Google Cloud Imagen API](https://cloud.google.com/vertex-ai/docs/generative-ai/image/overview)

---

**💡 ヒント**: 画像生成がうまくいかない場合は、プロンプトをより具体的で詳細な内容に変更してみてください。英語のプロンプトの方が高品質な結果が得られる場合があります。