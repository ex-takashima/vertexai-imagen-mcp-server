/**
 * SQLiteデータベース管理ユーティリティ
 */

import Database from 'better-sqlite3';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { Job, JobStatus, JobType } from '../types/job.js';

export class JobDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    // データベースディレクトリの作成
    const dbDir = dirname(dbPath);
    mkdir(dbDir, { recursive: true }).catch(() => {
      // ディレクトリが既に存在する場合は無視
    });

    this.db = new Database(dbPath);
    this.initialize();
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
    `);
  }

  /**
   * ジョブを作成
   */
  createJob(job: Job): void {
    const stmt = this.db.prepare(`
      INSERT INTO jobs (id, type, status, params, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
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
    const stmt = this.db.prepare(`
      SELECT * FROM jobs WHERE id = ?
    `);

    const row = stmt.get(jobId) as any;
    if (!row) return null;

    return this.rowToJob(row);
  }

  /**
   * ジョブステータスを更新
   */
  updateJobStatus(jobId: string, status: JobStatus, startedAt?: Date, completedAt?: Date): void {
    const stmt = this.db.prepare(`
      UPDATE jobs
      SET status = ?, started_at = ?, completed_at = ?
      WHERE id = ?
    `);

    stmt.run(
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
    const stmt = this.db.prepare(`
      UPDATE jobs
      SET result = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(JSON.stringify(result), jobId);
  }

  /**
   * ジョブエラーを更新
   */
  updateJobError(jobId: string, error: string): void {
    const stmt = this.db.prepare(`
      UPDATE jobs
      SET error = ?, status = 'failed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(error, jobId);
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
   * データベース接続を閉じる
   */
  close(): void {
    this.db.close();
  }
}
