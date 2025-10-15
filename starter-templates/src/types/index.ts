/**
 * Type definitions for Image Generation MCP Server
 */

// =============================================================================
// Tool Arguments
// =============================================================================

export interface GenerateImageArgs {
  prompt: string;
  output_path?: string;
  aspect_ratio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  sample_count?: number;
  sample_image_size?: "1K" | "2K" | "4K";
  model?: string;
  region?: string;
  return_base64?: boolean;
  include_thumbnail?: boolean;
  negative_prompt?: string;
}

export interface EditImageArgs {
  prompt: string;
  reference_image_base64?: string;
  reference_image_path?: string;
  mask_image_base64?: string;
  mask_image_path?: string;
  mask_mode?: "background" | "foreground" | "semantic" | "user_provided" | "mask_free";
  output_path?: string;
  return_base64?: boolean;
  include_thumbnail?: boolean;
  negative_prompt?: string;
}

export interface UpscaleImageArgs {
  input_path: string;
  output_path?: string;
  scale_factor?: "2" | "4" | "8";
  return_base64?: boolean;
  include_thumbnail?: boolean;
}

export interface CustomizeImageArgs {
  prompt: string;
  control_image_base64?: string;
  control_image_path?: string;
  control_type?: "canny" | "scribble" | "depth" | "pose";
  subject_images?: Array<{
    image_base64?: string;
    image_path?: string;
  }>;
  subject_description?: string;
  style_image_base64?: string;
  style_image_path?: string;
  output_path?: string;
  aspect_ratio?: string;
  return_base64?: boolean;
  include_thumbnail?: boolean;
}

// =============================================================================
// History Management
// =============================================================================

export interface ListHistoryArgs {
  filters?: {
    tool_name?: string;
    model?: string;
    provider?: string;
    aspect_ratio?: string;
    date_from?: string;
    date_to?: string;
  };
  sort_by?: "created_at" | "file_size";
  sort_order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface GetHistoryByUuidArgs {
  uuid: string;
}

export interface SearchHistoryArgs {
  query: string;
  limit?: number;
  filters?: {
    tool_name?: string;
    model?: string;
    provider?: string;
    date_from?: string;
    date_to?: string;
  };
}

export interface GetMetadataFromImageArgs {
  image_path: string;
}

export interface HistoryRecord {
  uuid: string;
  tool_name: string;
  model: string;
  provider: string;
  prompt: string;
  negative_prompt?: string;
  parameters: Record<string, any>;
  params_hash: string;
  output_paths: string[];
  file_sizes: number;
  mime_types: string;
  aspect_ratio?: string;
  sample_count: number;
  sample_image_size?: string;
  created_at: string;
  success: boolean;
  error_message?: string;
  metadata?: Record<string, any>;
}

// =============================================================================
// Job Management
// =============================================================================

export interface StartJobArgs {
  tool_type: "generate" | "edit" | "customize" | "upscale" | "generate_and_upscale";
  params: Record<string, any>;
}

export interface CheckJobStatusArgs {
  job_id: string;
}

export interface GetJobResultArgs {
  job_id: string;
}

export interface CancelJobArgs {
  job_id: string;
}

export interface ListJobsArgs {
  status?: "pending" | "running" | "completed" | "failed";
  limit?: number;
}

export interface JobRecord {
  job_id: string;
  tool_type: string;
  status: "pending" | "running" | "completed" | "failed";
  params: Record<string, any>;
  result?: any;
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

// =============================================================================
// Template Management
// =============================================================================

export interface SavePromptTemplateArgs {
  name: string;
  description: string;
  template: string;
  variables?: string[];
  default_params?: Record<string, any>;
  tags?: string[];
}

export interface ListPromptTemplatesArgs {
  tags?: string[];
  search?: string;
}

export interface GetTemplateDetailArgs {
  template_name: string;
}

export interface GenerateFromTemplateArgs {
  template_name: string;
  variable_values: Record<string, string>;
  override_params?: Record<string, any>;
}

export interface DeleteTemplateArgs {
  template_name: string;
}

export interface UpdateTemplateArgs {
  template_name: string;
  description?: string;
  template?: string;
  variables?: string[];
  default_params?: Record<string, any>;
  tags?: string[];
}

export interface TemplateRecord {
  name: string;
  description: string;
  template: string;
  variables: string[];
  default_params: Record<string, any>;
  tags: string[];
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Provider Interface
// =============================================================================

export interface ImageProvider {
  name: string;

  // Core methods
  generateImage(args: GenerateImageArgs): Promise<Buffer[]>;
  editImage?(args: EditImageArgs): Promise<Buffer[]>;
  upscaleImage?(buffer: Buffer, scaleFactor: string): Promise<Buffer>;
  customizeImage?(args: CustomizeImageArgs): Promise<Buffer[]>;

  // Capabilities
  supports: {
    generation: boolean;
    editing: boolean;
    upscaling: boolean;
    customization: boolean;
    asyncJobs: boolean;
  };

  // Limits
  limits: {
    maxSampleCount: number;
    supportedAspectRatios: string[];
    maxResolution: string;
  };

  // Optional: Get model version
  getModelVersion?(): string;
}

// =============================================================================
// Context
// =============================================================================

export interface ToolContext {
  provider: ImageProvider;
  historyManager: any;  // Will be typed in database.ts
  resourceManager: any;  // Will be typed in resources.ts
  jobManager?: any;  // Optional
}

// =============================================================================
// Metadata
// =============================================================================

export interface ImageMetadata {
  uuid: string;
  params_hash: string;
  tool_name?: string;
  model?: string;
  provider?: string;
  created_at?: string;
  aspect_ratio?: string;
  sample_image_size?: string;
  prompt?: string;  // Only in 'full' level
  parameters?: Record<string, any>;  // Only in 'full' level
}

export type MetadataLevel = "minimal" | "standard" | "full";

// =============================================================================
// Resource
// =============================================================================

export interface ImageResource {
  uri: string;
  name: string;
  mimeType: string;
  description?: string;
  size?: number;
}

// =============================================================================
// MCP Response Types
// =============================================================================

export interface MCPContent {
  type: "text" | "image" | "resource";
  text?: string;
  data?: string;  // base64
  mimeType?: string;
  uri?: string;
  annotations?: {
    audience?: ("user" | "assistant")[];
    priority?: number;
  };
}

export interface MCPToolResponse {
  content: MCPContent[];
  isError?: boolean;
}
