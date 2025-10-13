# Release Notes

## v0.6.1 (2025-10-13)

### ✨ 新機能

#### customize_image_from_yaml_inline ツールの追加
- **追加**: YAMLファイルの代わりに、YAML内容を文字列として直接チャットに貼り付けて画像カスタマイズを実行できる新ツール `customize_image_from_yaml_inline` を追加
  - **用途**: ファイル不要で、YAMLをチャット内で直接編集・実行可能
  - **メリット**:
    - ✅ YAMLファイルを作成せずに直接実行
    - ✅ チャット内で設定をその場で調整可能
    - ✅ YAML内容をコピー&ペーストで共有しやすい
    - ✅ テスト実行や一時的な設定に最適
  - **パラメータ**: `yaml_content` (YAML設定内容の文字列)
  - **構造**: `customize_image_from_yaml` と同じYAML構造をサポート

#### YAML解析機能の拡張
- **追加**: `parseYamlString()` 関数 - YAML文字列を直接パース
- **追加**: `parseYamlStringToCustomizeArgs()` 関数 - YAML文字列から CustomizeImageArgs を生成
- **リファクタリング**: `loadYamlConfig()` が `parseYamlString()` を使用するように改善し、コードの重複を削減

### 🐛 バグ修正

#### 入力画像パスへの誤った自動連番付加を修正
- **修正**: `yamlParser.ts` で入力画像パス（subject/control/style）に対して、誤って自動連番機能（`_1`, `_2`）が適用されていた問題を修正
  - **根本原因**: `normalizeAndValidatePath()` 関数のデフォルトパラメータ `autoNumbering: true` が、出力パス用の設定だったが、入力パス（読み取り専用）にも適用されていた
  - **影響**: 既存ファイルを読み込む際に、ファイル名が変更され「ファイルが見つからない」エラーが発生
  - **解決策**: 入力パス処理時に明示的に `autoNumbering: false` を指定
  - **修正箇所**:
    - Subject images のパス解決（行 274）
    - Control image のパス解決（行 296）
    - Style image のパス解決（行 308）

### 📝 ドキュメント更新
- **追加**: README.md にインラインYAMLツールのドキュメントを追加（セクション 4-2）
- **追加**: ファイルパス版とインライン版の使い分け比較表
- **追加**: 使用例とメリット・注意事項の説明

### 影響を受けるツール
- `customize_image_from_yaml` - バグ修正により、入力画像パスが正しく解決されるようになりました
- `customize_image_from_yaml_inline` - 新規追加

### 技術詳細

#### 変更されたファイル
- `src/types/yamlConfig.ts` - `CustomizeImageFromYamlInlineArgs` インターフェース追加
- `src/utils/yamlParser.ts` - YAML文字列パース機能追加、autoNumbering バグ修正
- `src/tools/customizeImageFromYamlInline.ts` - 新規ツール実装
- `src/index.ts` - 新ツールの統合（ツール定義、スイッチケース、プライベートメソッド）
- `README.md` - インラインYAMLツールのドキュメント追加

### 破壊的変更
なし

### 移行ガイド
変更は完全に後方互換性を保っています。既存のコードは変更なしで動作します。バグ修正により、YAML設定での入力画像パス指定がより確実に動作するようになりました。

---

## v0.5.3 (2025-10-12)

### 🐛 重要なバグ修正

#### generate_and_upscale_image ツールの URI パス不一致の修正
- **修正**: アップスケール後の画像URIとファイルパスの不一致によるサムネイル生成失敗を解決
  - **根本原因**: `normalizeAndValidatePath()` が2回呼び出され、自動連番機能により異なるファイル名が生成されていました
    - 1回目: `upscaleImage()` 内で呼び出され、実際のファイルが保存される
    - 2回目: 戻り値のURIからパスを解決する際に再度呼び出され、異なるパス（例: `_1` サフィックス付き）が生成される
  - **影響**: サムネイル生成時に実際のファイルが見つからず失敗
  - **解決策**: `upscaleResult.content` から実際のfile:// URIを抽出し、`ResourceManager.resolveUri()` で正しいパスを取得
  - **実装詳細**:
    - TypeScript型ガードを使用してresource要素を安全に抽出
    - `McpError` 例外処理を追加
    - URI解決失敗時に明確なエラーメッセージを提供

#### 一時ファイル削除の失敗を修正
- **修正**: `generateAndUpscaleImage` 処理後の一時ファイル削除が確実に実行されるように改善
  - **根本原因1**: 相対パスを使用していたが、実際のファイルは絶対パスで保存されていた
  - **根本原因2**: `catch` ブロックで `Date.now()` を再計算していたため、異なるファイル名が生成されていた
  - **解決策**:
    - タイムスタンプを事前に変数として保存（`tempImageTimestamp`）
    - 絶対パスを事前に生成（`tempImageAbsPath`）
    - 成功時とエラー時の両方で同じパスを使用して削除

### 影響を受けるツール
- `generate_and_upscale_image` - URI パス解決とサムネイル生成の修正、一時ファイル管理の改善

### 技術詳細

#### 変更されたファイル
- `src/index.ts` (`generateAndUpscaleImage` メソッド, 行 1185-1322)
  - 一時ファイルパスの事前計算（行 1210-1212）
  - アップスケール結果からのURI抽出とパス解決（行 1262-1290）
  - 一時ファイル削除の確実な実行（行 1242, 1315）

#### コード品質向上
- TypeScript型ガードによる型安全性の向上
- エラーハンドリングの強化（`McpError` 対応）
- ファイルライフサイクル管理の改善

### 破壊的変更
なし

### 移行ガイド
変更は完全に内部実装のみで、後方互換性を保っています。既存のコードは変更なしで動作します。

---

## v0.5.2 (2025-10-11)

### 🔧 内部改善
- デバッグログの最適化と非推奨警告の合理化

---

## v0.5.1 (2025-10-11)

### 🐛 バグ修正

#### サムネイル生成ロジックの改善
- **修正**: `include_thumbnail: true` を指定した場合、環境変数の設定に関わらずサムネイルが生成されるように修正
  - 以前は `VERTEXAI_IMAGEN_THUMBNAIL='true'` 環境変数が設定されていないと、`include_thumbnail: true` を指定してもサムネイルが生成されませんでした
  - 各ツールで既に環境変数を考慮した値が `include_thumbnail` に設定されるため、この値をそのまま使用するように変更
- **改善**: サムネイルフォーマット処理を改善
  - `ThumbnailConfig` の `format` パラメータ（jpeg/png/webp）が正しく適用されるように修正
  - 以前は設定に関わらず常にJPEG形式で出力されていました

#### customize_image ツールのバリデーション強化
- **追加**: 3つの参照画像タイプ（control + subject + style）を非正方形アスペクト比で使用した際のバリデーションを追加
  - API制限: 非正方形アスペクト比（3:4, 4:3, 9:16, 16:9）では最大2つの参照画像タイプのみサポート
  - 正方形アスペクト比（1:1）では3つの参照画像タイプをサポート
  - API呼び出し前に検出し、明確なエラーメッセージと解決策を提示

### 影響を受けるツール
- `generate_image` - サムネイル生成改善
- `edit_image` - サムネイル生成改善
- `upscale_image` - サムネイル生成改善
- `generate_and_upscale_image` - サムネイル生成改善
- `customize_image` - バリデーション強化、サムネイル生成改善

### 破壊的変更
なし

### 移行ガイド
変更は後方互換性を保っています。既存のコードは変更なしで動作します。

---

## v0.5.0 (2025-10-11)

### 🐛 重要なバグ修正

#### customize_image ツールのエンドポイント修正
- **修正**: `customize_image` が正しいAPIエンドポイント（`imagen-3.0-capability-001`）を使用するように修正
  - 以前は生成モデルエンドポイント（`imagen-3.0-generate-002`）を使用していたため、「Image editing failed」エラーが発生していました
  - 参照画像（control/subject/style）は生成エンドポイントではなく、編集/機能エンドポイントが必要です
- **変更**: `customize_image` のデフォルトモデルを `imagen-3.0-generate-002` から `imagen-3.0-capability-001` に変更
- **更新**: モデル選択肢を編集モデルのバリアントに変更：
  - `imagen-3.0-capability-001` (デフォルト)
  - `imagegeneration@006`
  - `imagegeneration@005`
  - `imagegeneration@002`

### 📝 ドキュメント更新
- 画像返却ポリシーのドキュメント更新
- インペインティング削除のドキュメント強化
- Resource APIの概要を改善
- サンプル画像を使用した包括的な使用例を追加

### 🔧 内部改善
- セマンティッククラス検索機能の強化
- サムネイル生成ユーティリティの改善
- 参照画像処理のための広範なデバッグログを追加

### 破壊的変更
なし

### 移行ガイド
`customize_image` 呼び出しで `model` パラメータを明示的に指定していた場合でも、変更は不要です。ツールはデフォルトで正しい編集エンドポイントを使用するようになり、コントロール画像、被写体の一貫性、スタイル転送機能の問題が修正されました。

### 既知の問題
なし

---

## v0.4.0 (2025-10-10)

## 🎉 What's New

### MCP Resources API サポート

画像配信の効率化を実現するMCP Resources APIに対応しました。これにより、従来のBase64エンコーディング方式と比較して、**画像1枚あたり約1,500トークンの消費を削減**できます。

- ✅ `resources/list` - 生成された画像一覧の取得
- ✅ `resources/read` - `file://` URIを使った画像データの取得
- ✅ すべての画像生成ツールが `file://` URIを返却

### 自動ファイル名管理

既存ファイルを保護するため、ファイル名重複時に自動的に連番を付加する機能を追加しました。

**動作例：**
```bash
# 1回目の生成
画像を "landscape.png" として保存

# 2回目の生成（同じファイル名を指定）
→ 自動的に "landscape_1.png" として保存

# 3回目の生成
→ 自動的に "landscape_2.png" として保存
```

この機能により、誤って既存の画像を上書きしてしまうリスクを回避できます。

## 🔄 変更点

### デフォルト動作の強化

ファイル保存モード（デフォルト）が強化され、以下の情報が返されるようになりました：

- 📎 `file://` URI（MCP Resources API経由でアクセス可能）
- 📁 ファイルパス（従来通り）
- 📊 ファイルサイズとMIMEタイプ

**後方互換性は完全に維持されています** - 既存のコードは変更なしで動作します。

### トークン消費の最適化

| モード | トークン消費 | 推奨度 |
|--------|-------------|--------|
| **ファイル保存 + Resources API** | 最小 | ✅ **推奨** |
| Base64返却（`return_base64=true`） | ~1,500トークン/画像 | ⚠️ **非推奨** |

## ⚠️ 非推奨化

### `return_base64` パラメータ

`return_base64=true` オプションは**非推奨**となり、**v1.0.0で削除予定**です。

**現在の動作：**
- ✅ 引き続き使用可能（v1.0.0まで）
- ⚠️ 使用時に警告メッセージを表示
- 📊 ツール説明に非推奨の旨を明記

**推奨される移行方法：**
```bash
# ❌ 非推奨（v1.0.0で削除予定）
{
  "prompt": "beautiful landscape",
  "return_base64": true  # ← この指定を削除
}

# ✅ 推奨（デフォルト動作）
{
  "prompt": "beautiful landscape"
  # return_base64を指定しない = ファイル保存 + file:// URI返却
}
```

## 🔒 セキュリティ

### パストラバーサル攻撃への保護

新しい `ImageResourceManager` クラスにより、以下のセキュリティ対策が実装されました：

- ✅ 出力ディレクトリ外へのアクセス防止
- ✅ パスの正規化と検証
- ✅ サンドボックス化されたリソースアクセス

## 📋 移行ガイド

### ユーザー向け

**アクション不要** - デフォルト動作は後方互換性を保っています。ただし、今後は `file://` URIが追加で返されるようになり、MCPクライアントとの統合がより良好になります。

#### `return_base64=true` を使用している場合

1. `return_base64=true` パラメータを削除
2. 画像はディスクに保存され、`file://` URI経由で返却されます
3. 必要に応じてMCP Resources APIで画像にアクセス

### 開発者向け

#### 生成された画像へのアクセス

```typescript
// 1. 画像一覧の取得
const resources = await server.resources.list();

// 2. file:// URI を使って画像データを取得
const imageData = await server.resources.read(uri);

// URIはツールレスポンスに自動的に含まれます
```

#### メリット

- ✅ 画像1枚あたり約1,500トークン削減（Base64モード比）
- ✅ 大容量画像（4K、8Kアップスケール）の安定した処理
- ✅ MCP仕様への準拠向上
- ✅ 将来的な機能拡張の基盤（ストリーミング、署名付きURLなど）

## 🛠️ 技術的な詳細

### 新規追加ファイル

- `src/utils/resources.ts` - `ImageResourceManager` クラス（リソースライフサイクル管理）

### 更新されたファイル

- `src/index.ts` - Resources APIハンドラー追加
- `src/utils/image.ts` - `createUriImageResponse()` 関数追加
- `src/utils/path.ts` - `generateUniqueFilePath()` 関数追加

### 対応ツール

以下の4つのツールすべてが `file://` URIを返却するようになりました：

1. `generate_image`
2. `edit_image`
3. `upscale_image`
4. `generate_and_upscale_image`

## 📚 関連ドキュメント

- [README.md](./README.md) - プロジェクト概要と使用方法
- [CHANGELOG.md](./CHANGELOG.md) - 詳細な変更履歴
- [IMAGE_RETURN_POLICY.md](./docs/IMAGE_RETURN_POLICY.md) - 画像返却ポリシー
- [RESOURCE_API_OVERVIEW.md](./docs/RESOURCE_API_OVERVIEW.md) - Resources API技術概要

## 🙏 フィードバック

問題や提案がありましたら、[GitHub Issues](https://github.com/ex-takashima/vertexai-imagen-mcp-server/issues) までお寄せください。

---

**Full Changelog**: [v0.3.0...v0.4.0](https://github.com/ex-takashima/vertexai-imagen-mcp-server/compare/v0.3.0...v0.4.0)
