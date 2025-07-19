# Google Imagen MCP Server

Google ImagenのAPIを使用して画像を生成するMCP（Model Context Protocol）サーバーです。Claude DesktopなどのMCPクライアントで使用することで、チャット内から直接AI画像生成が可能になります。

## 🌟 機能

- **🎨 画像生成**: テキストプロンプトから高品質な画像を生成
- **📐 アスペクト比指定**: 1:1, 3:4, 4:3, 9:16, 16:9 の5種類のアスペクト比に対応
- **🔍 アップスケーリング**: 既存画像を2倍または4倍に高品質拡大
- **⚡ 統合処理**: 画像生成とアップスケーリングを一度の操作で実行
- **🖼️ 直接表示モード**: base64エンコードでMCPクライアント内での画像表示
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
3. 「APIとサービス」→「ライブラリ」から「**Vertex AI API**」を検索して有効化
4. 「認証情報」→「認証情報を作成」→「**APIキー**」
5. 生成されたAPIキーをコピー（後で使用）

**重要**: Imagen は Vertex AI の一部として提供されています。「Imagen API」という独立したAPIは存在しないため、「**Vertex AI API**」を有効化してください。

### 2. プロジェクトのセットアップ

```bash
# プロジェクトをクローンまたはダウンロード
git clone https://github.com/ex-takashima/google-imagen-mcp-server.git
cd google-imagen-mcp-server

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
google-imagen-mcp-server --version
```

#### 📦 方法B: ローカルパッケージ（推奨）

```bash
# パッケージを作成
npm pack

# グローバルインストール（Windows: PowerShellを管理者として実行）
npm install -g ./google-imagen-mcp-server-*.tgz

# 確認
google-imagen-mcp-server --version
```

#### 🌐 方法C: 直接パス指定（バックアップ案）

グローバルインストールで問題がある場合は、Claude Desktop設定で直接パスを指定：

```json
{
  "mcpServers": {
    "google-imagen": {
      "command": "node",
      "args": ["C:\\projects\\google-imagen-mcp-server\\build\\index.js"],
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
    "google-Imagen": {
      "command": "google-imagen-mcp-server",
      "env": {
        "GOOGLE_API_KEY": "AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        // "GOOGLE_IMAGEN_MODEL": "imagen-3.0-latest" // 必要に応じてモデルを変更
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

### 新機能の使用例

#### アスペクト比指定
```
横長ワイド画面（16:9）で美しい山の風景画像を生成してください
```

```
スマホ壁紙用の縦長（9:16）で可愛い動物の画像を作ってください
```

#### アップスケーリング
```
"photo.jpg" を4倍にアップスケーリングして高解像度にしてください
```

#### 統合処理（生成+アップスケーリング）
```
ドラゴンの画像をワイド画面で生成して、2倍にアップスケーリングしてください
```

#### 直接表示モード
```
猫の画像を生成して、チャット内で直接表示してください（ファイル保存なし）
```

```
"small_image.png" をアップスケーリングして、結果をここで見せてください
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
| アスペクト比 | "横長で生成して"<br>"16:9のワイド画面で"<br>"縦長の画像で" |
| 表示モード | "チャット内で画像を表示して"<br>"ファイル保存せずに直接見せて"<br>"画像を表示してください" |
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
| `aspect_ratio` | string | ❌ | "1:1" | アスペクト比（1:1, 3:4, 4:3, 9:16, 16:9） |
| `return_base64` | boolean | ❌ | false | チャット内での画像表示モード |
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

#### アスペクト比の設定方法

| 比率 | 説明 | 用途 | Claude Desktopでの指定方法 |
|------|------|------|---------------------------|
| `1:1` | 正方形 | SNS投稿、アイコン | "正方形で"<br>"1:1で生成" |
| `3:4` | 縦長 | ポートレート、モバイル壁紙 | "縦長で"<br>"ポートレート形式で" |
| `4:3` | 横長 | 従来のテレビ画面 | "4:3で"<br>"従来の画面比率で" |
| `9:16` | 縦長ワイド | スマホ動画、ストーリー | "スマホ動画サイズで"<br>"縦長ワイドで" |
| `16:9` | 横長ワイド | 現代のテレビ、風景 | "ワイド画面で"<br>"16:9で生成"<br>"横長で" |

#### 直接表示モードについて

`return_base64` を有効にすると、生成した画像を**Claude Desktop内で直接表示**できます：

- **利点**: ファイル保存せずに即座に画像確認
- **用途**: プレビュー、アイデア検討、迅速な確認
- **制限**: 画像サイズが大きい場合、表示に時間がかかる場合があります

### 2. upscale_image

**説明**: 既存の画像を2倍または4倍にアップスケーリング（高品質拡大）します

#### パラメーター詳細

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|------------|----|----|-----------|------|
| `input_path` | string | ✅ | - | アップスケーリングする画像ファイルパス |
| `output_path` | string | ❌ | "upscaled_[元ファイル名]" | 保存先ファイルパス |
| `scale_factor` | string | ❌ | "2" | 拡大倍率（"2" または "4"） |
| `return_base64` | boolean | ❌ | false | チャット内での画像表示モード |

#### 📝 実際の使用例（Claude Desktopでの会話）

**例1: 基本的なアップスケーリング**
```
ユーザー: "photo.png" を2倍にアップスケーリングしてください

Claude: [upscale_imageツールを使用]
→ input_path: "photo.png"
→ scale_factor: "2" (デフォルト)
→ output_path: "upscaled_2x_photo.png" (自動生成)
```

**例2: 4倍アップスケーリング**
```
ユーザー: "small_icon.png" を4倍に拡大して "large_icon.png" として保存してください

Claude: [upscale_imageツールを使用]
→ input_path: "small_icon.png"
→ scale_factor: "4"
→ output_path: "large_icon.png"
```

**例3: 直接表示モード**
```
ユーザー: "画像.jpg" をアップスケーリングして、チャット内で表示してください

Claude: [upscale_imageツールを使用]
→ input_path: "画像.jpg"
→ return_base64: true
→ その他はデフォルト値
```

### 3. generate_and_upscale_image

**説明**: 画像生成とアップスケーリングを一度の操作で実行します

#### パラメーター詳細

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|------------|----|----|-----------|------|
| `prompt` | string | ✅ | - | 画像を描写するテキストプロンプト |
| `output_path` | string | ❌ | "generated_upscaled_image.png" | 最終画像の保存先 |
| `aspect_ratio` | string | ❌ | "1:1" | アスペクト比（1:1, 3:4, 4:3, 9:16, 16:9） |
| `scale_factor` | string | ❌ | "2" | アップスケール倍率（"2" または "4"） |
| `return_base64` | boolean | ❌ | false | チャット内での画像表示モード |
| `safety_level` | string | ❌ | "BLOCK_MEDIUM_AND_ABOVE" | 安全性フィルターレベル |
| `person_generation` | string | ❌ | "DONT_ALLOW" | 人物生成ポリシー |

#### 📝 実際の使用例（Claude Desktopでの会話）

**例1: 高解像度画像を一度で生成**
```
ユーザー: 美しい夕日の風景を生成して、4倍にアップスケーリングしてください

Claude: [generate_and_upscale_imageツールを使用]
→ prompt: "美しい夕日の風景"
→ scale_factor: "4"
→ その他はデフォルト値
```

**例2: ワイド画面で高解像度画像**
```
ユーザー: 宇宙の画像を16:9のワイド画面で生成して、2倍に拡大してチャット内で表示してください

Claude: [generate_and_upscale_imageツールを使用]
→ prompt: "宇宙"
→ aspect_ratio: "16:9"
→ scale_factor: "2"
→ return_base64: true
```

**例3: 完全カスタム設定**
```
ユーザー: ドラゴンの画像を縦長で生成し、4倍にアップスケーリングして "dragon_4k.png" として保存。人物生成は許可しないで、安全性フィルターは高リスクのみブロックしてください。

Claude: [generate_and_upscale_imageツールを使用]
→ prompt: "ドラゴン"
→ output_path: "dragon_4k.png"
→ aspect_ratio: "3:4" (縦長)
→ scale_factor: "4"
→ safety_level: "BLOCK_ONLY_HIGH"
→ person_generation: "DONT_ALLOW"
```

### 4. list_generated_images

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
    "google-imagen": {
      "command": "google-imagen-mcp-server",
      "env": {
        "GOOGLE_API_KEY": "your-api-key",
        "GOOGLE_IMAGEN_MODEL": "imagen-3.0-latest", // 任意でモデルを指定
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
which google-imagen-mcp-server  # macOS/Linux
where google-imagen-mcp-server  # Windows

# 権限で問題がある場合（Windows）
# PowerShellを管理者として実行してインストール
```

#### 🔑 API キーエラー

**エラーメッセージ**: `GOOGLE_API_KEY environment variable is required`

**解決策**:
1. Google Cloud Console でAPIキーが有効か確認
2. **Vertex AI API** が有効化されているか確認（Imagen APIという独立したAPIは存在しません）
3. 設定ファイルでAPIキーが正しく設定されているか確認
4. プロジェクトIDがAPIキーと一致しているか確認

#### 💰 課金設定エラー

**エラーメッセージ**: Billing account related errors

**解決策**:
1. Google Cloud で請求先アカウントが設定されているか確認


#### 🖼️ 画像生成エラー

**原因**: プロンプトが安全性フィルターに引っかかった場合

**解決策**:
1. プロンプトの内容を調整
2. `safety_level` を `BLOCK_ONLY_HIGH` に緩和
3. 具体的で建設的な表現に変更

#### 🔍 アップスケーリングエラー

**原因**: 入力画像ファイルが見つからない、またはファイル形式が非対応

**解決策**:
1. ファイルパスが正しいか確認
2. 対応画像形式（PNG, JPG, JPEG, GIF, WEBP）か確認
3. ファイルのアクセス権限を確認

#### ⚡ 統合処理（generate_and_upscale_image）エラー

**原因**: 画像生成またはアップスケーリング処理のいずれかで失敗

**解決策**:
1. まず `generate_image` 単体でテスト
2. 生成された画像で `upscale_image` 単体でテスト
3. 両方が成功することを確認してから統合処理を実行

#### 🖼️ 直接表示モード（base64）で画像が表示されない

**原因**: MCPクライアントが画像表示に対応していない、または画像サイズが大きすぎる

**解決策**:
1. Claude Desktopを最新バージョンに更新
2. `return_base64: false` にしてファイル保存モードに切り替え
3. 小さめのアスペクト比（1:1）や低いアップスケール倍率（2倍）を試す


#### 📝 ログの確認

**Claude Desktop のログ場所:**
- **macOS**: `~/Library/Logs/Claude/`
- **Windows**: `%APPDATA%\Claude\logs\`

### バージョン確認

```bash
# MCPサーバーのバージョン
google-imagen-mcp-server --version

# Node.js バージョン（v18以上必要）
node --version

# npm バージョン
npm --version
```

## 📖 APIリファレンス

### コマンドライン引数

```bash
# ヘルプ表示
google-imagen-mcp-server --help

# バージョン表示
google-imagen-mcp-server --version
```

### 環境変数

| 変数名 | 必須 | 説明 |
|--------|-----|------|
| `GOOGLE_API_KEY` | ✅ | Google Cloud APIキー |
| `GOOGLE_PROJECT_ID` | ❌ | Google CloudプロジェクトID |
| `GOOGLE_REGION` | ❌ | リージョン (デフォルト: us-central1) |
| `GOOGLE_IMAGEN_MODEL` | ❌ | 使用するImagenモデル名 (デフォルト: `imagen-3.0-generate-002`) |
| `DEBUG` | ❌ | デバッグログの有効化（"1"で有効） |

## 🔒 セキュリティ注意事項

- **APIキーの管理**: APIキーは機密情報です。設定ファイルを他人と共有しないでください
- **定期的なローテーション**: セキュリティのため、APIキーを定期的に更新することを推奨
- **アクセス制限**: Google Cloud Console でAPIキーの使用制限を設定することを推奨
- **不要なキーの削除**: 使用しなくなったAPIキーは速やかに削除してください

## 💰 費用について

Google Imagen は Vertex AI の一部として従量課金制です。詳細な料金については [Vertex AI Pricing](https://cloud.google.com/vertex-ai/pricing) をご確認ください。

**価格例**（2025年7月時点）:
- **Imagen 3 (image generation)**: 約 $0.020 / 画像

**注意**: 料金は変更される可能性があるため、必ず公式サイトをご確認ください。

**無料枠について**:
- **Google Cloud 無料トライアル**: 新規ユーザーは90日間で$300のクレジットを利用可能
- Vertex AI自体には月間の無料枠はありませんが、Google Cloud Consoleの無料枠プログラムが適用される場合があります
- 既にBigQueryやCloud StorageなどのGoogle Cloudサービスを利用している場合は、無料枠を活用してVertex AIをお試しできます
- これは変更になる場合がありますので、Googleサイトで確認してください

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
- [Google Cloud Vertex AI Imagen](https://cloud.google.com/vertex-ai/generative-ai/docs/image/overview)

---

**💡 ヒント**: 画像生成がうまくいかない場合は、プロンプトをより具体的で詳細な内容に変更してみてください。英語のプロンプトの方が高品質な結果が得られる場合があります。

