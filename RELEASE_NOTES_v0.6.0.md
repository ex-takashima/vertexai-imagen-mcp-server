# Release Notes - v0.6.0

## 📅 リリース日
2025-10-12

## 🎯 概要
プロンプトテンプレート機能の保存先デフォルトパスを改善しました。画像ファイルとテンプレートファイルを同じ出力先フォルダ配下で管理できるようになりました。

## ✨ 主な変更

### テンプレートフォルダのデフォルト保存先変更

**変更前（v0.5.3）:**
- デフォルト: `./templates` (プロジェクトのカレントディレクトリ)
- 画像ファイルとテンプレートファイルの保存先が分離

**変更後（v0.6.0）:**
- デフォルト: `[VERTEXAI_IMAGEN_OUTPUT_DIR]/templates`
  - 環境変数 `VERTEXAI_IMAGEN_OUTPUT_DIR` が設定されていればそのパス + `/templates`
  - 未設定なら `~/Downloads/vertexai-imagen-files/templates`
- 画像ファイルとテンプレートファイルを同じフォルダ配下で一元管理

### テンプレートフォルダの優先順位（v0.6.0）

保存・検索時の優先順位：
1. **環境変数**: `VERTEXAI_IMAGEN_TEMPLATES_DIR` が設定されている場合はそのパス
2. **画像出力先フォルダ配下（新デフォルト）**: `[VERTEXAI_IMAGEN_OUTPUT_DIR]/templates`
3. **プロジェクトレベル**: `./templates` (プロジェクトのカレントディレクトリ)
4. **ユーザーレベル**: `~/.vertexai-imagen/templates` (ホームディレクトリ配下)

## 🔄 後方互換性

既存のテンプレートファイルは引き続き動作します：
- プロジェクトレベルの `./templates` も検索対象として維持
- ユーザーレベルの `~/.vertexai-imagen/templates` も検索対象として維持
- 複数のディレクトリにある同名テンプレートは、優先順位に従って最初に見つかったものが使用されます

## 📝 影響を受ける機能

以下のツールがテンプレートフォルダを参照します：
- `save_prompt_template`: テンプレート保存
- `list_prompt_templates`: テンプレート一覧取得
- `get_template_detail`: テンプレート詳細取得
- `generate_from_template`: テンプレートからの画像生成
- `delete_template`: テンプレート削除
- `update_template`: テンプレート更新

## 🔧 マイグレーション方法

### 既存のテンプレートを新しいデフォルトパスに移動する場合

```bash
# プロジェクトレベルのテンプレートを新しいデフォルトパスに移動
mkdir -p ~/Downloads/vertexai-imagen-files/templates
mv ./templates/*.json ~/Downloads/vertexai-imagen-files/templates/
```

### 従来の動作を維持する場合

環境変数 `VERTEXAI_IMAGEN_TEMPLATES_DIR` を設定することで、任意のパスを使用できます：

```json
{
  "mcpServers": {
    "google-imagen": {
      "command": "vertexai-imagen-mcp-server",
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/key.json",
        "VERTEXAI_IMAGEN_TEMPLATES_DIR": "./templates"
      }
    }
  }
}
```

## 🛠️ 技術的詳細

変更されたファイル：
- `src/utils/templateManager.ts`
  - `getTemplateDirectory()`: デフォルトパスを `[VERTEXAI_IMAGEN_OUTPUT_DIR]/templates` に変更
  - `getTemplateFilePath()`: 検索順序を更新
  - `listTemplates()`: 検索順序を更新
  - `getDefaultOutputDirectory()` からの import を追加

## 📚 ドキュメント更新

- `README.md`: 環境変数 `VERTEXAI_IMAGEN_TEMPLATES_DIR` の説明を追加
- 最新アップデート情報を v0.6.0 に更新

## 🎉 メリット

1. **一元管理**: 画像とテンプレートを同じフォルダ配下で管理
2. **直感的**: 画像出力先を変更すると、テンプレートフォルダも自動的に追従
3. **柔軟性**: 環境変数で完全にカスタマイズ可能
4. **後方互換**: 既存のテンプレートは引き続き動作

## 🔗 関連リンク

- [GitHub Repository](https://github.com/ex-takashima/vertexai-imagen-mcp-server)
- [npm Package](https://www.npmjs.com/package/@dondonudonjp/vertexai-imagen-mcp-server)
