/**
 * History Database Manager
 *
 * SQLite-based history management with full-text search support
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { HistoryRecord, ListHistoryArgs, SearchHistoryArgs } from '../types/index.js';

export class HistoryDatabase {
  private db: Database.Database;
  private insertStmt: Database.Statement;
  private selectByUuidStmt: Database.Statement;

  constructor(dbPath: string) {
    // Ensure directory exists
    this.ensureDirectoryExists(dbPath);

    this.db = new Database(dbPath);

    // Configure database for performance
    this.db.pragma('journal_mode = WAL');  // Write-Ahead Logging
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 10000');
    this.db.pragma('busy_timeout = 5000');

    // Create schema
    this.setupDatabase();

    // Prepare statements
    this.prepareStatements();
  }

  private ensureDirectoryExists(dbPath: string): void {
    const dir = dirname(dbPath);
    mkdir(dir, { recursive: true }).catch(() => {
      // Directory might already exist
    });
  }

  private setupDatabase(): void {
    // Main history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS history (
        uuid TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        tool_name TEXT NOT NULL,
        model TEXT,
        provider TEXT,

        prompt TEXT NOT NULL,
        negative_prompt TEXT,

        parameters TEXT NOT NULL,
        params_hash TEXT NOT NULL,

        output_paths TEXT NOT NULL,
        file_sizes INTEGER,
        mime_types TEXT,

        aspect_ratio TEXT,
        sample_count INTEGER DEFAULT 1,
        sample_image_size TEXT,

        success BOOLEAN DEFAULT 1,
        error_message TEXT,

        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_history_tool_name ON history(tool_name);
      CREATE INDEX IF NOT EXISTS idx_history_model ON history(model);
      CREATE INDEX IF NOT EXISTS idx_history_provider ON history(provider);
      CREATE INDEX IF NOT EXISTS idx_history_params_hash ON history(params_hash);
    `);

    // Full-text search table
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS history_fts USING fts5(
        uuid UNINDEXED,
        prompt,
        negative_prompt,
        parameters,
        content='history',
        content_rowid='rowid'
      );
    `);

    // Triggers to keep FTS in sync
    this.db.exec(`
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
    `);
  }

  private prepareStatements(): void {
    this.insertStmt = this.db.prepare(`
      INSERT INTO history (
        uuid, tool_name, model, provider, prompt, negative_prompt,
        parameters, params_hash, output_paths, file_sizes, mime_types,
        aspect_ratio, sample_count, sample_image_size, created_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.selectByUuidStmt = this.db.prepare('SELECT * FROM history WHERE uuid = ?');
  }

  /**
   * Create a new history record
   */
  createRecord(data: {
    tool_name: string;
    model: string;
    provider: string;
    prompt: string;
    negative_prompt?: string;
    parameters: Record<string, any>;
    output_paths: string[];
    file_sizes?: number;
    mime_types?: string;
    aspect_ratio?: string;
    sample_count?: number;
    sample_image_size?: string;
    metadata?: Record<string, any>;
  }): string {
    const uuid = uuidv4();
    const params_hash = this.calculateHash(data.parameters);
    const created_at = new Date().toISOString();

    this.insertStmt.run(
      uuid,
      data.tool_name,
      data.model,
      data.provider,
      data.prompt,
      data.negative_prompt || null,
      JSON.stringify(data.parameters),
      params_hash,
      JSON.stringify(data.output_paths),
      data.file_sizes || null,
      data.mime_types || null,
      data.aspect_ratio || null,
      data.sample_count || 1,
      data.sample_image_size || null,
      created_at,
      data.metadata ? JSON.stringify(data.metadata) : null
    );

    return uuid;
  }

  /**
   * List history records with filtering and sorting
   */
  list(args: ListHistoryArgs): HistoryRecord[] {
    let sql = 'SELECT * FROM history WHERE 1=1';
    const params: any[] = [];

    // Apply filters
    if (args.filters?.tool_name) {
      sql += ' AND tool_name = ?';
      params.push(args.filters.tool_name);
    }

    if (args.filters?.model) {
      sql += ' AND model = ?';
      params.push(args.filters.model);
    }

    if (args.filters?.provider) {
      sql += ' AND provider = ?';
      params.push(args.filters.provider);
    }

    if (args.filters?.aspect_ratio) {
      sql += ' AND aspect_ratio = ?';
      params.push(args.filters.aspect_ratio);
    }

    if (args.filters?.date_from) {
      sql += ' AND created_at >= ?';
      params.push(args.filters.date_from);
    }

    if (args.filters?.date_to) {
      sql += ' AND created_at <= ?';
      params.push(args.filters.date_to);
    }

    // Apply sorting
    const sortBy = args.sort_by || 'created_at';
    const sortOrder = (args.sort_order || 'desc').toUpperCase();
    sql += ` ORDER BY ${sortBy} ${sortOrder}`;

    // Apply pagination
    const limit = args.limit || 50;
    sql += ` LIMIT ${limit}`;

    if (args.offset) {
      sql += ` OFFSET ${args.offset}`;
    }

    const rows = this.db.prepare(sql).all(...params);
    return rows.map(row => this.parseRecord(row));
  }

  /**
   * Get a specific record by UUID
   */
  getByUuid(uuid: string): HistoryRecord | null {
    const row = this.selectByUuidStmt.get(uuid);
    if (!row) return null;
    return this.parseRecord(row);
  }

  /**
   * Full-text search across prompts and parameters
   */
  search(args: SearchHistoryArgs): HistoryRecord[] {
    let sql = `
      SELECT h.* FROM history h
      JOIN history_fts fts ON h.rowid = fts.rowid
      WHERE history_fts MATCH ?
    `;

    const params: any[] = [args.query];

    // Apply additional filters
    if (args.filters?.tool_name) {
      sql += ' AND h.tool_name = ?';
      params.push(args.filters.tool_name);
    }

    if (args.filters?.model) {
      sql += ' AND h.model = ?';
      params.push(args.filters.model);
    }

    if (args.filters?.provider) {
      sql += ' AND h.provider = ?';
      params.push(args.filters.provider);
    }

    if (args.filters?.date_from) {
      sql += ' AND h.created_at >= ?';
      params.push(args.filters.date_from);
    }

    if (args.filters?.date_to) {
      sql += ' AND h.created_at <= ?';
      params.push(args.filters.date_to);
    }

    sql += ' ORDER BY h.created_at DESC';
    sql += ` LIMIT ${args.limit || 50}`;

    const rows = this.db.prepare(sql).all(...params);
    return rows.map(row => this.parseRecord(row));
  }

  /**
   * Calculate SHA-256 hash of parameters
   */
  private calculateHash(params: Record<string, any>): string {
    // Sort keys for consistent hashing
    const sorted = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, any>);

    const paramsString = JSON.stringify(sorted);
    return crypto.createHash('sha256').update(paramsString).digest('hex');
  }

  /**
   * Parse database row into HistoryRecord
   */
  private parseRecord(row: any): HistoryRecord {
    return {
      uuid: row.uuid,
      tool_name: row.tool_name,
      model: row.model,
      provider: row.provider,
      prompt: row.prompt,
      negative_prompt: row.negative_prompt,
      parameters: JSON.parse(row.parameters),
      params_hash: row.params_hash,
      output_paths: JSON.parse(row.output_paths),
      file_sizes: row.file_sizes,
      mime_types: row.mime_types,
      aspect_ratio: row.aspect_ratio,
      sample_count: row.sample_count,
      sample_image_size: row.sample_image_size,
      created_at: row.created_at,
      success: Boolean(row.success),
      error_message: row.error_message,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  /**
   * Perform database maintenance (vacuum, analyze, rebuild FTS)
   */
  performMaintenance(): void {
    console.log('[HistoryDatabase] Performing maintenance...');

    // Rebuild FTS index
    this.db.exec("INSERT INTO history_fts(history_fts) VALUES('rebuild')");

    // Vacuum (reclaim space)
    this.db.exec('VACUUM');

    // Analyze (update statistics)
    this.db.exec('ANALYZE');

    // Checkpoint WAL
    this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');

    console.log('[HistoryDatabase] Maintenance completed');
  }

  /**
   * Get database statistics
   */
  getStats(): { size: number; recordCount: number; dbPath: string } {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM history').get() as { count: number };

    return {
      size: 0,  // Would need fs.statSync to get actual size
      recordCount: result.count,
      dbPath: this.db.name
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
