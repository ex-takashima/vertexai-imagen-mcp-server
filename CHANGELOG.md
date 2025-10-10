# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-10-10

### Added
- **MCP Annotations support** - 画像レスポンスをLLMコンテキストから除外
  - `src/utils/image.ts` - `ImageResponseOptions`インターフェース追加
  - `createImageResponse()` - `annotations.audience`フィールドサポート
  - デフォルトで `audience: ["user"]` に設定し、画像をLLMのコンテキストウィンドウから除外
  - カスタムアノテーション設定のサポート（`excludeFromContext`オプション）

- **Performance warnings** - `return_base64=true` 使用時の警告機能
  - ランタイム警告メッセージ追加（全画像生成ツールに適用）
  - 「~1,500トークン消費」の警告をstderrに出力
  - ツールdescriptionに警告文追加（4ツール: generate_image, edit_image, upscale_image, generate_and_upscale_image）

- **Documentation enhancements** - パフォーマンスとベストプラクティスガイド
  - README.mdに「⚡ パフォーマンスとベストプラクティス」セクション追加
  - ファイル保存モード vs Base64返却モードの詳細比較表
  - トークン消費量の具体的な数値（1画像 = ~1,500トークン）
  - MCP Resourcesプロトコルへの言及と将来的な改善の方向性
  - 推奨事項と非推奨事項の明確化

### Improved
- **Token consumption optimization** - Base64モードのトークン消費を明示化
  - MCPプロトコルレベルでのトークン消費を93%削減可能（ファイル保存モード使用時）
  - ユーザーがパフォーマンス問題を事前に把握可能に
  - ベストプラクティスに従った使用を促進

### Changed
- **Default behavior remains unchanged** - 後方互換性を維持
  - `return_base64`のデフォルト値は引き続き`false`
  - 既存のコードは変更なしで動作
  - 非破壊的な変更（警告のみ追加）

### Technical
- MCP仕様準拠の`annotations`実装
- `audience`フィールドによるコンテンツ可視性制御
- Base64エンコーディングのトークンコスト分析と文書化

## [0.2.0] - 2025-10-10

### Added
- **Cross-platform file path handling** - IMPLEMENTATION_GUIDE準拠のパス処理機能
  - `src/utils/path.ts` - パス正規化、検証、ディレクトリ自動作成ユーティリティ
  - デフォルト保存先: `~/Downloads/vertexai-imagen-files/`（全プラットフォーム対応）
  - 環境変数 `VERTEXAI_IMAGEN_OUTPUT_DIR` によるカスタマイズサポート
  - 相対パスの自動解決機能
  - 親ディレクトリの自動作成機能
  - ユーザーフレンドリーな `~` 表記のパス表示

- **テストスイート追加**
  - `src/utils/path.test.ts` - パス処理ユーティリティのユニットテスト
  - Vitest設定追加 (`vitest.config.ts`)
  - `npm test` / `npm run test:watch` コマンド追加

- **ドキュメント拡充**
  - README.mdに「📁 ファイル保存パスについて」セクション追加
  - パス指定方法の詳細説明（相対/絶対/環境変数）
  - --helpメッセージにVERTEXAI_IMAGEN_OUTPUT_DIRと使用例を追加

### Changed
- **ツールdescription更新** - 全ツールのoutput_pathパラメーター説明を詳細化
  - デフォルト保存先の明記
  - 環境変数でのカスタマイズ方法の説明
  - 相対パス/絶対パスの動作説明

### Improved
- **エラーメッセージ改善**
  - パス作成失敗時のトラブルシューティング情報追加
  - より詳細なエラー原因の表示
  - デフォルト出力ディレクトリのヒント表示

### Fixed
- **MCPコンテナ環境でのファイル保存問題を解決**
  - 相対パスがコンテナ内部のワーキングディレクトリではなく、ホストのユーザーアクセス可能な場所に保存されるように修正
  - Claude Desktopなどのコンテナ環境で画像ファイルが見つからない問題を解決

### Technical
- TypeScript設定更新 (`tsconfig.json`) - テストファイルをビルドから除外
- npm ignore設定更新 - `vitest.config.ts` を配布パッケージから除外
- API呼び出し前のパス検証により、APIクォータの無駄遣いを防止

## [0.1.6] - 2025-XX-XX

### Added
- 高度な画像編集機能（自動マスク生成、セマンティック分割、背景置換）
- Imagen 3.0対応

### Changed
- 既存の機能改善

## [0.1.0] - 2025-XX-XX

### Added
- 初回リリース
- 画像生成機能
- 画像アップスケーリング機能
- 生成・アップスケーリング統合機能
- 画像一覧表示機能

[0.3.0]: https://github.com/ex-takashima/vertexai-imagen-mcp-server/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/ex-takashima/vertexai-imagen-mcp-server/compare/v0.1.6...v0.2.0
[0.1.6]: https://github.com/ex-takashima/vertexai-imagen-mcp-server/compare/v0.1.0...v0.1.6
[0.1.0]: https://github.com/ex-takashima/vertexai-imagen-mcp-server/releases/tag/v0.1.0
