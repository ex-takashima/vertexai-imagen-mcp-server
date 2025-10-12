/**
 * ジョブ管理システムの型定義
 */

import type {
  GenerateImageArgs,
  EditImageArgs,
  CustomizeImageArgs,
  UpscaleImageArgs,
  GenerateAndUpscaleImageArgs,
} from './tools.js';

export type JobType = 'generate' | 'edit' | 'customize' | 'upscale' | 'generate_and_upscale';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface JobBase {
  id: string;
  type: JobType;
  status: JobStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface GenerateJob extends JobBase {
  type: 'generate';
  params: GenerateImageArgs;
  result?: {
    outputPaths: string[];
    uris: string[];
    mimeType: string;
  };
}

export interface EditJob extends JobBase {
  type: 'edit';
  params: EditImageArgs;
  result?: {
    outputPaths: string[];
    uris: string[];
    mimeType: string;
  };
}

export interface CustomizeJob extends JobBase {
  type: 'customize';
  params: CustomizeImageArgs;
  result?: {
    outputPaths: string[];
    uris: string[];
    mimeType: string;
  };
}

export interface UpscaleJob extends JobBase {
  type: 'upscale';
  params: UpscaleImageArgs;
  result?: {
    outputPath: string;
    uri: string;
    mimeType: string;
  };
}

export interface GenerateAndUpscaleJob extends JobBase {
  type: 'generate_and_upscale';
  params: GenerateAndUpscaleImageArgs;
  result?: {
    outputPath: string;
    uri: string;
    mimeType: string;
  };
}

export type Job = GenerateJob | EditJob | CustomizeJob | UpscaleJob | GenerateAndUpscaleJob;

/**
 * ジョブ作成時の入力パラメータ
 */
export interface StartJobArgs {
  tool_type: JobType;
  params: GenerateImageArgs | EditImageArgs | CustomizeImageArgs | UpscaleImageArgs | GenerateAndUpscaleImageArgs;
}

/**
 * ジョブステータス確認時の入力パラメータ
 */
export interface CheckJobStatusArgs {
  job_id: string;
}

/**
 * ジョブ結果取得時の入力パラメータ
 */
export interface GetJobResultArgs {
  job_id: string;
}

/**
 * ジョブキャンセル時の入力パラメータ
 */
export interface CancelJobArgs {
  job_id: string;
}

/**
 * ジョブ一覧取得時の入力パラメータ
 */
export interface ListJobsArgs {
  status?: JobStatus;
  limit?: number;
}
