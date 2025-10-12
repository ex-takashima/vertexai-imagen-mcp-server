/**
 * 履歴管理システムの型定義
 */

export type MetadataLevel = "minimal" | "standard" | "full";

/**
 * 画像履歴レコード（データベース保存用）
 */
export interface ImageRecord {
  uuid: string;
  filePath: string;
  toolName: string;
  prompt: string;
  createdAt: Date;

  // 生成パラメータ
  model?: string;
  aspectRatio?: string;
  sampleCount?: number;
  sampleImageSize?: string;
  safetyLevel?: string;
  personGeneration?: string;
  language?: string;

  // 完全なパラメータ（JSON）
  parameters: string;  // JSON.stringify(params)

  // パラメータハッシュ（整合性検証用）
  paramsHash: string;

  // ステータス
  success: boolean;
  errorMessage?: string;

  // ファイル情報
  fileSize?: number;
  mimeType?: string;
}

/**
 * 画像メタデータ（画像ファイルに埋め込む）
 */
export interface ImageMetadata {
  // 必須（全レベル共通）
  vertexai_imagen_uuid: string;
  params_hash: string;

  // standard レベル以上
  tool_name?: string;
  model?: string;
  created_at?: string;
  aspect_ratio?: string;
  sample_image_size?: string;

  // full レベルのみ
  prompt?: string;
  parameters?: Record<string, any>;
}

/**
 * 履歴一覧取得時のフィルタ
 */
export interface ListHistoryFilters {
  tool_name?: string;
  model?: string;
  aspect_ratio?: string;
  date_from?: string;  // ISO 8601
  date_to?: string;    // ISO 8601
}

/**
 * list_history ツールの引数
 */
export interface ListHistoryArgs {
  filters?: ListHistoryFilters;
  sort_by?: "created_at" | "file_size";
  sort_order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

/**
 * get_history_by_uuid ツールの引数
 */
export interface GetHistoryByUuidArgs {
  uuid: string;
}

/**
 * get_metadata_from_image ツールの引数
 */
export interface GetMetadataFromImageArgs {
  image_path: string;
}

/**
 * verify_image_integrity ツールの引数
 */
export interface VerifyImageIntegrityArgs {
  uuid?: string;
  image_path?: string;
}

/**
 * regenerate_from_uuid ツールの引数
 */
export interface RegenerateFromUuidArgs {
  uuid: string;
  override_params?: Record<string, any>;
}

/**
 * search_history ツールの引数
 */
export interface SearchHistoryArgs {
  query: string;
  limit?: number;
  filters?: ListHistoryFilters;
}

/**
 * delete_history ツールの引数
 */
export interface DeleteHistoryArgs {
  uuid: string;
  delete_file?: boolean;
}

/**
 * sync_metadata_to_db ツールの引数
 */
export interface SyncMetadataToDBArgs {
  directory?: string;
}
