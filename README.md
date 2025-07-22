# Google Imagen MCP Server

Google Imagen API を使用して画像を生成できる MCP（Model Context Protocol）対応サーバーです。Claude Desktop などの MCP クライアントと連携することで、チャット内から自然言語で画像生成が行えます。

---

## 🌟 主な機能

- 🎨 **画像生成**：テキストから高品質な画像を生成  
- 📐 **アスペクト比の指定**：1:1, 3:4, 4:3, 9:16, 16:9 に対応  
- 🔍 **アップスケーリング**：画像を 2 倍または 4 倍に高品質拡大  
- ⚡ **統合処理**：生成と拡大を一括実行  
- 🖼️ **直接表示モード**：チャット内に base64 表示  
- 🛡️ **安全性フィルター**：安全レベルを柔軟に制御  
- 👤 **人物生成制御**：人物の生成有無を細かく設定  
- 📁 **画像管理**：生成済み画像の一覧表示・操作  
- 🔧 **デバッグモード**：ログ出力によるトラブルシュート支援

---

## 📋 前提条件

- **Node.js** v18 以上  
- **MCP 対応クライアント**（例：Claude Desktop、Claude Code）

---

## 🚀 セットアップ手順

### 1. Google Cloud サービスアカウントの作成

#### 手順概要

1. [Google Cloud Console](https://console.cloud.google.com/) へアクセス  
2. プロジェクトを作成または選択  
3. 「APIとサービス」→「ライブラリ」で `Vertex AI API` を有効化  
4. 「IAMと管理」→「サービスアカウント」→「サービスアカウントを作成」  
5. 名前（例：`imagen-mcp-server`）を入力  
6. ロールは「**Vertex AI ユーザー**」を選択し作成  
7. 作成後、「キー」タブから「新しいキーを作成」→「JSON」形式を選びダウンロード

> 🔐 **注意**：ダウンロードしたキーは厳重に保管してください。バージョン管理対象外にすることを推奨します。

---

### 2. プロジェクトのセットアップ

```bash
git clone https://github.com/ex-takashima/google-imagen-mcp-server.git
cd google-imagen-mcp-server

npm install      # 依存関係のインストール
npm run build    # TypeScript のコンパイル
````

---

### 3. サービスアカウントキーの配置

```bash
# プロジェクト直下に配置する例
cp /path/to/key.json ./google-service-account.json

# config ディレクトリへ配置する例
mkdir -p ~/.config/google-cloud/
cp /path/to/key.json ~/.config/google-cloud/imagen-service-account.json

# アクセス制限（UNIX環境推奨）
chmod 600 ./google-service-account.json
```

---

### 4. インストール方法

#### A. 開発リンク（npm link）

```bash
npm link
google-imagen-mcp-server --version
```

#### B. ローカルパッケージとしてインストール（推奨）

```bash
npm pack
npm install -g ./google-imagen-mcp-server-*.tgz
```

#### C. Claude Desktop に直接パスを指定

```json
{
  "mcpServers": {
    "google-imagen": {
      "command": "node",
      "args": ["C:\\projects\\google-imagen-mcp-server\\build\\index.js"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "C:\\path\\to\\your\\key.json"
      }
    }
  }
}
```

---

## ⚙ Claude Desktop の設定

### 推奨設定（ファイルパスを指定）

```json
{
  "mcpServers": {
    "google-imagen": {
      "command": "google-imagen-mcp-server",
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/google-service-account.json"
      }
    }
  }
}
```

> Windows環境ではパス区切りに注意：
> `"C:\\Users\\User\\Documents\\key.json"`

---

### Claude Desktop の再起動

設定ファイルを保存後、Claude Desktop を**完全に再起動**してください（タスクトレイからも終了推奨）。

---
### Claude Code での使用方法

[Claude Code](https://claude.ai/code) でも同様にMCPサーバーとして使用できます。

#### 設定方法

Claude Code の設定ファイルに以下を追加してください：

```json
{
  "mcpServers": {
    "google-imagen": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "google-imagen-mcp-server"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "C:\\path\\to\\your\\google-service-account.json"
      }
    }
  }
}
```

**macOS/Linux の場合:**
```json
{
  "mcpServers": {
    "google-imagen": {
      "command": "npx",
      "args": ["-y", "google-imagen-mcp-server"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/your/google-service-account.json"
      }
    }
  }
}
```

## 💬 使用方法の例（チャット内での自然言語）

### 画像生成

```
美しい夕日の風景を生成してください
```

### アスペクト比指定

```
16:9 のワイド画面で、山の風景を生成
```

### アップスケーリング

```
"cat.jpg" を4倍に拡大してください
```

### 統合処理（生成 + 拡大）

```
宇宙の画像を縦長で生成し、2倍に拡大して表示してください
```
## 🧪 使用例（Claude Code 指示文）
以下は、Claude Code で Google Imagen MCP サーバーを使用して画像を生成・保存するための自然言語プロンプトの例です。  
保存先は `<<PROJECT_FOLDER>>\docs\images\` を想定しています。


### 🏞️ 例1：美しい夕日の風景

```text
「美しい夕日の風景」をテーマに画像を生成し、横長の 16:9 比率でお願いします。
人物は含めず、安全性フィルターは標準（中リスク以上をブロック）で。
保存ファイル名は sunset_landscape.png としてください。
```

![例1](./docs/images/sunset_landscape.png)
---
### 🐱 例2：宇宙服を着た猫のイラスト

```text
宇宙服を着て星空を漂っている可愛い猫のイラストを生成してください。
正方形（1:1）の比率で、人物生成は許可せず、安全性フィルターは高リスクのみブロックでお願いします。
保存先ファイルは space_cat.png にしてください。
```
![例2](./docs/images/space_cat.png)
***注意:意図しない画像の生成や、プロンプトの内容によっては安全性フィルターにより画像生成に失敗することがあります。***

---
### 🐱 例2：宇宙服を着た猫のイラスト　（英語プロンプト）

```text
宇宙服を着て星空を漂っている可愛い猫のイラストを生成してください。
正方形（1:1）の比率で、人物生成は許可せず、安全性フィルターは高リスクのみブロックでお願いします。
保存先ファイルは space_cat.png にしてください。
```

![例2](./docs/images/space_cat_english.png)

---
### 🐲 例3：ドラゴンの高解像度画像（生成＋4倍拡大）

```text
ドラゴンのかっこいいイラストを生成し、16:9 の横長比率でお願いします。
人物は含めず、安全性フィルターは標準。
4 倍にアップスケーリング、プロンプトは英語でお願いします。dragon_4x.png に保存してください。
```
![例3](./docs/images/dragon_4x.png)

---
### 🌸 例4：桜の木の画像（base64 表示）

```text
美しい桜の木の画像を生成し、チャット内で直接表示してください（base64表示）。
正方形で、人物は含めず、安全性フィルターは通常でお願いします。
ファイル保存は不要です。
```
  ***データ量が多いなどの理由でエラーの発生する場合があります***

---

---
## ⚠️ 日本語プロンプトに関する注意（Claude Code検証結果）

Google Imagen API を日本語で使用する際、意図しない画像の生成や、**プロンプトの内容によっては安全性フィルターにより画像生成に失敗することがあります**。

### 🔍 検証結果の概要

以下のような日本語プロンプト：

```json
prompt: "宇宙服を着た白い猫、透明なヘルメット、星空を背景に浮遊、キラキラした宇宙空間"
output_path: "<<project_folder>>\\docs\\images\\space_cat_detailed.png"
safety_level: "BLOCK_ONLY_HIGH"
```

→ **MCPエラー `No images were generated` が発生**

同じ内容を英語に翻訳：

```json
prompt: "Cute cat in white spacesuit floating in starry space, transparent helmet, fluffy fur, big eyes, surrounded by twinkling stars and galaxy, fantasy atmosphere, digital art"
output_path: "<<project_folder>>\\docs\\images\\space_cat_english.png"
```

→ ✅ 画像生成に成功！

---

### 💡 回避策

* 詳細なプロンプトを使う場合は **英語で記述することを推奨**
* シンプルな日本語プロンプト（「猫の画像を生成してください」など）は通常問題なし
* `safety_level` を緩めても効果がないケースがあります

---

### ✅ まとめ

| 言語  | 簡単なプロンプト | 詳細なプロンプト    |
| --- | -------- | ----------- |
| 日本語 | ✅ 成功する   | ⚠️ 失敗する場合あり |
| 英語  | ✅ 成功する   | ✅ 安定して成功する  |

---

## 🛠 利用可能な MCP ツール

### 1. `generate_image`

テキストから画像を生成します。

* `prompt`（必須）: テキストプロンプト
* `output_path`: 保存ファイル名（省略可）
* `aspect_ratio`: 画像比率（例: 1:1, 16:9）
* `return_base64`: チャット内表示モード
* `safety_level`: 安全性フィルター（BLOCK\_NONE〜BLOCK\_LOW\_AND\_ABOVE）
* `person_generation`: 人物生成ポリシー（DONT\_ALLOW, ALLOW\_ADULT, ALLOW\_ALL）

---

### 2. `upscale_image`

画像を 2 倍 / 4 倍にアップスケールします。

* `input_path`（必須）: 入力ファイルパス
* `scale_factor`: 倍率（デフォルト: 2）
* `output_path`: 保存ファイル名（省略可）
* `return_base64`: チャット内表示 ***※クライアントによっては利用できません***

---

### 3. `generate_and_upscale_image`

画像生成とアップスケーリングを一括で行います。
`generate_image` と `upscale_image` の統合処理です。

---

### 4. `list_generated_images`

ディレクトリ内の画像ファイルを一覧表示します。

* `directory`: 検索対象フォルダ（省略時はカレントディレクトリ）

---

## 🧪 開発・テスト

```bash
npm run dev         # 開発モード
DEBUG=1 npm run dev # デバッグモード（詳細ログあり）
```

---

## 🐞 トラブルシューティング

| 症状            | 解決策                                           |
| ------------- | --------------------------------------------- |
| サーバーが起動しない    | パスや Node.js バージョン、サービスアカウント権限を確認              |
| 認証エラー         | `GOOGLE_APPLICATION_CREDENTIALS` のパスとロール設定を確認 |
| 画像生成失敗        | プロンプトをより具体的にするか、`safety_level` を緩和            |
| アップスケーリング失敗   | 入力ファイルの存在と画像形式（PNG, JPG など）を確認                |
| base64 表示されない | Claude が対応していない、または画像が大きすぎる可能性あり              |

---

## 📖 コマンドラインと環境変数

```bash
google-imagen-mcp-server --help
google-imagen-mcp-server --version
```

| 変数名                              | 必須 | 説明                          |
| -------------------------------- | -- | --------------------------- |
| `GOOGLE_APPLICATION_CREDENTIALS` | ✅  | サービスアカウントJSONの絶対パス          |
| `GOOGLE_SERVICE_ACCOUNT_KEY`     | ✅  | JSON文字列として直接渡す（代替手段）        |
| `GOOGLE_PROJECT_ID`              | ❌  | プロジェクトID（通常は自動取得）           |
| `GOOGLE_REGION`                  | ❌  | 利用リージョン（例: asia-northeast1） |
| `DEBUG`                          | ❌  | "1" を指定するとデバッグログ有効          |

---

## 🔒 セキュリティ上の注意点

* サービスアカウントキーは `.gitignore` に追加し、公開しないでください
* 最小権限の原則に従い、`Vertex AI ユーザー` 権限のみを付与
* 不要なキーは即削除し、必要に応じて定期的にローテーションしてください

---

## 💰 料金について

Google Imagen は Vertex AI の Generative AI モデルの一部として提供されており、**従量課金制**です。

- 最新の価格は以下を参照してください：  
  [https://cloud.google.com/vertex-ai/generative-ai/pricing?hl=ja](https://cloud.google.com/vertex-ai/generative-ai/pricing?hl=ja)

- 価格例（2025年7月時点、変更される可能性あり）:
  - Imagen 3（画像生成）: 約 **$0.040 / 画像**
  - アップスケーリング処理も別途課金対象となる場合があります

### 無料枠について

- **Google Cloud 無料トライアル**：新規アカウントに $300 クレジット（90日間）付与
- Vertex AI 自体には常設の無料枠はありませんが、クレジット消費によって Imagen の試用が可能です

> ⚠️ 実際の料金やリージョンごとの価格変動、課金単位などは必ず公式サイトでご確認ください。


## 🤝 コントリビューション歓迎

1. リポジトリをフォーク
2. ブランチを作成（例: `feature/add-func`）
3. 変更をコミット・プッシュ
4. プルリクエストを送信

---

## 📄 ライセンス

MIT License（詳細は `LICENSE` ファイルを参照）

---

## 🙏 謝辞

* [Model Context Protocol](https://modelcontextprotocol.io/)
* [Google Cloud Vertex AI Imagen](https://cloud.google.com/vertex-ai/generative-ai/docs/image/overview)


