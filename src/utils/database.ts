/**
 * SQLiteデータベース管理ユーティリティ
 */

import Database from 'better-sqlite3';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { Job, JobStatus, JobType } from '../types/job.js';
import type { ImageRecord, ListHistoryFilters } from '../types/history.js';
import { sanitizeFTS5Query } from './error.js';

export class JobDatabase {
  private db: Database.Database;

  // プリペアドステートメントのキャッシュ（パフォーマンス最適化）
  private statements: {
    createJob?: Database.Statement;
    getJob?: Database.Statement;
    updateJobStatus?: Database.Statement;
    updateJobResult?: Database.Statement;
    updateJobError?: Database.Statement;
    createImageHistory?: Database.Statement;
    getImageHistory?: Database.Statement;
    deleteImageHistory?: Database.Statement;
    updateImageFilePath?: Database.Statement;
    findImagesByParamsHash?: Database.Statement;
  } = {};

  constructor(dbPath: string) {
    // データベースディレクトリの作成
    const dbDir = dirname(dbPath);
    mkdir(dbDir, { recursive: true }).catch(() => {
      // ディレクトリが既に存在する場合は無視
    });

    this.db = new Database(dbPath);
    this.initialize();
    this.prepareStatements();
  }

  /**
   * プリペアドステートメントを事前準備（パフォーマンス最適化）
   */
  private prepareStatements(): void {
    this.statements.createJob = this.db.prepare(`
      INSERT INTO jobs (id, type, status, params, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    this.statements.getJob = this.db.prepare(`
      SELECT * FROM jobs WHERE id = ?
    `);

    this.statements.updateJobStatus = this.db.prepare(`
      UPDATE jobs
      SET status = ?, started_at = ?, completed_at = ?
      WHERE id = ?
    `);

    this.statements.updateJobResult = this.db.prepare(`
      UPDATE jobs
      SET result = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    this.statements.updateJobError = this.db.prepare(`
      UPDATE jobs
      SET error = ?, status = 'failed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    this.statements.createImageHistory = this.db.prepare(`
      INSERT INTO images (
        uuid, file_path, tool_name, prompt, created_at,
        model, aspect_ratio, sample_count, sample_image_size,
        safety_level, person_generation, language,
        parameters, params_hash,
        success, error_message,
        file_size, mime_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.statements.getImageHistory = this.db.prepare(`
      SELECT * FROM images WHERE uuid = ?
    `);

    this.statements.deleteImageHistory = this.db.prepare(`
      DELETE FROM images WHERE uuid = ?
    `);

    this.statements.updateImageFilePath = this.db.prepare(`
      UPDATE images SET file_path = ? WHERE uuid = ?
    `);

    this.statements.findImagesByParamsHash = this.db.prepare(`
      SELECT * FROM images WHERE params_hash = ? ORDER BY created_at DESC
    `);
  }

  /**
   * データベースの初期化（テーブル作成）
   */
  private initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        params TEXT NOT NULL,
        result TEXT,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME
      );

      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);

      -- 画像履歴テーブル
      CREATE TABLE IF NOT EXISTS images (
        uuid TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        model TEXT,
        aspect_ratio TEXT,
        sample_count INTEGER,
        sample_image_size TEXT,
        safety_level TEXT,
        person_generation TEXT,
        language TEXT,

        parameters TEXT NOT NULL,
        params_hash TEXT NOT NULL,

        success BOOLEAN DEFAULT 1,
        error_message TEXT,

        file_size INTEGER,
        mime_type TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_images_tool_name ON images(tool_name);
      CREATE INDEX IF NOT EXISTS idx_images_model ON images(model);
      CREATE INDEX IF NOT EXISTS idx_images_params_hash ON images(params_hash);

      -- 複合インデックス（フィルタ付き検索の高速化）
      CREATE INDEX IF NOT EXISTS idx_images_tool_created ON images(tool_name, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_images_model_created ON images(model, created_at DESC);

      -- フルテキスト検索テーブル
      CREATE VIRTUAL TABLE IF NOT EXISTS images_fts USING fts5(
        uuid,
        prompt,
        parameters,
        content='images',
        content_rowid='rowid'
      );

      -- FTS5トリガー: 挿入時
      CREATE TRIGGER IF NOT EXISTS images_fts_insert AFTER INSERT ON images BEGIN
        INSERT INTO images_fts(rowid, uuid, prompt, parameters)
        VALUES (new.rowid, new.uuid, new.prompt, new.parameters);
      END;

      -- FTS5トリガー: 削除時
      CREATE TRIGGER IF NOT EXISTS images_fts_delete AFTER DELETE ON images BEGIN
        DELETE FROM images_fts WHERE rowid = old.rowid;
      END;

      -- FTS5トリガー: 更新時
      CREATE TRIGGER IF NOT EXISTS images_fts_update AFTER UPDATE ON images BEGIN
        UPDATE images_fts SET uuid = new.uuid, prompt = new.prompt, parameters = new.parameters
        WHERE rowid = new.rowid;
      END;
    `);
  }

  /**
   * ジョブを作成
   */
  createJob(job: Job): void {
    this.statements.createJob!.run(
      job.id,
      job.type,
      job.status,
      JSON.stringify(job.params),
      job.createdAt.toISOString()
    );
  }

  /**
   * ジョブをIDで取得
   */
  getJob(jobId: string): Job | null {
    const row = this.statements.getJob!.get(jobId) as any;
    if (!row) return null;

    return this.rowToJob(row);
  }

  /**
   * ジョブステータスを更新
   */
  updateJobStatus(jobId: string, status: JobStatus, startedAt?: Date, completedAt?: Date): void {
    this.statements.updateJobStatus!.run(
      status,
      startedAt?.toISOString() || null,
      completedAt?.toISOString() || null,
      jobId
    );
  }

  /**
   * ジョブ結果を更新
   */
  updateJobResult(jobId: string, result: any): void {
    this.statements.updateJobResult!.run(JSON.stringify(result), jobId);
  }

  /**
   * ジョブエラーを更新
   */
  updateJobError(jobId: string, error: string): void {
    this.statements.updateJobError!.run(error, jobId);
  }

  /**
   * ジョブ一覧を取得
   */
  listJobs(status?: JobStatus, limit: number = 50): Job[] {
    let query = 'SELECT * FROM jobs';
    const params: any[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => this.rowToJob(row));
  }

  /**
   * 実行中のジョブを取得
   */
  getRunningJobs(): Job[] {
    const stmt = this.db.prepare(`
      SELECT * FROM jobs WHERE status IN ('pending', 'running')
      ORDER BY created_at ASC
    `);

    const rows = stmt.all() as any[];
    return rows.map(row => this.rowToJob(row));
  }

  /**
   * データベース行をJobオブジェクトに変換
   */
  private rowToJob(row: any): Job {
    const base = {
      id: row.id,
      type: row.type as JobType,
      status: row.status as JobStatus,
      createdAt: new Date(row.created_at),
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      error: row.error || undefined,
    };

    const params = JSON.parse(row.params);
    const result = row.result ? JSON.parse(row.result) : undefined;

    return {
      ...base,
      params,
      result,
    } as Job;
  }

  /**
   * トランザクション内で関数を実行
   * 成功時に自動コミット、エラー時にロールバック
   */
  transaction<T>(fn: () => T): T {
    const txn = this.db.transaction(fn);
    return txn();
  }

  /**
   * データベース接続を閉じる
   */
  close(): void {
    this.db.close();
  }

  // =====================================
  // 画像履歴管理メソッド
  // =====================================

  /**
   * 画像履歴を作成
   */
  createImageHistory(record: Omit<ImageRecord, 'createdAt'> & { createdAt?: Date }): void {
    this.statements.createImageHistory!.run(
      record.uuid,
      record.filePath,
      record.toolName,
      record.prompt,
      record.createdAt ? record.createdAt.toISOString() : new Date().toISOString(),
      record.model || null,
      record.aspectRatio || null,
      record.sampleCount || null,
      record.sampleImageSize || null,
      record.safetyLevel || null,
      record.personGeneration || null,
      record.language || null,
      record.parameters,
      record.paramsHash,
      record.success ? 1 : 0,
      record.errorMessage || null,
      record.fileSize || null,
      record.mimeType || null
    );
  }

  /**
   * 画像履歴をUUIDで取得
   */
  getImageHistory(uuid: string): ImageRecord | null {
    const row = this.statements.getImageHistory!.get(uuid) as any;
    if (!row) return null;

    return this.rowToImageRecord(row);
  }

  /**
   * 画像履歴一覧を取得
   */
  listImageHistory(
    filters?: ListHistoryFilters,
    sortBy: 'created_at' | 'file_size' = 'created_at',
    sortOrder: 'asc' | 'desc' = 'desc',
    limit: number = 50,
    offset: number = 0
  ): ImageRecord[] {
    let query = 'SELECT * FROM images WHERE 1=1';
    const params: any[] = [];

    if (filters) {
      if (filters.tool_name) {
        query += ' AND tool_name = ?';
        params.push(filters.tool_name);
      }
      if (filters.model) {
        query += ' AND model = ?';
        params.push(filters.model);
      }
      if (filters.aspect_ratio) {
        query += ' AND aspect_ratio = ?';
        params.push(filters.aspect_ratio);
      }
      if (filters.date_from) {
        query += ' AND created_at >= ?';
        params.push(filters.date_from);
      }
      if (filters.date_to) {
        query += ' AND created_at <= ?';
        params.push(filters.date_to);
      }
    }

    query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => this.rowToImageRecord(row));
  }

  /**
   * 画像履歴を検索（フルテキスト検索）
   */
  searchImageHistory(
    searchQuery: string,
    filters?: ListHistoryFilters,
    limit: number = 50
  ): ImageRecord[] {
    // FTS5クエリをサニタイズ（構文エラー防止）
    const sanitizedQuery = sanitizeFTS5Query(searchQuery);

    let query = `
      SELECT images.* FROM images
      INNER JOIN images_fts ON images.rowid = images_fts.rowid
      WHERE images_fts MATCH ?
    `;
    const params: any[] = [sanitizedQuery];

    if (filters) {
      if (filters.tool_name) {
        query += ' AND images.tool_name = ?';
        params.push(filters.tool_name);
      }
      if (filters.model) {
        query += ' AND images.model = ?';
        params.push(filters.model);
      }
      if (filters.aspect_ratio) {
        query += ' AND images.aspect_ratio = ?';
        params.push(filters.aspect_ratio);
      }
      if (filters.date_from) {
        query += ' AND images.created_at >= ?';
        params.push(filters.date_from);
      }
      if (filters.date_to) {
        query += ' AND images.created_at <= ?';
        params.push(filters.date_to);
      }
    }

    query += ' ORDER BY images.created_at DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => this.rowToImageRecord(row));
  }

  /**
   * 画像履歴を削除
   */
  deleteImageHistory(uuid: string): boolean {
    const result = this.statements.deleteImageHistory!.run(uuid);
    return result.changes > 0;
  }

  /**
   * パラメータハッシュで画像履歴を検索
   */
  findImagesByParamsHash(paramsHash: string): ImageRecord[] {
    const rows = this.statements.findImagesByParamsHash!.all(paramsHash) as any[];
    return rows.map(row => this.rowToImageRecord(row));
  }

  /**
   * 画像履歴のファイルパスを更新
   */
  updateImageFilePath(uuid: string, newFilePath: string): boolean {
    const result = this.statements.updateImageFilePath!.run(newFilePath, uuid);
    return result.changes > 0;
  }

  /**
   * データベース行をImageRecordオブジェクトに変換
   */
  private rowToImageRecord(row: any): ImageRecord {
    return {
      uuid: row.uuid,
      filePath: row.file_path,
      toolName: row.tool_name,
      prompt: row.prompt,
      createdAt: new Date(row.created_at),
      model: row.model || undefined,
      aspectRatio: row.aspect_ratio || undefined,
      sampleCount: row.sample_count || undefined,
      sampleImageSize: row.sample_image_size || undefined,
      safetyLevel: row.safety_level || undefined,
      personGeneration: row.person_generation || undefined,
      language: row.language || undefined,
      parameters: row.parameters,
      paramsHash: row.params_hash,
      success: row.success === 1,
      errorMessage: row.error_message || undefined,
      fileSize: row.file_size || undefined,
      mimeType: row.mime_type || undefined,
    };
  }
}
