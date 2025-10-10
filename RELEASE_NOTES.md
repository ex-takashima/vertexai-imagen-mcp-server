# Release Notes - v0.4.0

**Release Date:** 2025-10-10

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
