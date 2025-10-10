/**
 * Google Cloud認証ユーティリティ
 */

import { GoogleAuth } from 'google-auth-library';

// Google Imagen API の設定
const GOOGLE_REGION = process.env.GOOGLE_REGION || 'us-central1';
const GOOGLE_IMAGEN_MODEL = process.env.GOOGLE_IMAGEN_MODEL || 'imagen-3.0-generate-002';
const GOOGLE_IMAGEN_UPSCALE_MODEL = process.env.GOOGLE_IMAGEN_UPSCALE_MODEL || 'imagegeneration@002';

// プロジェクトIDキャッシュ
let PROJECT_ID: string | null = null;

/**
 * プロジェクトIDを動的に取得
 *
 * 優先順位:
 * 1. キャッシュ済みの値
 * 2. GOOGLE_PROJECT_ID環境変数
 * 3. サービスアカウントキーファイルから取得
 *
 * @param auth GoogleAuthインスタンス
 * @returns プロジェクトID
 * @throws プロジェクトIDが取得できない場合
 */
export async function getProjectId(auth: GoogleAuth): Promise<string> {
  if (PROJECT_ID) {
    return PROJECT_ID;
  }

  // 環境変数から取得を試行
  if (process.env.GOOGLE_PROJECT_ID) {
    PROJECT_ID = process.env.GOOGLE_PROJECT_ID;
    return PROJECT_ID;
  }

  // サービスアカウントキーファイルから取得を試行
  try {
    const authClient = await auth.getClient();
    PROJECT_ID = await auth.getProjectId();
    if (PROJECT_ID) {
      return PROJECT_ID;
    }
  } catch (error) {
    if (process.env.DEBUG) {
      console.error('[DEBUG] Failed to get project ID from service account:', error);
    }
  }

  throw new Error('Project ID not found. Please set GOOGLE_PROJECT_ID environment variable or ensure service account key contains project_id.');
}

/**
 * Imagen画像生成APIのURLを生成
 *
 * @param projectId Google CloudプロジェクトID
 * @param model 使用するImagenモデル（省略時はデフォルト）
 * @param region リージョン（省略時はデフォルト）
 * @returns APIエンドポイントURL
 */
export function getImagenApiUrl(projectId: string, model?: string, region?: string): string {
  const selectedModel = model || GOOGLE_IMAGEN_MODEL;
  const selectedRegion = region || GOOGLE_REGION;
  return `https://${selectedRegion}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${selectedRegion}/publishers/google/models/${selectedModel}:predict`;
}

/**
 * Imagen画像アップスケールAPIのURLを生成
 *
 * @param projectId Google CloudプロジェクトID
 * @param region リージョン（省略時はデフォルト）
 * @returns APIエンドポイントURL
 */
export function getUpscaleApiUrl(projectId: string, region?: string): string {
  const selectedRegion = region || GOOGLE_REGION;
  return `https://${selectedRegion}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${selectedRegion}/publishers/google/models/${GOOGLE_IMAGEN_UPSCALE_MODEL}:predict`;
}
