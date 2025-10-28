/**
 * バッチ画像生成処理
 */

import { readFile } from 'fs/promises';
import type { GoogleAuth } from 'google-auth-library';
import type { JobDatabase } from './utils/database.js';
import type { JobManager } from './utils/jobManager.js';
import type { BatchConfig, BatchResult, BatchJobItem } from './types/batch.js';
import { batchJobItemToGenerateImageArgs } from './types/batch.js';
import { getDefaultOutputDirectory } from './utils/path.js';

/**
 * バッチ処理実行クラス
 */
export class BatchProcessor {
  private jobManager: JobManager;
  private jobDatabase: JobDatabase;
  private outputDir: string;

  constructor(
    jobManager: JobManager,
    jobDatabase: JobDatabase,
    outputDir?: string
  ) {
    this.jobManager = jobManager;
    this.jobDatabase = jobDatabase;
    this.outputDir = outputDir || getDefaultOutputDirectory();
  }

  /**
   * JSONファイルからバッチ設定を読み込む
   */
  async loadBatchConfig(filePath: string): Promise<BatchConfig> {
    const content = await readFile(filePath, 'utf-8');
    const config = JSON.parse(content) as BatchConfig;

    // バリデーション
    if (!config.jobs || !Array.isArray(config.jobs) || config.jobs.length === 0) {
      throw new Error('Invalid batch config: "jobs" array is required and must not be empty');
    }

    for (let i = 0; i < config.jobs.length; i++) {
      const job = config.jobs[i];
      if (!job.prompt || typeof job.prompt !== 'string') {
        throw new Error(`Invalid batch config: jobs[${i}].prompt is required and must be a string`);
      }
    }

    return config;
  }

  /**
   * バッチ処理を実行
   */
  async executeBatch(config: BatchConfig): Promise<BatchResult> {
    const startTime = Date.now();
    const jobIds: string[] = [];
    const outputDir = config.output_dir || this.outputDir;

    console.error(`[BATCH] Starting batch processing with ${config.jobs.length} jobs`);
    console.error(`[BATCH] Output directory: ${outputDir}`);

    // 全てのジョブを投入
    for (let i = 0; i < config.jobs.length; i++) {
      const item = config.jobs[i];
      const args = batchJobItemToGenerateImageArgs(item, outputDir);

      console.error(`[BATCH] Queueing job ${i + 1}/${config.jobs.length}: ${item.prompt.substring(0, 50)}...`);

      try {
        const jobId = this.jobManager.createJob('generate', args);
        jobIds.push(jobId);
      } catch (error) {
        console.error(`[BATCH] Failed to create job ${i + 1}:`, error);
        // エラーが発生してもジョブIDに空文字を追加して、インデックスを保持
        jobIds.push('');
      }
    }

    console.error(`[BATCH] All jobs queued. Waiting for completion...`);

    // ジョブの完了を待つ
    const timeout = config.timeout || 600000; // デフォルト10分
    const results = await this.waitForJobsCompletion(jobIds, config.jobs, timeout);

    const endTime = Date.now();
    const result: BatchResult = {
      total: config.jobs.length,
      succeeded: results.filter(r => r.status === 'completed').length,
      failed: results.filter(r => r.status === 'failed').length,
      results,
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date(endTime).toISOString(),
      total_duration_ms: endTime - startTime,
    };

    console.error(`[BATCH] Batch processing completed:`);
    console.error(`[BATCH]   Total: ${result.total}`);
    console.error(`[BATCH]   Succeeded: ${result.succeeded}`);
    console.error(`[BATCH]   Failed: ${result.failed}`);
    console.error(`[BATCH]   Duration: ${result.total_duration_ms}ms`);

    return result;
  }

  /**
   * 全てのジョブが完了するまで待機
   */
  private async waitForJobsCompletion(
    jobIds: string[],
    items: BatchJobItem[],
    timeout: number
  ): Promise<BatchResult['results']> {
    const results: BatchResult['results'] = [];
    const startTime = Date.now();
    const checkInterval = 2000; // 2秒ごとにチェック

    // 初期化：全てのジョブを結果配列に追加
    for (let i = 0; i < jobIds.length; i++) {
      results.push({
        job_id: jobIds[i] || 'N/A',
        prompt: items[i].prompt,
        status: 'failed',
        error: jobIds[i] ? undefined : 'Failed to create job',
      });
    }

    while (true) {
      // タイムアウトチェック
      if (Date.now() - startTime > timeout) {
        console.error('[BATCH] Timeout reached. Cancelling remaining jobs...');
        for (let i = 0; i < jobIds.length; i++) {
          const jobId = jobIds[i];
          if (!jobId) continue;
          const result = results[i];
          if (result.status !== 'completed' && result.status !== 'failed') {
            this.jobManager.cancelJob(jobId);
            result.status = 'cancelled';
            result.error = 'Timeout';
          }
        }
        break;
      }

      // 全てのジョブのステータスをチェック
      let allCompleted = true;
      for (let i = 0; i < jobIds.length; i++) {
        const jobId = jobIds[i];
        if (!jobId) continue; // スキップ（ジョブ作成失敗）

        const result = results[i];
        if (result.status === 'completed' || result.status === 'failed' || result.status === 'cancelled') {
          continue; // 既に完了
        }

        const job = this.jobDatabase.getJob(jobId);
        if (!job) {
          result.status = 'failed';
          result.error = 'Job not found';
          continue;
        }

        if (job.status === 'completed') {
          result.status = 'completed';
          // GenerateJobのresultはoutputPaths配列を持つので、最初の要素を取得
          result.output_path = job.result && 'outputPaths' in job.result
            ? job.result.outputPaths[0]
            : undefined;
          result.duration_ms = job.completedAt
            ? job.completedAt.getTime() - job.createdAt.getTime()
            : undefined;
        } else if (job.status === 'failed') {
          result.status = 'failed';
          // エラーメッセージを取得（空文字列や未定義の場合はデフォルトメッセージ）
          const errorMsg = job.error && job.error.trim() ? job.error : 'Job failed with no error message';
          result.error = errorMsg;
          result.duration_ms = job.completedAt
            ? job.completedAt.getTime() - job.createdAt.getTime()
            : undefined;

          // デバッグ: エラー内容を確認
          if (process.env.DEBUG) {
            console.error(`[DEBUG] Job ${jobId} failed. DB error field: "${job.error}", Using error: "${result.error}"`);
          }
        } else {
          allCompleted = false; // まだ実行中のジョブがある
        }
      }

      if (allCompleted) {
        break; // 全てのジョブが完了
      }

      // 進行状況を出力
      const completed = results.filter(r => r.status === 'completed').length;
      const failed = results.filter(r => r.status === 'failed' || r.status === 'cancelled').length;
      const pending = results.length - completed - failed;
      console.error(`[BATCH] Progress: ${completed} completed, ${failed} failed, ${pending} pending`);

      // 待機
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    return results;
  }

  /**
   * バッチ結果をJSON形式で出力
   */
  formatResultAsJson(result: BatchResult): string {
    return JSON.stringify(result, null, 2);
  }

  /**
   * バッチ結果を人間が読める形式で出力
   */
  formatResultAsText(result: BatchResult): string {
    const lines: string[] = [];
    lines.push('=== Batch Processing Result ===');
    lines.push(`Total Jobs: ${result.total}`);
    lines.push(`Succeeded: ${result.succeeded}`);
    lines.push(`Failed: ${result.failed}`);
    lines.push(`Duration: ${result.total_duration_ms}ms`);
    lines.push(`Started: ${result.started_at}`);
    lines.push(`Finished: ${result.finished_at}`);
    lines.push('');
    lines.push('=== Individual Results ===');

    for (let i = 0; i < result.results.length; i++) {
      const r = result.results[i];
      lines.push(`\n[${i + 1}/${result.results.length}] ${r.status.toUpperCase()}`);
      lines.push(`  Job ID: ${r.job_id}`);
      lines.push(`  Prompt: ${r.prompt}`);
      if (r.output_path) {
        lines.push(`  Output: ${r.output_path}`);
      }
      if (r.error && r.error.trim()) {
        lines.push(`  Error: ${r.error}`);
      } else if (r.status === 'failed' || r.status === 'cancelled') {
        // ステータスがfailed/cancelledなのにエラーメッセージがない場合
        lines.push(`  Error: No error message recorded`);
      }
      if (r.duration_ms !== undefined) {
        lines.push(`  Duration: ${r.duration_ms}ms`);
      }
    }

    return lines.join('\n');
  }
}
