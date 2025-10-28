/**
 * バッチ処理型定義
 */

import type { GenerateImageArgs } from './tools.js';

/**
 * 単一バッチジョブ項目
 */
export interface BatchJobItem {
  /** プロンプト（必須） */
  prompt: string;
  /** 出力ファイル名（ファイル名のみ、パスは含まない） */
  output_filename?: string;
  /** アスペクト比 */
  aspect_ratio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  /** 安全性フィルターレベル */
  safety_level?: "BLOCK_NONE" | "BLOCK_ONLY_HIGH" | "BLOCK_MEDIUM_AND_ABOVE" | "BLOCK_LOW_AND_ABOVE";
  /** 人物生成ポリシー */
  person_generation?: "DONT_ALLOW" | "ALLOW_ADULT" | "ALLOW_ALL";
  /** 言語設定 */
  language?: "auto" | "en" | "zh" | "zh-TW" | "hi" | "ja" | "ko" | "pt" | "es";
  /** 使用モデル */
  model?: "imagen-4.0-ultra-generate-001" | "imagen-4.0-fast-generate-001" | "imagen-4.0-generate-001" | "imagen-3.0-generate-002" | "imagen-3.0-fast-generate-001";
  /** リージョン */
  region?: string;
  /** サンプル数 */
  sample_count?: number;
  /** サンプル画像サイズ */
  sample_image_size?: "1K" | "2K";
  /** サムネイル生成 */
  include_thumbnail?: boolean;
}

/**
 * バッチ処理設定
 */
export interface BatchConfig {
  /** バッチジョブのリスト */
  jobs: BatchJobItem[];
  /** 出力ディレクトリ（環境変数で上書き可能） */
  output_dir?: string;
  /** 最大同時実行数（環境変数で上書き可能） */
  max_concurrent?: number;
  /** タイムアウト（ミリ秒） */
  timeout?: number;
}

/**
 * バッチ処理結果
 */
export interface BatchResult {
  /** 総ジョブ数 */
  total: number;
  /** 成功したジョブ数 */
  succeeded: number;
  /** 失敗したジョブ数 */
  failed: number;
  /** 個別結果 */
  results: Array<{
    /** ジョブID */
    job_id: string;
    /** プロンプト */
    prompt: string;
    /** ステータス */
    status: 'completed' | 'failed' | 'cancelled';
    /** 出力ファイルパス（成功時） */
    output_path?: string;
    /** エラーメッセージ（失敗時） */
    error?: string;
    /** 生成時間（ミリ秒） */
    duration_ms?: number;
  }>;
  /** 開始時刻 */
  started_at: string;
  /** 終了時刻 */
  finished_at: string;
  /** 総実行時間（ミリ秒） */
  total_duration_ms: number;
}

/**
 * バッチジョブ項目からGenerateImageArgsへの変換
 */
export function batchJobItemToGenerateImageArgs(
  item: BatchJobItem,
  outputDir: string
): GenerateImageArgs {
  const output_path = item.output_filename
    ? `${outputDir}/${item.output_filename}`
    : undefined;

  return {
    prompt: item.prompt,
    output_path,
    aspect_ratio: item.aspect_ratio,
    safety_level: item.safety_level,
    person_generation: item.person_generation,
    language: item.language,
    model: item.model,
    region: item.region,
    sample_count: item.sample_count,
    sample_image_size: item.sample_image_size,
    include_thumbnail: item.include_thumbnail,
    return_base64: false,
  };
}
