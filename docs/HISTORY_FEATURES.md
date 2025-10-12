# 履歴機能・メタデータ管理ガイド

このドキュメントでは、vertexai-imagen-mcp-server の履歴管理機能とメタデータ埋め込み機能について説明します。

## 目次

- [概要](#概要)
- [環境変数](#環境変数)
- [履歴管理ツール](#履歴管理ツール)
- [メタデータ埋め込み](#メタデータ埋め込み)
- [使用例](#使用例)
- [データベーススキーマ](#データベーススキーマ)
- [トラブルシューティング](#トラブルシューティング)

---

## 概要

このMCPサーバーは、生成した画像の履歴を自動的に記録し、後から検索・参照できる機能を提供します。

### 主な機能

- **自動履歴記録**: すべての画像生成をSQLiteデータベースに記録
- **メタデータ埋め込み**: 画像ファイル自体にUUIDや生成パラメータを埋め込み
- **UUID追跡**: 各画像に一意のUUIDを割り当て
- **フルテキスト検索**: プロンプトやパラメータで高速検索
- **整合性検証**: ハッシュ値による画像の改ざん検出

---

## 環境変数

### 1. VERTEXAI_IMAGEN_DB

データベースファイルの保存場所を指定します。

```bash
# デフォルト値
[VERTEXAI_IMAGEN_OUTPUT_DIR]/data/vertexai-imagen.db

# 例: カスタムパス指定
VERTEXAI_IMAGEN_DB=/path/to/custom/imagen.db
```

**説明:**
- ジョブ管理と画像履歴を保存するSQLiteデータベースのパス
- デフォルトは画像出力先フォルダ配下の `data/vertexai-imagen.db`
- 絶対パスで指定可能
- 自動的にディレクトリが作成されます

---

### 2. VERTEXAI_IMAGEN_EMBED_METADATA

生成画像にメタデータを埋め込むかどうかを制御します。

```bash
# デフォルト値: true（有効）

# 有効化（デフォルト）
VERTEXAI_IMAGEN_EMBED_METADATA=true

# 無効化
VERTEXAI_IMAGEN_EMBED_METADATA=false
VERTEXAI_IMAGEN_EMBED_METADATA=0
```

**説明:**
- `true` (デフォルト): 画像ファイルにUUIDやパラメータ情報を埋め込む
- `false` または `0`: メタデータ埋め込みを無効化
- PNG形式では tEXtチャンク、JPEG/WebP形式では EXIF メタデータに埋め込み

**メタデータ埋め込みのメリット:**
- 画像ファイル単体で生成パラメータを保持
- データベースが利用できない環境でも情報を確認可能
- 整合性チェック（改ざん検出）が可能

---

### 3. VERTEXAI_IMAGEN_METADATA_LEVEL

埋め込むメタデータの詳細レベルを指定します。

```bash
# デフォルト値: standard

VERTEXAI_IMAGEN_METADATA_LEVEL=minimal    # 最小限
VERTEXAI_IMAGEN_METADATA_LEVEL=standard   # 標準（デフォルト）
VERTEXAI_IMAGEN_METADATA_LEVEL=full       # 完全
```

#### レベル別の埋め込み内容

| レベル | 埋め込まれる情報 | ファイルサイズ影響 | 推奨用途 |
|--------|------------------|-------------------|----------|
| **minimal** | • UUID<br>• パラメータハッシュ | 最小（~100バイト） | ファイルサイズ最優先 |
| **standard** | • UUID<br>• パラメータハッシュ<br>• ツール名<br>• モデル名<br>• 生成日時<br>• アスペクト比<br>• 画像サイズ | 小（~300バイト） | 通常使用（推奨） |
| **full** | すべてのメタデータ<br>（プロンプト、全パラメータなど） | 中（~1KB-3KB） | 完全な再現性が必要 |

**推奨設定:**
- **standard** (デフォルト): 通常の使用で十分な情報量
- **minimal**: ファイルサイズを厳密に管理したい場合
- **full**: プロンプトを含む完全な情報が必要な場合

---

## 履歴管理ツール

### 1. list_history - 履歴一覧表示

画像生成履歴の一覧を取得します。

#### パラメータ

```typescript
{
  filters?: {
    tool_name?: string;        // ツール名でフィルタ
    model?: string;            // モデル名でフィルタ
    aspect_ratio?: string;     // アスペクト比でフィルタ
    date_from?: string;        // 開始日時（ISO 8601形式）
    date_to?: string;          // 終了日時（ISO 8601形式）
  },
  sort_by?: "created_at" | "file_size",  // ソートフィールド
  sort_order?: "asc" | "desc",           // ソート順序
  limit?: number,                        // 最大取得件数（デフォルト: 50）
  offset?: number                        // オフセット（ページネーション用）
}
```

#### 使用例

```text
# 最新10件の履歴を表示
「最近生成した画像の履歴を10件表示してください」
→ list_history with limit: 10

# 特定のモデルでフィルタ
「imagen-4.0-ultraで生成した画像の履歴を見せて」
→ list_history with filters: { model: "imagen-4.0-ultra-generate-001" }

# 日付範囲でフィルタ
「今週生成した画像の一覧を表示」
→ list_history with filters: { date_from: "2025-10-08T00:00:00Z" }
```

#### レスポンス例

```text
✅ Image History (10 records found)

1. UUID: abc123...
   Prompt: A beautiful sunset landscape
   Model: imagen-3.0-generate-002
   Created: 2025-10-12 14:30:22
   File: ~/Downloads/vertexai-imagen-files/sunset.png (1.2 MB)
   Aspect Ratio: 16:9

2. UUID: def456...
   Prompt: Portrait of a person in a park
   Model: imagen-3.0-generate-002
   Created: 2025-10-12 13:15:10
   File: ~/Downloads/vertexai-imagen-files/portrait.png (985 KB)
   Aspect Ratio: 3:4

...
```

---

### 2. get_history_by_uuid - UUID指定で履歴取得

特定のUUIDで画像の詳細情報を取得します。

#### パラメータ

```typescript
{
  uuid: string  // 画像のUUID（必須）
}
```

#### 使用例

```text
# 特定の画像の詳細を確認
「UUID abc123... の画像の詳細情報を教えて」
→ get_history_by_uuid with uuid: "abc123..."
```

#### レスポンス例

```text
✅ Image Details

UUID: abc123-def456-789...
File Path: ~/Downloads/vertexai-imagen-files/sunset.png
Tool: generate_image
Model: imagen-3.0-generate-002

Prompt: A beautiful sunset landscape with mountains

Generated: 2025-10-12 14:30:22
Aspect Ratio: 16:9
Sample Count: 1
Safety Level: BLOCK_MEDIUM_AND_ABOVE
Person Generation: DONT_ALLOW
Language: auto

File Size: 1,234,567 bytes
MIME Type: image/png

Parameters Hash: abc123def456...
```

---

### 3. search_history - フルテキスト検索

プロンプトやパラメータでフルテキスト検索を行います。

#### パラメータ

```typescript
{
  query: string,         // 検索クエリ（必須）
  limit?: number,        // 最大取得件数（デフォルト: 50）
  filters?: {            // オプションのフィルタ
    tool_name?: string;
    model?: string;
    aspect_ratio?: string;
    date_from?: string;
    date_to?: string;
  }
}
```

#### 使用例

```text
# キーワードで検索
「"sunset"というキーワードで画像を検索して」
→ search_history with query: "sunset"

# 複数キーワード
「"mountain landscape"を含む画像を探して」
→ search_history with query: "mountain landscape"

# フィルタと組み合わせ
「"portrait"でimagen-4.0を使った画像を検索」
→ search_history with query: "portrait", filters: { model: "imagen-4.0-generate-001" }
```

#### 検索仕様

- プロンプトとパラメータJSON内を全文検索
- SQLite FTS5（Full-Text Search）を使用
- 部分一致、複数単語対応

---

### 4. get_metadata_from_image - 画像からメタデータ読み取り

画像ファイルに埋め込まれたメタデータを抽出します。

#### パラメータ

```typescript
{
  image_path: string  // 画像ファイルのパス（必須）
}
```

#### 使用例

```text
# 画像ファイルからメタデータを読み取る
「sunset.pngに埋め込まれたメタデータを読み取って」
→ get_metadata_from_image with image_path: "sunset.png"

# データベースと照合
「この画像の整合性をチェックして」
→ get_metadata_from_image でメタデータ抽出 → データベースと照合
```

#### レスポンス例

```text
✅ Metadata Extracted Successfully

UUID: abc123-def456-789...
Tool: generate_image
Model: imagen-3.0-generate-002
Created: 2025-10-12T14:30:22Z
Aspect Ratio: 16:9
Parameters Hash: abc123def456...

✅ Database Verification: PASSED
   - Image record found in database
   - Hash values match
   - No tampering detected
```

---

## メタデータ埋め込み

### サポート形式

| 形式 | 埋め込み方法 | 説明 |
|------|-------------|------|
| **PNG** | tEXtチャンク | `vertexai_imagen_metadata` キーワードでJSON格納 |
| **JPEG** | EXIF IFD0 ImageDescription | EXIFメタデータとしてJSON格納 |
| **WebP** | EXIF IFD0 ImageDescription | EXIFメタデータとしてJSON格納 |

### メタデータ構造（standard レベル）

```json
{
  "vertexai_imagen_uuid": "abc123-def456-789...",
  "params_hash": "a1b2c3d4e5f6...",
  "tool_name": "generate_image",
  "model": "imagen-3.0-generate-002",
  "created_at": "2025-10-12T14:30:22.123Z",
  "aspect_ratio": "16:9",
  "sample_image_size": "1K"
}
```

### 整合性検証の仕組み

1. **パラメータハッシュ計算**: 生成パラメータからSHA-256ハッシュを計算
2. **メタデータ埋め込み**: ハッシュ値を画像ファイルに埋め込み
3. **データベース記録**: 同じハッシュ値をデータベースに保存
4. **検証**: 画像から読み取ったハッシュとデータベースのハッシュを比較

**改ざん検出:**
- パラメータが変更されるとハッシュ値が変わる
- 画像ファイルとデータベースのハッシュ不一致で検出

---

## 使用例

### 設定例 1: デフォルト設定（推奨）

```json
{
  "mcpServers": {
    "google-imagen": {
      "command": "vertexai-imagen-mcp-server",
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/key.json"
      }
    }
  }
}
```

- メタデータ埋め込み: 有効
- メタデータレベル: standard
- データベース: `~/Downloads/vertexai-imagen-files/data/vertexai-imagen.db`

---

### 設定例 2: 完全なメタデータ埋め込み

```json
{
  "mcpServers": {
    "google-imagen": {
      "command": "vertexai-imagen-mcp-server",
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/key.json",
        "VERTEXAI_IMAGEN_EMBED_METADATA": "true",
        "VERTEXAI_IMAGEN_METADATA_LEVEL": "full"
      }
    }
  }
}
```

- プロンプトを含むすべてのパラメータを画像に埋め込み
- 画像単体で完全な情報を保持
- ファイルサイズは若干増加（~1-3KB）

---

### 設定例 3: メタデータ埋め込み無効

```json
{
  "mcpServers": {
    "google-imagen": {
      "command": "vertexai-imagen-mcp-server",
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/key.json",
        "VERTEXAI_IMAGEN_EMBED_METADATA": "false"
      }
    }
  }
}
```

- 画像ファイルにメタデータを埋め込まない
- データベースのみに履歴を記録
- ファイルサイズを最小化

---

### 設定例 4: カスタムデータベースパス

```json
{
  "mcpServers": {
    "google-imagen": {
      "command": "vertexai-imagen-mcp-server",
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/key.json",
        "VERTEXAI_IMAGEN_OUTPUT_DIR": "/mnt/storage/images",
        "VERTEXAI_IMAGEN_DB": "/mnt/storage/database/imagen.db"
      }
    }
  }
}
```

- 画像とデータベースを外部ストレージに保存
- 大量の画像を管理する場合に有用

---

## データベーススキーマ

### images テーブル

```sql
CREATE TABLE images (
  uuid TEXT PRIMARY KEY,          -- 画像UUID
  file_path TEXT NOT NULL,        -- ファイルパス（絶対パス）
  tool_name TEXT NOT NULL,        -- 使用ツール名
  prompt TEXT NOT NULL,           -- プロンプト
  created_at DATETIME,            -- 生成日時

  -- 生成パラメータ
  model TEXT,                     -- 使用モデル
  aspect_ratio TEXT,              -- アスペクト比
  sample_count INTEGER,           -- サンプル数
  sample_image_size TEXT,         -- 画像サイズ（1K/2K）
  safety_level TEXT,              -- 安全性レベル
  person_generation TEXT,         -- 人物生成ポリシー
  language TEXT,                  -- 言語

  -- メタデータ
  parameters TEXT NOT NULL,       -- 全パラメータ（JSON）
  params_hash TEXT NOT NULL,      -- パラメータハッシュ

  -- ステータス
  success BOOLEAN DEFAULT 1,      -- 成功/失敗
  error_message TEXT,             -- エラーメッセージ

  -- ファイル情報
  file_size INTEGER,              -- ファイルサイズ（バイト）
  mime_type TEXT                  -- MIMEタイプ
);
```

### インデックス

```sql
-- パフォーマンス最適化用インデックス
CREATE INDEX idx_images_created_at ON images(created_at DESC);
CREATE INDEX idx_images_tool_name ON images(tool_name);
CREATE INDEX idx_images_model ON images(model);
CREATE INDEX idx_images_params_hash ON images(params_hash);
```

### フルテキスト検索テーブル

```sql
-- SQLite FTS5による高速検索
CREATE VIRTUAL TABLE images_fts USING fts5(
  uuid,
  prompt,
  parameters,
  content='images'
);
```

---

## トラブルシューティング

### 問題 1: データベースファイルが見つからない

**症状:**
```
Error: SQLITE_CANTOPEN: unable to open database file
```

**原因:**
- データベースディレクトリへの書き込み権限がない
- 指定されたパスが無効

**解決方法:**
```bash
# ディレクトリの権限を確認
ls -la ~/Downloads/vertexai-imagen-files/data/

# 権限がない場合は修正
chmod 755 ~/Downloads/vertexai-imagen-files/data/

# または、書き込み可能なカスタムパスを指定
VERTEXAI_IMAGEN_DB=/tmp/imagen.db
```

---

### 問題 2: メタデータが埋め込まれない

**症状:**
- `get_metadata_from_image` で "No metadata found" が返される

**原因:**
- `VERTEXAI_IMAGEN_EMBED_METADATA=false` に設定されている
- サポートされていない画像形式

**解決方法:**
```bash
# メタデータ埋め込みを有効化
VERTEXAI_IMAGEN_EMBED_METADATA=true

# デバッグモードで確認
DEBUG=1 vertexai-imagen-mcp-server
```

---

### 問題 3: 履歴検索が遅い

**症状:**
- `search_history` の実行に時間がかかる

**原因:**
- データベースファイルが大きくなりすぎている
- フルテキスト検索インデックスが破損

**解決方法:**
```bash
# データベースのVACUUM実行（最適化）
sqlite3 ~/Downloads/vertexai-imagen-files/data/vertexai-imagen.db "VACUUM;"

# フルテキスト検索インデックスの再構築
sqlite3 ~/Downloads/vertexai-imagen-files/data/vertexai-imagen.db "INSERT INTO images_fts(images_fts) VALUES('rebuild');"
```

---

### 問題 4: ディスク容量不足

**症状:**
```
Error: SQLITE_FULL: database or disk is full
```

**原因:**
- ディスク容量の不足
- 大量の履歴データが蓄積

**解決方法:**
```bash
# 古い履歴を削除（注意: UUIDは永続的に失われます）
# 例: 30日以前の履歴を削除
sqlite3 ~/Downloads/vertexai-imagen-files/data/vertexai-imagen.db \
  "DELETE FROM images WHERE created_at < datetime('now', '-30 days');"

# または、新しいデータベースで再スタート
mv ~/Downloads/vertexai-imagen-files/data/vertexai-imagen.db \
   ~/Downloads/vertexai-imagen-files/data/vertexai-imagen.db.backup
```

---

## ベストプラクティス

### 1. 定期的なバックアップ

```bash
# データベースのバックアップスクリプト例
#!/bin/bash
DB_PATH=~/Downloads/vertexai-imagen-files/data/vertexai-imagen.db
BACKUP_DIR=~/backups/imagen-db
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"
cp "$DB_PATH" "$BACKUP_DIR/imagen-$DATE.db"

# 30日以上前のバックアップを削除
find "$BACKUP_DIR" -name "imagen-*.db" -mtime +30 -delete
```

### 2. メタデータレベルの選択

| 用途 | 推奨レベル | 理由 |
|------|-----------|------|
| 個人使用・実験 | `standard` | バランスが良い |
| プロダクション | `standard` | 十分な情報量、ファイルサイズ最適 |
| アーカイブ | `full` | 完全な再現性 |
| バッチ処理 | `minimal` | ファイルサイズ最小化 |

### 3. 検索パフォーマンスの最適化

- 大量の画像（1万枚以上）を扱う場合は定期的に `VACUUM` を実行
- 頻繁に検索する条件には追加のインデックスを作成
- 不要な古い履歴は削除

---

## 関連ドキュメント

- [README.md](../README.md) - メインドキュメント
- [IMPLEMENTATION_ROADMAP.md](../IMPLEMENTATION_ROADMAP.md) - 実装ロードマップ
- [CODING_CONVENTIONS.md](../CODING_CONVENTIONS.md) - コーディング規約

---

## サポート

問題が解決しない場合は、以下の情報を含めて Issue を作成してください：

- 使用している環境変数の設定
- エラーメッセージの全文
- `DEBUG=1` で実行した際のログ
- データベースファイルのサイズ
- SQLiteのバージョン (`sqlite3 --version`)
