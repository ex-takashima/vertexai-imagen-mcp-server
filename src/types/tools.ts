/**
 * MCPツール引数型定義
 */

export interface GenerateImageArgs {
  prompt: string;
  output_path?: string;
  aspect_ratio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  return_base64?: boolean;
  include_thumbnail?: boolean;
  safety_level?: "BLOCK_NONE" | "BLOCK_ONLY_HIGH" | "BLOCK_MEDIUM_AND_ABOVE" | "BLOCK_LOW_AND_ABOVE";
  person_generation?: "DONT_ALLOW" | "ALLOW_ADULT" | "ALLOW_ALL";
  language?: "auto" | "en" | "zh" | "zh-TW" | "hi" | "ja" | "ko" | "pt" | "es";
  model?: "imagen-4.0-ultra-generate-preview-06-06" | "imagen-4.0-fast-generate-preview-06-06" | "imagen-4.0-generate-preview-06-06" | "imagen-3.0-generate-002" | "imagen-3.0-fast-generate-001";
  region?: string;
}

export interface UpscaleImageArgs {
  input_path: string;
  output_path?: string;
  scale_factor?: "2" | "4";
  return_base64?: boolean;
  include_thumbnail?: boolean;
  region?: string;
}

export interface GenerateAndUpscaleImageArgs {
  prompt: string;
  output_path?: string;
  aspect_ratio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  scale_factor?: "2" | "4";
  return_base64?: boolean;
  include_thumbnail?: boolean;
  safety_level?: "BLOCK_NONE" | "BLOCK_ONLY_HIGH" | "BLOCK_MEDIUM_AND_ABOVE" | "BLOCK_LOW_AND_ABOVE";
  person_generation?: "DONT_ALLOW" | "ALLOW_ADULT" | "ALLOW_ALL";
  language?: "auto" | "en" | "zh" | "zh-TW" | "hi" | "ja" | "ko" | "pt" | "es";
  model?: "imagen-4.0-ultra-generate-preview-06-06" | "imagen-4.0-fast-generate-preview-06-06" | "imagen-4.0-generate-preview-06-06" | "imagen-3.0-generate-002" | "imagen-3.0-fast-generate-001";
  region?: string;
}

export interface ListGeneratedImagesArgs {
  directory?: string;
}

export interface EditImageArgs {
  prompt: string;
  reference_image_base64?: string;
  reference_image_path?: string;
  mask_image_base64?: string;
  mask_image_path?: string;
  mask_mode?: "background" | "foreground" | "semantic" | "user_provided";
  mask_classes?: number[];
  mask_dilation?: number;
  edit_mode?: "inpaint_removal" | "inpaint_insertion" | "bgswap";
  base_steps?: number;
  output_path?: string;
  return_base64?: boolean;
  include_thumbnail?: boolean;
  guidance_scale?: number;
  sample_count?: number;
  negative_prompt?: string;
  model?: string;
  region?: string;
}
