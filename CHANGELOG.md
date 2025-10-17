# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.0] - 2025-10-17

### Added

#### 🛡️ Runtime Validation with Zod
- **Comprehensive input validation** for all 24 tools
  - `src/validation/schemas.ts` - Zod schemas for every tool parameter
  - `src/utils/error.ts` - Validation helper utilities (`validateWithZod`, `formatZodError`)
  - Business logic validation (e.g., 2K resolution only for specific models)
  - Clear, user-friendly error messages with exact parameter issues
  - Automatic conversion to MCP error format

#### 🚦 API Rate Limiting
- **Sliding window rate limiter** to prevent quota exhaustion
  - `src/utils/rateLimiter.ts` - `RateLimiter` class with configurable limits
  - Applied to all Vertex AI API calls (generate, edit, customize, upscale)
  - Environment variables for configuration:
    - `VERTEXAI_RATE_LIMIT_MAX_CALLS` (default: 60 calls)
    - `VERTEXAI_RATE_LIMIT_WINDOW_MS` (default: 60000ms / 1 minute)
  - Automatic waiting when rate limit reached
  - Debug logging for rate limit events

#### ✅ Environment Variable Validation
- **Startup validation** of all configuration
  - `src/utils/envValidation.ts` - Zod-based environment validation
  - Validates all 20 environment variables with business rules
  - Helpful error messages with configuration examples
  - Checks authentication method availability
  - Validates numeric ranges (thumbnail size, quality, job limits, etc.)
  - JSON format validation for service account keys

#### 🔐 Enhanced Authentication Support
- **GOOGLE_APPLICATION_CREDENTIALS** authentication method
  - Standard Google Cloud authentication via service account file
  - Full support in environment variable validation
  - Documentation and examples added
  - Works alongside existing API Key and Service Account JSON methods

#### 📚 Documentation Enhancements
- **ENVIRONMENT_VARIABLES.md** - Complete reference for all 20 environment variables
  - Detailed descriptions with use cases
  - Configuration examples for each variable
  - Validation rules and constraints
  - Troubleshooting guidance
  - Platform-specific examples (Windows/macOS)

- **QUICK_START.md** - 5-minute setup guide
  - Step-by-step instructions for Claude Desktop
  - Three authentication method examples
  - Common error solutions
  - First image generation tutorial
  - Platform-specific paths and commands

### Improved

#### 🔍 Error Messages
- **Enhanced error reporting** with actionable guidance
  - Environment variable errors show exact configuration examples
  - Claude Desktop setup instructions in error messages
  - Platform-specific troubleshooting (Windows/macOS)
  - Links to documentation for further help

#### 🔒 Input Validation
- **Type-safe parameter validation** at runtime
  - Prevents invalid API requests before making expensive calls
  - Reduces wasted API quota from malformed requests
  - Catches configuration errors early
  - Better user experience with immediate feedback

#### 📊 Debug Logging
- **Enhanced debug information** when `DEBUG` enabled
  - Authentication method detection
  - Credentials file path logging
  - Rate limiter initialization status
  - Environment validation results
  - API call timing and quotas

### Changed

#### 🏗️ Dependencies
- **Added**: `zod` ^4.1.12 (MIT License) - Runtime schema validation
  - Compatible with existing MIT project license
  - No breaking changes to public API

#### 🎯 Startup Behavior
- **Environment validation runs at startup** (non-breaking)
  - Server fails fast with clear errors if misconfigured
  - Prevents runtime failures from missing configuration
  - Existing valid configurations continue to work

### Fixed

- **GOOGLE_APPLICATION_CREDENTIALS** not recognized in environment validation
  - Was causing false errors for valid service account file authentication
  - Now properly validated as an authentication method
  - Error messages updated to include this method

### Security

- **Input validation** prevents malformed API requests
- **Path validation** for service account credential files
- **JSON validation** for service account keys
- **Range validation** for all numeric parameters

### Technical

- **Zod v4.1.12** - Schema validation library
  - Runtime type checking for all tool parameters
  - Business logic validation with `.refine()`
  - Type-safe validation with TypeScript integration

- **Rate Limiter Architecture**
  - Sliding window algorithm
  - In-memory call tracking
  - Automatic cleanup of old timestamps
  - Promise-based API with async/await

- **Environment Validation Architecture**
  - Comprehensive Zod schema for all 20 variables
  - Multi-level validation (format, range, business rules)
  - Cross-variable dependency validation
  - Platform-aware error messages

### Migration

**No Breaking Changes** - All existing functionality preserved:
- Existing environment variables work without modification
- All authentication methods continue to function
- API behavior unchanged
- Tool parameters remain the same

**New Features Opt-In**:
- Rate limiting: Enabled by default with safe limits, configurable via environment variables
- Environment validation: Automatic, provides helpful errors if misconfigured
- Input validation: Automatic, improves error messages

**Recommended Actions**:
1. Review [ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md) for new configuration options
2. Check [QUICK_START.md](docs/QUICK_START.md) for updated setup guidance
3. Consider enabling `DEBUG` to see rate limiting and validation in action

### Performance Impact

- **Startup**: +50-100ms for environment validation (one-time, on server start)
- **Runtime**: <1ms per tool call for Zod validation (negligible)
- **Rate Limiting**: Adds waiting time only when limits are exceeded
- **Memory**: +~1MB for rate limiter and validation schemas

### Use Cases Enabled

1. **Safer Production Deployment** - Input and environment validation catch errors early
2. **Quota Management** - Rate limiting prevents accidental quota exhaustion
3. **Better Debugging** - Enhanced error messages and debug logging
4. **Standard GCP Authentication** - GOOGLE_APPLICATION_CREDENTIALS support

## [0.7.0] - 2025-10-15

### Added

#### 📚 Comprehensive Documentation Package
- **HISTORY_GUIDE.md** - Complete history management implementation guide
  - SQLite database design with FTS5 full-text search
  - Metadata embedding in images (PNG/JPEG/WebP)
  - UUID-based tracking system
  - Integrity verification with SHA-256 hashing
  - Performance optimization strategies
  - Backup and maintenance procedures

- **FEATURES_SPECIFICATION.md** - Provider-agnostic feature specifications
  - All 25 tools documented with complete parameters
  - MCP protocol implementation details
  - Database schema design
  - Provider-specific adaptation guidelines (OpenAI, Stable Diffusion, etc.)
  - Testing checklist and migration guide

- **FEATURES_SUMMARY_JA.md** - Japanese feature summary and implementation guide
  - 25種類のツール詳細説明
  - プロバイダー別対応難易度と所要時間
  - 機能互換性比較表
  - 環境変数設定例とトラブルシューティング

- **IMPLEMENTATION_EXAMPLES.md** - Production-ready code examples
  - Complete OpenAI DALL-E provider implementation
  - Complete Stable Diffusion provider implementation (with ControlNet)
  - Database operations (batch insert, advanced search, pagination)
  - Metadata embedding and verification examples
  - Error handling patterns (retry logic, rate limiting)
  - Testing strategies (mocking, integration tests)

#### 🚀 Starter Template Package
- **starter-templates/** directory - Production-ready template for building custom MCP servers
  - Project configuration files (package.json, tsconfig.json, .env.template, .gitignore)
  - Complete TypeScript source code (8 files)
    - `src/index.ts` - MCP server entry point
    - `src/providers/base.ts` - Provider factory pattern
    - `src/providers/example.ts` - Template provider implementation
    - `src/utils/database.ts` - SQLite history management
    - `src/utils/metadata.ts` - Image metadata embedding
    - `src/utils/resources.ts` - MCP Resources API implementation
    - `src/tools/generateImage.ts` - Complete tool implementation example
    - `src/types/index.ts` - Full type definitions
  - Complete test suite (3 files)
    - Unit tests for providers
    - Database operation tests
    - End-to-end integration tests
  - Quick start guide (README.md)

### Improved
- **Documentation Structure** - Organized documentation for different use cases
  - Beginner path: Quick start with Japanese docs
  - Intermediate path: Provider-specific implementation guides
  - Advanced path: Complete architecture and customization

- **Code Reusability** - Template architecture supports multiple providers
  - Easy to swap between OpenAI, Stable Diffusion, or custom providers
  - Provider factory pattern for extensibility
  - Shared utilities for common operations

### Technical
- **Time to Working Server**: Reduced from hours to < 5 minutes with starter template
- **Documentation Coverage**: +5,000 lines of comprehensive guides
- **Code Examples**: 15+ complete, production-ready implementations
- **Languages**: Full English + Japanese documentation

### Migration
- **No Breaking Changes** - This is a documentation and template release
- Existing functionality remains unchanged
- All v0.6.1 code continues to work without modifications

### Use Cases Enabled
1. **Multi-Provider Cost Optimization** - Easy comparison and switching between providers
2. **On-Premise Image Generation** - Template supports local Stable Diffusion
3. **Production Audit Trail** - Complete history management with search
4. **Vendor Independence** - Not locked into a single provider
5. **Rapid Prototyping** - Start new projects in minutes, not hours

## [0.5.3] - 2025-10-12

### Fixed
- **generate_and_upscale_image ツールのURI/パス不一致を修正**
  - `src/index.ts` - `generateAndUpscaleImage()` メソッドで、`normalizeAndValidatePath()` が2回呼び出されることにより、自動連番機能が異なるファイル名を生成し、サムネイル生成が失敗する問題を解決
  - アップスケール結果から実際のfile:// URIを抽出し、`ResourceManager.resolveUri()` で正しいパスを取得するように変更
  - TypeScript型ガード (`c is { type: 'resource'; ... }`) を使用して安全な型チェックを実装
  - `McpError` 例外の適切な処理を追加

- **一時ファイル削除の確実な実行**
  - `src/index.ts` - `generateAndUpscaleImage()` メソッドで一時ファイルが削除されない問題を修正
  - タイムスタンプ変数 (`tempImageTimestamp`) を事前に計算し、`try` / `catch` ブロック間で共有
  - 絶対パス (`tempImageAbsPath`) を事前に生成し、成功時とエラー時の両方で一貫して使用
  - 相対パスと再計算されたタイムスタンプによる不一致を解消

### Changed
- **コード品質の向上**
  - TypeScript型ガードによる型安全性の強化
  - エラーハンドリングの改善（`McpError` の適切な処理）
  - ファイルライフサイクル管理の最適化

## [0.5.2] - 2025-10-11

### Changed
- デバッグログの最適化と非推奨警告の合理化

## [0.5.1] - 2025-10-11

### Fixed
- **サムネイル生成ロジックの改善**
  - `src/utils/image.ts` - `include_thumbnail: true` パラメータを指定した場合、環境変数の設定に関わらずサムネイルが生成されるように修正
  - `ThumbnailConfig` の `format` パラメータ（jpeg/png/webp）が正しく適用されるように修正

### Added
- **customize_image ツールのバリデーション強化**
  - 非正方形アスペクト比で3つの参照画像タイプを使用した際のバリデーションを追加
  - API制限事前チェックにより、明確なエラーメッセージと解決策を提示

## [0.4.0] - 2025-10-10

### Added
- **MCP Resources API support** - Images are now accessible via `resources/list` and `resources/read` endpoints
  - `src/utils/resources.ts` - New `ImageResourceManager` class for resource lifecycle management
  - `file://` URI return for all generated images
  - Automatic resource registration for output directory
  - Secure path validation with sandboxing (prevents path traversal attacks)
- **createUriImageResponse()** function - New utility for URI-based image responses
  - Provides `file://` URIs with resource metadata
  - MCP Resources API integration
  - Replaces direct file path returns

### Changed
- **Default behavior enhancement** - File save mode now includes resource URI in tool responses
  - All 4 tools (generate_image, edit_image, upscale_image, generate_and_upscale_image) now return `file://` URIs
  - URIs are accessible via MCP Resources API
  - Backward compatible - file paths still included in response text
- **Improved token consumption** - Reduced token usage by ~1,500 tokens per image when using default file save mode
  - Resources API eliminates need for Base64 encoding in protocol
  - Images fetched on-demand via `resources/read`

### Deprecated
- **return_base64 parameter** - Marked as deprecated, will be removed in v1.0.0
  - Warning messages enhanced to indicate deprecation
  - Tool descriptions updated with deprecation notice
  - Users should migrate to file save mode with Resources API
  - Deprecation warnings: `[DEPRECATED WARNING] return_base64=true is deprecated and will be removed in v1.0.0`

### Security
- **Path traversal protection** - ImageResourceManager validates all file paths
  - Prevents access outside configured output directory
  - Proper path normalization and validation
  - Sandboxed resource access

### Migration Guide (v0.3.0 → v0.4.0)

#### For Users
**No action required** - The default behavior remains backward compatible. However, you will now receive `file://` URIs in addition to file paths, enabling better integration with MCP clients.

**If you're using `return_base64=true`**:
1. Remove the `return_base64=true` parameter from your tool calls
2. Images will be saved to disk and returned via `file://` URI
3. Use MCP Resources API to access the images when needed

#### For Developers
**Accessing generated images**:
- Use `resources/list` to enumerate all generated images in the output directory
- Use `resources/read` with a `file://` URI to retrieve image data
- URIs are automatically included in tool responses

**Benefits**:
- ~1,500 tokens saved per image (compared to Base64 mode)
- Stable handling of large images (4K, 8K upscaled images)
- Better MCP specification compliance
- Foundation for future features (streaming, signed URLs, etc.)

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
