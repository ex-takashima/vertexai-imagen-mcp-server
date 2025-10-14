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
 * API KEY認証が有効かチェック
 * @returns API KEY認証が設定されている場合true
 */
export function isApiKeyAuth(): boolean {
  return !!process.env.GOOGLE_API_KEY;
}

/**
 * 認証方式に応じたHTTPヘッダーを取得
 *
 * 優先順位:
 * 1. API KEY認証（GOOGLE_API_KEY環境変数）
 * 2. OAuth認証（サービスアカウント）
 *
 * @param auth GoogleAuthインスタンス（OAuth認証時に使用）
 * @returns 認証ヘッダーのオブジェクト
 * @throws 認証情報が取得できない場合
 */
export async function getAuthHeaders(auth?: GoogleAuth): Promise<Record<string, string>> {
  // API KEY認証（優先）
  if (process.env.GOOGLE_API_KEY) {
    if (process.env.DEBUG) {
      console.error('[DEBUG] Using API KEY authentication');
    }
    return { 'x-goog-api-key': process.env.GOOGLE_API_KEY };
  }

  // OAuth認証（既存）
  if (!auth) {
    throw new Error(
      'Authentication required.\n' +
      'Please set one of the following:\n' +
      '  - GOOGLE_API_KEY (for testing and development)\n' +
      '  - GOOGLE_SERVICE_ACCOUNT_KEY (for production)'
    );
  }

  if (process.env.DEBUG) {
    console.error('[DEBUG] Using OAuth authentication (service account)');
  }

  const authClient = await auth.getClient();
  const accessToken = await authClient.getAccessToken();

  if (!accessToken.token) {
    throw new Error('Failed to obtain OAuth access token from service account');
  }

  return { Authorization: `Bearer ${accessToken.token}` };
}

/**
 * プロジェクトIDを動的に取得
 *
 * 優先順位:
 * 1. キャッシュ済みの値
 * 2. GOOGLE_PROJECT_ID環境変数
 * 3. サービスアカウントキーファイルから取得（OAuth認証時のみ）
 *
 * @param auth GoogleAuthインスタンス（OAuth認証時に使用）
 * @returns プロジェクトID
 * @throws プロジェクトIDが取得できない場合
 */
export async function getProjectId(auth?: GoogleAuth): Promise<string> {
  if (PROJECT_ID) {
    return PROJECT_ID;
  }

  // API KEY認証の場合、環境変数が必須
  if (isApiKeyAuth() && !process.env.GOOGLE_PROJECT_ID) {
    throw new Error(
      'GOOGLE_PROJECT_ID environment variable is required when using API KEY authentication.\n' +
      '\n' +
      'Setup instructions:\n' +
      '  1. Get your project ID from Google Cloud Console (https://console.cloud.google.com/)\n' +
      '  2. Set environment variable:\n' +
      '     export GOOGLE_PROJECT_ID=your-project-id\n' +
      '\n' +
      'Example:\n' +
      '  export GOOGLE_PROJECT_ID=my-vertex-ai-project\n' +
      '  export GOOGLE_API_KEY=AIzaSy...'
    );
  }

  // 環境変数から取得（両認証方式で利用可能）
  if (process.env.GOOGLE_PROJECT_ID) {
    PROJECT_ID = process.env.GOOGLE_PROJECT_ID;
    if (process.env.DEBUG) {
      console.error(`[DEBUG] Using project ID from environment variable: ${PROJECT_ID}`);
    }
    return PROJECT_ID;
  }

  // サービスアカウント認証の場合のみ自動抽出を試行
  if (auth) {
    try {
      const authClient = await auth.getClient();
      PROJECT_ID = await auth.getProjectId();
      if (PROJECT_ID) {
        if (process.env.DEBUG) {
          console.error(`[DEBUG] Auto-detected project ID from service account: ${PROJECT_ID}`);
        }
        return PROJECT_ID;
      }
    } catch (error) {
      if (process.env.DEBUG) {
        console.error('[DEBUG] Failed to get project ID from service account:', error);
      }
    }
  }

  throw new Error(
    'Project ID not found.\n' +
    '\n' +
    'Please set GOOGLE_PROJECT_ID environment variable, or\n' +
    'provide a service account key with project_id field.\n' +
    '\n' +
    'For API KEY authentication:\n' +
    '  export GOOGLE_PROJECT_ID=your-project-id\n' +
    '\n' +
    'For service account authentication:\n' +
    '  The project ID will be auto-detected from the key file.'
  );
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
