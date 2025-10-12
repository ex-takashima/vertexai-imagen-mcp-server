/**
 * ジョブキュー管理とワーカー
 */

import { randomUUID } from 'crypto';
import type { GoogleAuth } from 'google-auth-library';
import type { JobDatabase } from './database.js';
import type { ImageResourceManager } from './resources.js';
import type { Job, JobType } from '../types/job.js';
import type {
  GenerateImageArgs,
  EditImageArgs,
  CustomizeImageArgs,
  UpscaleImageArgs,
  GenerateAndUpscaleImageArgs,
} from '../types/tools.js';
import { generateImage } from '../tools/generateImage.js';
import { editImage } from '../tools/editImage.js';
import { customizeImage } from '../tools/customizeImage.js';
import { upscaleImage } from '../tools/upscaleImage.js';
import { generateAndUpscaleImage } from '../tools/generateAndUpscaleImage.js';

export class JobManager {
  private db: JobDatabase;
  private auth: GoogleAuth;
  private resourceManager: ImageResourceManager;
  private maxConcurrentJobs: number;
  private runningJobs: Set<string> = new Set();
  private cancelledJobs: Set<string> = new Set();

  constructor(
    db: JobDatabase,
    auth: GoogleAuth,
    resourceManager: ImageResourceManager,
    maxConcurrentJobs: number = 2
  ) {
    this.db = db;
    this.auth = auth;
    this.resourceManager = resourceManager;
    this.maxConcurrentJobs = maxConcurrentJobs;

    // 起動時に未完了のジョブを再開
    this.resumePendingJobs();
  }

  /**
   * 新しいジョブを作成
   */
  createJob(
    type: JobType,
    params: GenerateImageArgs | EditImageArgs | CustomizeImageArgs | UpscaleImageArgs | GenerateAndUpscaleImageArgs
  ): string {
    const jobId = randomUUID();
    const job: Job = {
      id: jobId,
      type,
      status: 'pending',
      createdAt: new Date(),
      params,
    } as Job;

    this.db.createJob(job);

    // ジョブ実行を開始
    this.processJobs();

    return jobId;
  }

  /**
   * ジョブを取得
   */
  getJob(jobId: string): Job | null {
    return this.db.getJob(jobId);
  }

  /**
   * ジョブ一覧を取得
   */
  listJobs(status?: 'pending' | 'running' | 'completed' | 'failed', limit?: number): Job[] {
    return this.db.listJobs(status, limit);
  }

  /**
   * ジョブをキャンセル
   */
  cancelJob(jobId: string): boolean {
    const job = this.db.getJob(jobId);
    if (!job) return false;

    if (job.status === 'completed' || job.status === 'failed') {
      return false; // 既に完了またはfailedの場合はキャンセル不可
    }

    this.cancelledJobs.add(jobId);

    if (job.status === 'pending') {
      // pendingの場合は即座にfailedに設定
      this.db.updateJobError(jobId, 'Job cancelled by user');
    }
    // runningの場合は実行中のジョブが自身でキャンセルをチェック

    return true;
  }

  /**
   * 未完了のジョブを再開
   */
  private resumePendingJobs(): void {
    const pendingJobs = this.db.getRunningJobs();
    if (pendingJobs.length > 0) {
      if (process.env.DEBUG) {
        console.error(`[DEBUG] Resuming ${pendingJobs.length} pending job(s)`);
      }
      // pending/runningステータスのジョブをpendingにリセット
      for (const job of pendingJobs) {
        if (job.status === 'running') {
          this.db.updateJobStatus(job.id, 'pending');
        }
      }
      this.processJobs();
    }
  }

  /**
   * ジョブキューを処理
   */
  private async processJobs(): Promise<void> {
    // 同時実行数の制限チェック
    if (this.runningJobs.size >= this.maxConcurrentJobs) {
      return;
    }

    const pendingJobs = this.db.getRunningJobs();
    const availableSlots = this.maxConcurrentJobs - this.runningJobs.size;

    const jobsToProcess = pendingJobs
      .filter(job => job.status === 'pending')
      .slice(0, availableSlots);

    for (const job of jobsToProcess) {
      this.executeJob(job);
    }
  }

  /**
   * ジョブを実行
   */
  private async executeJob(job: Job): Promise<void> {
    const jobId = job.id;

    // キャンセルチェック
    if (this.cancelledJobs.has(jobId)) {
      this.db.updateJobError(jobId, 'Job cancelled by user');
      this.cancelledJobs.delete(jobId);
      return;
    }

    this.runningJobs.add(jobId);
    this.db.updateJobStatus(jobId, 'running', new Date());

    try {
      const context = {
        auth: this.auth,
        resourceManager: this.resourceManager,
        jobManager: this, // 自身を参照（循環参照だが、実行時には既にインスタンス化されている）
      };

      let result: any;

      switch (job.type) {
        case 'generate':
          result = await generateImage(context, job.params as GenerateImageArgs);
          break;
        case 'edit':
          result = await editImage(context, job.params as EditImageArgs);
          break;
        case 'customize':
          result = await customizeImage(context, job.params as CustomizeImageArgs);
          break;
        case 'upscale':
          result = await upscaleImage(context, job.params as UpscaleImageArgs);
          break;
        case 'generate_and_upscale':
          result = await generateAndUpscaleImage(context, job.params as GenerateAndUpscaleImageArgs);
          break;
        default:
          throw new Error(`Unknown job type: ${(job as any).type}`);
      }

      // 再度キャンセルチェック
      if (this.cancelledJobs.has(jobId)) {
        this.db.updateJobError(jobId, 'Job cancelled by user');
        this.cancelledJobs.delete(jobId);
      } else {
        // 結果からURI情報を抽出
        const jobResult = this.extractJobResult(result);
        this.db.updateJobResult(jobId, jobResult);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.db.updateJobError(jobId, errorMessage);

      if (process.env.DEBUG) {
        console.error(`[DEBUG] Job ${jobId} failed: ${errorMessage}`);
      }
    } finally {
      this.runningJobs.delete(jobId);
      this.cancelledJobs.delete(jobId);

      // 次のジョブを処理
      this.processJobs();
    }
  }

  /**
   * ツール実行結果からジョブ結果を抽出
   */
  private extractJobResult(toolResult: any): any {
    // MCPレスポンス形式から実際のデータを抽出
    if (!toolResult || !toolResult.content || toolResult.content.length === 0) {
      throw new Error('Invalid tool result format');
    }

    const content = toolResult.content[0];

    if (content.type === 'resource') {
      // 単一画像の場合
      return {
        outputPath: content.resource.uri,
        uri: content.resource.uri,
        mimeType: content.resource.mimeType,
      };
    } else if (content.type === 'text') {
      // 複数画像または詳細情報を含むテキスト
      const text = content.text;

      // URIを抽出（file://で始まる行を探す）
      const uriMatches = text.match(/file:\/\/[^\s\n]+/g);
      if (uriMatches) {
        return {
          outputPaths: uriMatches,
          uris: uriMatches,
          mimeType: 'image/png', // デフォルト
        };
      }

      return {
        message: text,
      };
    }

    return toolResult;
  }
}
