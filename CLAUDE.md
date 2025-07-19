# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 開発コマンド

### ビルドとテスト
```bash
# TypeScriptコンパイル
npm run build

# 開発モードで実行
npm run dev

# 本番モードで実行（ビルド後）
npm run start

# パッケージビルド前の処理
npm run prepublishOnly

# デバッグモードで実行
DEBUG=1 npm run dev
```

### パッケージング
```bash
# 配布用パッケージ作成
npm pack

# ローカルインストール（テスト用）
npm link
```

## アーキテクチャ概要

このプロジェクトは、Google ImagenのAPIを使用してAI画像生成を行うMCP（Model Context Protocol）サーバーです。

### 主要コンポーネント

- **MCPサーバー**: `@modelcontextprotocol/sdk`を使用してClaude DesktopなどのMCPクライアントとの通信を処理
- **Google Imagen API連携**: Vertex AI経由でGoogle Imagen API呼び出しを実行
- **ファイル管理**: 生成した画像ファイルの保存・一覧表示機能

### ファイル構造

```
src/
  index.ts          # メインサーバーロジック（MCPサーバー、API呼び出し、ツール実装）
build/              # TypeScriptコンパイル出力
package.json        # NPMパッケージ設定（scripts、dependencies）
tsconfig.json       # TypeScript設定
README.md           # 詳細なドキュメントと使用方法（日本語）
```

### APIツール

1. **generate_image**: テキストプロンプトから画像生成
   - パラメーター: prompt, output_path, safety_level, person_generation
   - Google Imagen API（Vertex AI経由）呼び出し
   - Base64デコードしてファイル保存

2. **list_generated_images**: 指定ディレクトリの画像ファイル一覧
   - パラメーター: directory
   - 対応形式: .png, .jpg, .jpeg, .gif, .webp

### 環境変数設定

必須:
- `GOOGLE_API_KEY`: Google Cloud APIキー（Vertex AI API有効化必要）

オプション:
- `GOOGLE_PROJECT_ID`: Google CloudプロジェクトID
- `GOOGLE_REGION`: リージョン（デフォルト: us-central1）
- `GOOGLE_IMAGEN_MODEL`: 使用モデル（デフォルト: imagen-3.0-generate-001）
- `DEBUG`: デバッグログ有効化

### エラーハンドリング

- API認証エラー（401/403）: APIキー確認
- パラメーターエラー（400）: リクエスト内容確認
- サーバーエラー（500+）: Google側の問題
- 安全性フィルター: プロンプト内容の調整が必要

### セキュリティ考慮事項

- APIキーは環境変数で管理
- 安全性フィルターでコンテンツ制御
- 人物生成ポリシーの設定可能
- デバッグ情報は stderr に出力（本番では無効化）