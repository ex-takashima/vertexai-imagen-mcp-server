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
import { logErrorWithStack, getErrorMessage } from './error.js';

export class JobManager {
  private db: JobDatabase;
  private auth: GoogleAuth;
  private resourceManager: ImageResourceManager;
  private maxConcurrentJobs: number;
  private runningJobs: Set<string> = new Set();
  private cancelledJobs: Set<string> = new Set();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private processingLock: boolean = false;

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

    // 定期的にcancelledJobsをクリーンアップ（メモリリーク防止）
    this.cleanupInterval = setInterval(() => {
      this.cleanupCancelledJobs();
    }, 600000); // 10分ごと
  }

  /**
   * 新しいジョブを作成
   */
  createJob(
    type: JobType,
    params: Record<string, any>
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
      // pending/runningステータスのジョブをpendingにリセット（トランザクション内で実行）
      this.db.transaction(() => {
        for (const job of pendingJobs) {
          if (job.status === 'running') {
            this.db.updateJobStatus(job.id, 'pending');
          }
        }
      });
      this.processJobs();
    }
  }

  /**
   * ジョブキューを処理
   *
   * Race condition防止のため、ロック機構を使用して並行実行を防止
   */
  private async processJobs(): Promise<void> {
    // ロックチェック：既に処理中の場合は即座にリターン
    if (this.processingLock) {
      return;
    }

    this.processingLock = true;

    try {
      // 空きスロットがある限り、pendingジョブを1つずつ処理
      while (this.runningJobs.size < this.maxConcurrentJobs) {
        const pendingJobs = this.db.getRunningJobs();

        // pending状態で、かつまだrunningJobsに登録されていないジョブを検索
        const job = pendingJobs.find(j =>
          j.status === 'pending' && !this.runningJobs.has(j.id)
        );

        if (!job) {
          // 処理可能なジョブがない場合は終了
          break;
        }

        // アトミックに実行中としてマーク（重複実行を防止）
        this.runningJobs.add(job.id);
        this.db.updateJobStatus(job.id, 'running', new Date());

        // ジョブを非同期実行（awaitしない = fire and forget）
        // Promise内部でエラーハンドリングとクリーンアップを実行
        this.executeJob(job);
      }
    } finally {
      // 必ずロックを解放
      this.processingLock = false;
    }
  }

  /**
   * ジョブを実行
   *
   * 注意: processJobs()内で既にrunningJobsへの追加とステータス更新が完了しているため、
   * このメソッドではそれらの処理は行わない
   */
  private async executeJob(job: Job): Promise<void> {
    const jobId = job.id;

    // キャンセルチェック
    if (this.cancelledJobs.has(jobId)) {
      this.db.updateJobError(jobId, 'Job cancelled by user');
      this.cancelledJobs.delete(jobId);
      this.runningJobs.delete(jobId);
      // 次のジョブを処理
      this.processJobs();
      return;
    }

    try {
      const context = {
        auth: this.auth,
        resourceManager: this.resourceManager,
        jobManager: this, // 自身を参照（循環参照だが、実行時には既にインスタンス化されている）
        historyDb: this.db, // 履歴トラッキング用
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
      const errorMessage = getErrorMessage(error);
      this.db.updateJobError(jobId, errorMessage);

      // エラーをスタックトレース付きでログ出力
      logErrorWithStack(`Job ${jobId} failed`, error);
    } finally {
      this.runningJobs.delete(jobId);
      this.cancelledJobs.delete(jobId);

      // 次のジョブを処理
      this.processJobs();
    }
  }

  /**
   * cancelledJobsをクリーンアップ（メモリリーク防止）
   * 完了済みの古いジョブをSetから削除
   */
  private cleanupCancelledJobs(): void {
    const OLD_JOB_THRESHOLD = 3600000; // 1時間
    const now = Date.now();

    for (const jobId of this.cancelledJobs) {
      const job = this.db.getJob(jobId);

      // ジョブが存在しない、または完了して1時間以上経過している場合は削除
      if (!job ||
          (job.completedAt && (now - job.completedAt.getTime() > OLD_JOB_THRESHOLD))) {
        this.cancelledJobs.delete(jobId);

        if (process.env.DEBUG) {
          console.error(`[DEBUG] Cleaned up cancelled job: ${jobId}`);
        }
      }
    }
  }

  /**
   * JobManagerを破棄（クリーンアップインターバルを停止）
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
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
