# History Management & Metadata Guide
# 履歴管理とメタデータガイド（プロバイダー非依存版）

This guide provides a comprehensive overview of implementing history tracking and metadata management for image generation MCP servers, regardless of the AI provider used.

このガイドは、使用するAIプロバイダーに関係なく、画像生成MCPサーバーの履歴追跡とメタデータ管理を実装するための包括的な概要を提供します。

---

## Table of Contents / 目次

1. [Overview](#overview)
2. [Database Design](#database-design)
3. [History Management Tools](#history-management-tools)
4. [Metadata Embedding](#metadata-embedding)
5. [Full-Text Search Implementation](#full-text-search-implementation)
6. [Integrity Verification](#integrity-verification)
7. [Performance Optimization](#performance-optimization)
8. [Backup Strategies](#backup-strategies)
9. [Implementation Examples](#implementation-examples)
10. [Troubleshooting](#troubleshooting)

---

## Overview / 概要

### Why History Management? / なぜ履歴管理が必要か

Image generation is an iterative process. Users need to:
- Track what prompts and parameters produced which results
- Reproduce successful generations
- Search through past work
- Maintain audit trails for production use

画像生成は反復的なプロセスです。ユーザーは以下が必要です：
- どのプロンプトとパラメータがどの結果を生成したかを追跡
- 成功した生成を再現
- 過去の作業を検索
- プロダクション使用のための監査証跡を維持

### Key Features / 主要機能

1. **Automatic Recording** / 自動記録
   - Every generation is logged to SQLite database
   - UUID assignment for unique identification
   - Timestamp tracking

2. **Metadata Embedding** / メタデータ埋め込み
   - Store generation parameters inside image files
   - Survive database loss
   - Enable offline verification

3. **Search Capabilities** / 検索機能
   - Full-text search on prompts
   - Filter by model, date, aspect ratio
   - Parameter-based queries

4. **Integrity Verification** / 整合性検証
   - SHA-256 hash of parameters
   - Detect tampering
   - Database-image consistency checks

---

## Database Design / データベース設計

### Recommended: SQLite

**Advantages**:
- Zero-configuration
- Serverless (embedded)
- ACID compliant
- FTS5 full-text search support
- Portable single-file database

### Core Schema / コアスキーマ

```sql
-- History table
CREATE TABLE IF NOT EXISTS history (
  -- Primary identification
  uuid TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Tool information
  tool_name TEXT NOT NULL,
  model TEXT,
  provider TEXT,

  -- User input
  prompt TEXT NOT NULL,
  negative_prompt TEXT,

  -- Parameters (stored as JSON for flexibility)
  parameters TEXT NOT NULL,
  params_hash TEXT NOT NULL,

  -- Output information
  output_paths TEXT NOT NULL,  -- JSON array of file paths
  file_sizes INTEGER,
  mime_types TEXT,

  -- Generation settings
  aspect_ratio TEXT,
  sample_count INTEGER DEFAULT 1,
  sample_image_size TEXT,

  -- Status
  success BOOLEAN DEFAULT 1,
  error_message TEXT,

  -- Metadata
  metadata TEXT  -- JSON for extensibility
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_history_created_at
  ON history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_history_tool_name
  ON history(tool_name);

CREATE INDEX IF NOT EXISTS idx_history_model
  ON history(model);

CREATE INDEX IF NOT EXISTS idx_history_provider
  ON history(provider);

CREATE INDEX IF NOT EXISTS idx_history_params_hash
  ON history(params_hash);

-- Full-text search table (SQLite FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS history_fts USING fts5(
  uuid UNINDEXED,
  prompt,
  negative_prompt,
  parameters,
  content='history',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS history_fts_insert AFTER INSERT ON history
BEGIN
  INSERT INTO history_fts(rowid, uuid, prompt, negative_prompt, parameters)
  VALUES (new.rowid, new.uuid, new.prompt, new.negative_prompt, new.parameters);
END;

CREATE TRIGGER IF NOT EXISTS history_fts_delete AFTER DELETE ON history
BEGIN
  DELETE FROM history_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER IF NOT EXISTS history_fts_update AFTER UPDATE ON history
BEGIN
  UPDATE history_fts
  SET prompt = new.prompt,
      negative_prompt = new.negative_prompt,
      parameters = new.parameters
  WHERE rowid = new.rowid;
END;
```

### Optional: Templates Table / テンプレートテーブル（オプション）

```sql
CREATE TABLE IF NOT EXISTS templates (
  name TEXT PRIMARY KEY,
  description TEXT,
  template TEXT NOT NULL,
  variables TEXT,  -- JSON array
  default_params TEXT,  -- JSON object
  tags TEXT,  -- JSON array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_templates_tags
  ON templates(tags);
```

### Optional: Jobs Table / ジョブテーブル（オプション）

For async job management:

```sql
CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY,
  tool_type TEXT NOT NULL,
  status TEXT NOT NULL,  -- pending, running, completed, failed
  params TEXT NOT NULL,
  result TEXT,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_jobs_status
  ON jobs(status);

CREATE INDEX IF NOT EXISTS idx_jobs_created_at
  ON jobs(created_at DESC);
```

---

## History Management Tools / 履歴管理ツール

### 1. list_history

List past generations with filtering and sorting.

**Parameters**:
```typescript
interface ListHistoryArgs {
  filters?: {
    tool_name?: string;
    model?: string;
    provider?: string;
    aspect_ratio?: string;
    date_from?: string;  // ISO 8601
    date_to?: string;    // ISO 8601
  };
  sort_by?: "created_at" | "file_size";
  sort_order?: "asc" | "desc";
  limit?: number;   // default: 50
  offset?: number;  // for pagination
}
```

**SQL Implementation**:
```typescript
function buildListHistoryQuery(args: ListHistoryArgs): string {
  let sql = "SELECT * FROM history WHERE 1=1";
  const params: any[] = [];

  if (args.filters?.tool_name) {
    sql += " AND tool_name = ?";
    params.push(args.filters.tool_name);
  }

  if (args.filters?.model) {
    sql += " AND model = ?";
    params.push(args.filters.model);
  }

  if (args.filters?.provider) {
    sql += " AND provider = ?";
    params.push(args.filters.provider);
  }

  if (args.filters?.aspect_ratio) {
    sql += " AND aspect_ratio = ?";
    params.push(args.filters.aspect_ratio);
  }

  if (args.filters?.date_from) {
    sql += " AND created_at >= ?";
    params.push(args.filters.date_from);
  }

  if (args.filters?.date_to) {
    sql += " AND created_at <= ?";
    params.push(args.filters.date_to);
  }

  const sortBy = args.sort_by || "created_at";
  const sortOrder = args.sort_order || "desc";
  sql += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

  const limit = args.limit || 50;
  sql += ` LIMIT ${limit}`;

  if (args.offset) {
    sql += ` OFFSET ${args.offset}`;
  }

  return sql;
}
```

### 2. get_history_by_uuid

Retrieve detailed information for a specific generation.

**Parameters**:
```typescript
interface GetHistoryByUuidArgs {
  uuid: string;
}
```

**SQL Implementation**:
```typescript
async function getHistoryByUuid(uuid: string): Promise<HistoryRecord | null> {
  const sql = "SELECT * FROM history WHERE uuid = ?";
  const row = await db.get(sql, [uuid]);

  if (!row) return null;

  return {
    ...row,
    parameters: JSON.parse(row.parameters),
    output_paths: JSON.parse(row.output_paths),
    metadata: row.metadata ? JSON.parse(row.metadata) : null
  };
}
```

### 3. search_history

Full-text search across prompts and parameters.

**Parameters**:
```typescript
interface SearchHistoryArgs {
  query: string;
  limit?: number;
  filters?: {
    tool_name?: string;
    model?: string;
    provider?: string;
    date_from?: string;
    date_to?: string;
  };
}
```

**SQL Implementation** (using FTS5):
```typescript
async function searchHistory(args: SearchHistoryArgs): Promise<HistoryRecord[]> {
  let sql = `
    SELECT h.* FROM history h
    JOIN history_fts fts ON h.rowid = fts.rowid
    WHERE history_fts MATCH ?
  `;

  const params: any[] = [args.query];

  // Add filters
  if (args.filters?.tool_name) {
    sql += " AND h.tool_name = ?";
    params.push(args.filters.tool_name);
  }

  // ... other filters

  sql += " ORDER BY h.created_at DESC";
  sql += ` LIMIT ${args.limit || 50}`;

  const rows = await db.all(sql, params);
  return rows.map(row => ({
    ...row,
    parameters: JSON.parse(row.parameters),
    output_paths: JSON.parse(row.output_paths)
  }));
}
```

### 4. get_metadata_from_image

Extract metadata embedded in image files.

**Parameters**:
```typescript
interface GetMetadataFromImageArgs {
  image_path: string;
}
```

**Implementation** (see Metadata Embedding section).

---

## Metadata Embedding / メタデータ埋め込み

### Supported Formats / サポート形式

| Format | Embedding Method | Library |
|--------|-----------------|---------|
| **PNG** | tEXt chunk | sharp, pngjs |
| **JPEG** | EXIF IFD0 ImageDescription | exif-writer, piexifjs |
| **WebP** | EXIF metadata | sharp (with EXIF support) |

### Metadata Levels / メタデータレベル

#### Minimal Level
```json
{
  "uuid": "abc123-def456-789...",
  "params_hash": "a1b2c3d4e5f6..."
}
```
**Size**: ~100 bytes

#### Standard Level (Recommended)
```json
{
  "uuid": "abc123-def456-789...",
  "params_hash": "a1b2c3d4e5f6...",
  "tool_name": "generate_image",
  "model": "imagen-3.0-generate-002",
  "provider": "vertex-ai",
  "created_at": "2025-10-15T10:30:00Z",
  "aspect_ratio": "16:9",
  "sample_image_size": "1K"
}
```
**Size**: ~300 bytes

#### Full Level
All parameters including prompt, negative_prompt, and all generation settings.

**Size**: ~1-3KB

### Implementation Example (PNG with Sharp)

```typescript
import sharp from 'sharp';

async function embedMetadataPNG(
  imagePath: string,
  metadata: Record<string, any>,
  level: 'minimal' | 'standard' | 'full' = 'standard'
): Promise<void> {
  const filteredMetadata = filterMetadataByLevel(metadata, level);
  const metadataString = JSON.stringify(filteredMetadata);

  await sharp(imagePath)
    .withMetadata({
      exif: {
        IFD0: {
          ImageDescription: metadataString
        }
      }
    })
    .toFile(imagePath + '.tmp');

  // Replace original file
  await fs.rename(imagePath + '.tmp', imagePath);
}

async function extractMetadataPNG(
  imagePath: string
): Promise<Record<string, any> | null> {
  const imageInfo = await sharp(imagePath).metadata();

  if (imageInfo.exif) {
    const exif = await extractExif(imageInfo.exif);
    if (exif.ImageDescription) {
      try {
        return JSON.parse(exif.ImageDescription);
      } catch (e) {
        return null;
      }
    }
  }

  return null;
}

function filterMetadataByLevel(
  metadata: Record<string, any>,
  level: 'minimal' | 'standard' | 'full'
): Record<string, any> {
  switch (level) {
    case 'minimal':
      return {
        uuid: metadata.uuid,
        params_hash: metadata.params_hash
      };

    case 'standard':
      return {
        uuid: metadata.uuid,
        params_hash: metadata.params_hash,
        tool_name: metadata.tool_name,
        model: metadata.model,
        provider: metadata.provider,
        created_at: metadata.created_at,
        aspect_ratio: metadata.aspect_ratio,
        sample_image_size: metadata.sample_image_size
      };

    case 'full':
      return metadata;
  }
}
```

---

## Full-Text Search Implementation / 全文検索の実装

### SQLite FTS5 Configuration

FTS5 (Full-Text Search version 5) provides powerful search capabilities.

**Features**:
- Boolean queries (AND, OR, NOT)
- Phrase search with quotes
- Prefix matching with *
- Ranking by relevance

### Query Examples

```typescript
// Simple search
"sunset"

// Multiple terms (implicit AND)
"beautiful sunset landscape"

// Explicit operators
"sunset OR sunrise"
"landscape NOT portrait"

// Phrase search
"\"professional portrait\""

// Prefix matching
"mount*"  // matches mountain, mountains, etc.

// Combining operators
"(sunset OR sunrise) AND landscape"
```

### Ranking Results

```sql
-- Get results ranked by relevance
SELECT h.*, rank
FROM history_fts fts
JOIN history h ON fts.rowid = h.rowid
WHERE history_fts MATCH ?
ORDER BY rank
LIMIT 50;
```

### Performance Tips

1. **Rebuild FTS index periodically**:
```sql
INSERT INTO history_fts(history_fts) VALUES('rebuild');
```

2. **Optimize database**:
```sql
VACUUM;
ANALYZE;
```

3. **Use LIMIT always** - FTS can return many results

---

## Integrity Verification / 整合性検証

### Parameter Hashing

Use SHA-256 to create a unique fingerprint of generation parameters.

```typescript
import crypto from 'crypto';

function calculateParamsHash(params: Record<string, any>): string {
  // Sort keys for consistent hashing
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, any>);

  const paramsString = JSON.stringify(sortedParams);
  return crypto.createHash('sha256').update(paramsString).digest('hex');
}
```

### Verification Process

```typescript
async function verifyImageIntegrity(
  imagePath: string
): Promise<{valid: boolean, details: string}> {
  // 1. Extract metadata from image
  const imageMetadata = await extractMetadataPNG(imagePath);
  if (!imageMetadata) {
    return {valid: false, details: 'No metadata found in image'};
  }

  // 2. Look up in database
  const dbRecord = await getHistoryByUuid(imageMetadata.uuid);
  if (!dbRecord) {
    return {valid: false, details: 'UUID not found in database'};
  }

  // 3. Compare hashes
  if (imageMetadata.params_hash !== dbRecord.params_hash) {
    return {
      valid: false,
      details: 'Hash mismatch - parameters may have been modified'
    };
  }

  // 4. Verify file still exists at recorded path
  const fileExists = await fs.access(dbRecord.output_paths[0])
    .then(() => true)
    .catch(() => false);

  if (!fileExists) {
    return {
      valid: true,
      details: 'Integrity valid but file moved from original location'
    };
  }

  return {valid: true, details: 'All checks passed'};
}
```

---

## Performance Optimization / パフォーマンス最適化

### Database Optimization

#### 1. Connection Pooling

For SQLite, use WAL mode for better concurrent access:

```typescript
import Database from 'better-sqlite3';

const db = new Database('history.db');
db.pragma('journal_mode = WAL');  // Write-Ahead Logging
db.pragma('synchronous = NORMAL');  // Balance between safety and speed
db.pragma('cache_size = 10000');  // Increase cache
```

#### 2. Prepared Statements

```typescript
class HistoryDatabase {
  private insertStmt: Database.Statement;
  private selectByUuidStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO history (uuid, tool_name, model, prompt, parameters, ...)
      VALUES (?, ?, ?, ?, ?, ...)
    `);

    this.selectByUuidStmt = db.prepare(`
      SELECT * FROM history WHERE uuid = ?
    `);
  }

  insert(record: HistoryRecord): void {
    this.insertStmt.run(
      record.uuid,
      record.tool_name,
      record.model,
      // ...
    );
  }

  getByUuid(uuid: string): HistoryRecord | null {
    return this.selectByUuidStmt.get(uuid) as HistoryRecord | null;
  }
}
```

#### 3. Batch Inserts

```typescript
async function insertBatch(records: HistoryRecord[]): Promise<void> {
  const insert = db.transaction((records) => {
    for (const record of records) {
      insertStmt.run(/* ... */);
    }
  });

  insert(records);
}
```

### File System Optimization

#### 1. Lazy Loading

Don't load image data unless requested:

```typescript
interface HistoryRecord {
  uuid: string;
  // ... metadata
  output_paths: string[];

  // Don't include:
  // imageData: Buffer;  ❌
}

// Load on demand:
async function getImageData(uuid: string): Promise<Buffer> {
  const record = await getHistoryByUuid(uuid);
  return await fs.readFile(record.output_paths[0]);
}
```

#### 2. Thumbnail Caching

Generate thumbnails once and cache:

```typescript
async function getThumbnail(imagePath: string): Promise<Buffer> {
  const thumbPath = imagePath.replace(/\.(png|jpg)$/, '.thumb.jpg');

  try {
    return await fs.readFile(thumbPath);
  } catch {
    // Generate and cache
    const thumb = await sharp(imagePath)
      .resize(128, 128, {fit: 'inside'})
      .jpeg({quality: 60})
      .toBuffer();

    await fs.writeFile(thumbPath, thumb);
    return thumb;
  }
}
```

---

## Backup Strategies / バックアップ戦略

### Automated Backup Script

```bash
#!/bin/bash
# backup-history.sh

DB_PATH="${HISTORY_DB_PATH:-~/Downloads/ai-images/data/history.db}"
BACKUP_DIR="${BACKUP_DIR:-~/backups/image-history}"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup database
cp "$DB_PATH" "$BACKUP_DIR/history-$DATE.db"

# Compress
gzip "$BACKUP_DIR/history-$DATE.db"

# Delete old backups (keep last 30 days)
find "$BACKUP_DIR" -name "history-*.db.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/history-$DATE.db.gz"
```

### Cloud Backup

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

async function backupToS3(dbPath: string): Promise<void> {
  const s3 = new S3Client({region: 'us-east-1'});
  const fileContent = await fs.readFile(dbPath);

  await s3.send(new PutObjectCommand({
    Bucket: 'my-image-history-backups',
    Key: `history-${Date.now()}.db`,
    Body: fileContent
  }));
}
```

### Database Maintenance

```typescript
async function performMaintenance(db: Database.Database): Promise<void> {
  // 1. Rebuild FTS index
  db.exec("INSERT INTO history_fts(history_fts) VALUES('rebuild')");

  // 2. Vacuum (reclaim space)
  db.exec("VACUUM");

  // 3. Analyze (update query planner statistics)
  db.exec("ANALYZE");

  // 4. Checkpoint WAL
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
}

// Run weekly
setInterval(() => performMaintenance(db), 7 * 24 * 60 * 60 * 1000);
```

---

## Implementation Examples / 実装例

### Complete History Manager Class

```typescript
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export class HistoryManager {
  private db: Database.Database;
  private insertStmt: Database.Statement;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.setupDatabase();
    this.prepareStatements();
  }

  private setupDatabase(): void {
    // Create tables (SQL from Database Design section)
    this.db.exec(`/* ... schema SQL ... */`);
  }

  private prepareStatements(): void {
    this.insertStmt = this.db.prepare(`
      INSERT INTO history (
        uuid, tool_name, model, provider, prompt,
        parameters, params_hash, output_paths,
        aspect_ratio, sample_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }

  async createRecord(data: {
    tool_name: string;
    model: string;
    provider: string;
    prompt: string;
    parameters: Record<string, any>;
    output_paths: string[];
    aspect_ratio?: string;
    sample_count?: number;
  }): Promise<string> {
    const uuid = uuidv4();
    const params_hash = this.calculateHash(data.parameters);
    const created_at = new Date().toISOString();

    this.insertStmt.run(
      uuid,
      data.tool_name,
      data.model,
      data.provider,
      data.prompt,
      JSON.stringify(data.parameters),
      params_hash,
      JSON.stringify(data.output_paths),
      data.aspect_ratio || null,
      data.sample_count || 1,
      created_at
    );

    return uuid;
  }

  list(args: ListHistoryArgs): HistoryRecord[] {
    const sql = buildListHistoryQuery(args);
    return this.db.prepare(sql).all() as HistoryRecord[];
  }

  getByUuid(uuid: string): HistoryRecord | null {
    const row = this.db
      .prepare('SELECT * FROM history WHERE uuid = ?')
      .get(uuid);

    if (!row) return null;

    return {
      ...row,
      parameters: JSON.parse(row.parameters),
      output_paths: JSON.parse(row.output_paths)
    } as HistoryRecord;
  }

  search(query: string, limit: number = 50): HistoryRecord[] {
    const sql = `
      SELECT h.* FROM history h
      JOIN history_fts fts ON h.rowid = fts.rowid
      WHERE history_fts MATCH ?
      ORDER BY h.created_at DESC
      LIMIT ?
    `;

    const rows = this.db.prepare(sql).all(query, limit);
    return rows.map(row => ({
      ...row,
      parameters: JSON.parse(row.parameters),
      output_paths: JSON.parse(row.output_paths)
    })) as HistoryRecord[];
  }

  private calculateHash(params: Record<string, any>): string {
    const sorted = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, any>);

    return crypto
      .createHash('sha256')
      .update(JSON.stringify(sorted))
      .digest('hex');
  }

  close(): void {
    this.db.close();
  }
}
```

### Usage Example

```typescript
// Initialize
const historyManager = new HistoryManager('./history.db');

// Create record
const uuid = await historyManager.createRecord({
  tool_name: 'generate_image',
  model: 'dall-e-3',
  provider: 'openai',
  prompt: 'A beautiful sunset over mountains',
  parameters: {
    prompt: 'A beautiful sunset over mountains',
    size: '1024x1024',
    quality: 'hd'
  },
  output_paths: ['/path/to/sunset.png'],
  aspect_ratio: '1:1',
  sample_count: 1
});

// List recent
const recent = historyManager.list({
  limit: 10,
  sort_by: 'created_at',
  sort_order: 'desc'
});

// Search
const sunsets = historyManager.search('sunset');

// Get specific
const record = historyManager.getByUuid(uuid);
```

---

## Troubleshooting / トラブルシューティング

### Common Issues / よくある問題

#### 1. Database Locked Error

**Symptom**:
```
Error: SQLITE_BUSY: database is locked
```

**Solutions**:
```typescript
// Enable WAL mode
db.pragma('journal_mode = WAL');

// Increase timeout
db.pragma('busy_timeout = 5000');  // 5 seconds

// Use transactions properly
const insert = db.transaction((data) => {
  // ... bulk operations
});
```

#### 2. FTS Search Returns No Results

**Check**:
1. FTS table is populated
```sql
SELECT COUNT(*) FROM history_fts;
```

2. Rebuild if needed
```sql
INSERT INTO history_fts(history_fts) VALUES('rebuild');
```

3. Check query syntax
```typescript
// Wrong
search("sunset landscape")  // May not work

// Correct
search("sunset AND landscape")
search("\"sunset landscape\"")  // Phrase search
```

#### 3. Metadata Not Found in Images

**Verify**:
```typescript
import sharp from 'sharp';

const metadata = await sharp(imagePath).metadata();
console.log(metadata.exif);  // Should contain data

// If null, check:
// 1. Metadata embedding is enabled
// 2. Image hasn't been re-encoded by other tools
// 3. Format supports metadata (PNG/JPEG/WebP)
```

#### 4. Performance Degradation

**Optimize**:
```bash
# 1. Check database size
ls -lh history.db

# 2. Vacuum
sqlite3 history.db "VACUUM;"

# 3. Analyze
sqlite3 history.db "ANALYZE;"

# 4. Check fragmentation
sqlite3 history.db "PRAGMA freelist_count;"
```

---

## Best Practices / ベストプラクティス

### 1. Always Use UUIDs

Never rely on auto-incrementing IDs. UUIDs are:
- Globally unique
- Mergeable across databases
- Privacy-preserving

### 2. Store Parameters as JSON

Keep the `parameters` column flexible:
```typescript
// Good ✅
{
  parameters: JSON.stringify({
    prompt: "...",
    size: "1024x1024",
    custom_field: "value"
  })
}

// Avoid ❌
{
  param1: "...",
  param2: "...",
  // Hard to extend
}
```

### 3. Implement Soft Deletes

Instead of DELETE, use a status flag:
```sql
ALTER TABLE history ADD COLUMN deleted BOOLEAN DEFAULT 0;

-- "Delete" record
UPDATE history SET deleted = 1 WHERE uuid = ?;

-- Filter in queries
SELECT * FROM history WHERE deleted = 0;
```

### 4. Regular Backups

- Daily automated backups
- Test restore procedures
- Store backups off-site

### 5. Monitor Database Growth

```typescript
function checkDatabaseHealth(): {size: number, record_count: number} {
  const size = fs.statSync('history.db').size;
  const count = db.prepare('SELECT COUNT(*) as count FROM history').get();

  return {
    size,
    record_count: count.count
  };
}

// Alert if > 1GB or > 100k records
```

---

## Environment Variables / 環境変数

### Recommended Configuration

```bash
# Database location
HISTORY_DB_PATH=/path/to/history.db

# Metadata embedding
EMBED_METADATA=true                    # Enable/disable
METADATA_LEVEL=standard                # minimal, standard, full

# Performance
DB_CACHE_SIZE=10000                    # SQLite cache size
DB_BUSY_TIMEOUT=5000                   # Lock timeout in ms

# Backup
BACKUP_ENABLED=true
BACKUP_DIR=/path/to/backups
BACKUP_RETENTION_DAYS=30
```

---

## Migration Guide / 移行ガイド

### From File-Based to Database

```typescript
async function migrateToDatabase(): Promise<void> {
  const historyManager = new HistoryManager('./history.db');

  // Read old JSON files
  const files = await fs.readdir('./history-files');

  for (const file of files) {
    const data = JSON.parse(await fs.readFile(file, 'utf-8'));

    await historyManager.createRecord({
      tool_name: data.tool,
      model: data.model,
      provider: data.provider || 'unknown',
      prompt: data.prompt,
      parameters: data.params,
      output_paths: [data.output_path],
      aspect_ratio: data.aspect_ratio,
      sample_count: 1
    });
  }

  console.log(`Migrated ${files.length} records`);
}
```

---

## Related Documentation / 関連ドキュメント

- [FEATURES_SPECIFICATION.md](./FEATURES_SPECIFICATION.md) - Complete feature spec
- [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) - Provider implementations
- [FEATURES_SUMMARY_JA.md](./FEATURES_SUMMARY_JA.md) - Japanese summary

---

## License / ライセンス

This guide is provided under MIT License. Feel free to adapt for your project.

---

**Document Version**: 1.0.0
**Last Updated**: 2025-10-15
**Maintainer**: Image Generation MCP Server Project
