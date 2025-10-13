/**
 * YAML設定ファイルの型定義
 * customize_image_from_yaml ツール用
 */

/**
 * Subject（被写体）設定
 */
export interface YamlSubjectConfig {
  reference_id: number;
  images: string[];  // 画像パスの配列（同じ被写体の複数画像）
  config: {
    description: string;  // 必須
    type: "person" | "animal" | "product" | "default" |
          "SUBJECT_TYPE_PERSON" | "SUBJECT_TYPE_ANIMAL" |
          "SUBJECT_TYPE_PRODUCT" | "SUBJECT_TYPE_DEFAULT";  // 必須
  };
}

/**
 * Control（制御画像）設定
 */
export interface YamlControlConfig {
  reference_id: number;
  image_path: string;
  type: "face_mesh" | "canny" | "scribble" |
        "CONTROL_TYPE_FACE_MESH" | "CONTROL_TYPE_CANNY" | "CONTROL_TYPE_SCRIBBLE";  // 必須
  enable_computation?: boolean;  // デフォルト: false
}

/**
 * Style（スタイル画像）設定
 */
export interface YamlStyleConfig {
  reference_id: number;
  image_path: string;
  description?: string;  // 省略可能
}

/**
 * メタデータ（将来の拡張用）
 */
export interface YamlMetadata {
  title?: string;
  tags?: string[];
  notes?: string;
}

/**
 * YAML設定ファイルのルート構造
 */
export interface CustomizeImageYamlConfig {
  // ========================================
  // 基本設定（必須）
  // ========================================
  model: string;
  output_path: string;
  prompt: string;

  // ========================================
  // 画像サイズ・品質
  // ========================================
  aspect_ratio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  sample_image_size?: "1K" | "2K";
  sample_count?: number;  // 1-4

  // ========================================
  // 安全性設定
  // ========================================
  safety_level?: "BLOCK_NONE" | "BLOCK_ONLY_HIGH" | "BLOCK_MEDIUM_AND_ABOVE" | "BLOCK_LOW_AND_ABOVE";
  person_generation?: "DONT_ALLOW" | "ALLOW_ADULT" | "ALLOW_ALL";
  language?: "auto" | "en" | "zh" | "zh-TW" | "hi" | "ja" | "ko" | "pt" | "es";

  // ========================================
  // 参照画像設定（少なくとも1つ必須）
  // ========================================
  subjects?: YamlSubjectConfig[];
  control?: YamlControlConfig;
  style?: YamlStyleConfig;

  // ========================================
  // その他のパラメータ
  // ========================================
  negative_prompt?: string;
  region?: string;
  return_base64?: boolean;
  include_thumbnail?: boolean;

  // ========================================
  // メタデータ（オプション、現在は使用しない）
  // ========================================
  metadata?: YamlMetadata;
}

/**
 * customize_image_from_yaml ツールの引数
 */
export interface CustomizeImageFromYamlArgs {
  yaml_path: string;  // YAMLファイルのパス
}

/**
 * customize_image_from_yaml_inline ツールの引数
 */
export interface CustomizeImageFromYamlInlineArgs {
  yaml_content: string;  // YAML文字列
}
