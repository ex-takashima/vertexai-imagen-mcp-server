/**
 * Zod validation schemas for tool arguments
 * Provides runtime validation to complement TypeScript's compile-time type checking
 */

import { z } from 'zod';

// Common enums and shared schemas
const AspectRatioSchema = z.enum(['1:1', '3:4', '4:3', '9:16', '16:9']);
const SafetyLevelSchema = z.enum([
  'BLOCK_NONE',
  'BLOCK_ONLY_HIGH',
  'BLOCK_MEDIUM_AND_ABOVE',
  'BLOCK_LOW_AND_ABOVE'
]);
const PersonGenerationSchema = z.enum(['DONT_ALLOW', 'ALLOW_ADULT', 'ALLOW_ALL']);
const LanguageSchema = z.enum(['auto', 'en', 'zh', 'zh-TW', 'hi', 'ja', 'ko', 'pt', 'es']);
const SampleImageSizeSchema = z.enum(['1K', '2K']);
const ImagenGenerateModelSchema = z.enum([
  'imagen-4.0-ultra-generate-001',
  'imagen-4.0-fast-generate-001',
  'imagen-4.0-generate-001',
  'imagen-3.0-generate-002',
  'imagen-3.0-fast-generate-001'
]);
const ImagenCapabilityModelSchema = z.enum(['imagen-3.0-capability-001']);

/**
 * Generate Image Arguments Schema
 */
export const GenerateImageArgsSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required and must not be empty'),
  output_path: z.string().optional(),
  aspect_ratio: AspectRatioSchema.default('1:1'),
  return_base64: z.boolean().optional(),
  include_thumbnail: z.boolean().optional(),
  safety_level: SafetyLevelSchema.default('BLOCK_MEDIUM_AND_ABOVE'),
  person_generation: PersonGenerationSchema.default('DONT_ALLOW'),
  language: LanguageSchema.default('auto'),
  model: ImagenGenerateModelSchema.default('imagen-3.0-generate-002'),
  region: z.string().optional(),
  sample_count: z.number().int().min(1).max(4).default(1),
  sample_image_size: SampleImageSizeSchema.optional(),
}).refine(
  (data) => {
    // Business rule: 2K only supported by specific models
    if (data.sample_image_size === '2K') {
      return data.model === 'imagen-4.0-generate-001' ||
             data.model === 'imagen-4.0-ultra-generate-001';
    }
    return true;
  },
  {
    message: '2K resolution is only supported by imagen-4.0-generate-001 and imagen-4.0-ultra-generate-001',
    path: ['sample_image_size'],
  }
);

/**
 * Upscale Image Arguments Schema
 */
export const UpscaleImageArgsSchema = z.object({
  input_path: z.string().min(1, 'Input path is required'),
  output_path: z.string().optional(),
  scale_factor: z.enum(['2', '4']).default('2'),
  return_base64: z.boolean().optional(),
  include_thumbnail: z.boolean().optional(),
  region: z.string().optional(),
});

/**
 * Edit Image Arguments Schema
 */
export const EditImageArgsSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  reference_image_base64: z.string().optional(),
  reference_image_path: z.string().optional(),
  mask_image_base64: z.string().optional(),
  mask_image_path: z.string().optional(),
  mask_mode: z.enum(['background', 'foreground', 'semantic', 'user_provided', 'mask_free']).optional(),
  mask_classes: z.array(z.number().int()).optional(),
  mask_dilation: z.number().min(0).max(1).optional(),
  edit_mode: z.enum(['inpaint_removal', 'inpaint_insertion', 'bgswap', 'outpainting']).optional(),
  base_steps: z.number().int().min(1).max(75).optional(),
  output_path: z.string().optional(),
  return_base64: z.boolean().optional(),
  include_thumbnail: z.boolean().optional(),
  guidance_scale: z.number().optional(),
  sample_count: z.number().int().min(1).max(4).default(1),
  negative_prompt: z.string().optional(),
  model: ImagenCapabilityModelSchema.default('imagen-3.0-capability-001'),
  region: z.string().optional(),
  sample_image_size: SampleImageSizeSchema.optional(),
}).refine(
  (data) => {
    // Must have either reference_image_base64 or reference_image_path
    return data.reference_image_base64 || data.reference_image_path;
  },
  {
    message: 'Either reference_image_base64 or reference_image_path is required',
    path: ['reference_image_base64'],
  }
).refine(
  (data) => {
    // If mask_mode is semantic, mask_classes is required
    if (data.mask_mode === 'semantic') {
      return data.mask_classes && data.mask_classes.length > 0;
    }
    return true;
  },
  {
    message: 'mask_classes is required when mask_mode is "semantic"',
    path: ['mask_classes'],
  }
);

/**
 * Customize Image Arguments Schema
 */
const SubjectImageSchema = z.object({
  image_base64: z.string().optional(),
  image_path: z.string().optional(),
}).refine(
  (data) => data.image_base64 || data.image_path,
  {
    message: 'Either image_base64 or image_path is required',
    path: ['image_base64'],
  }
);

export const CustomizeImageArgsSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  control_image_base64: z.string().optional(),
  control_image_path: z.string().optional(),
  control_type: z.enum(['face_mesh', 'canny', 'scribble']).optional(),
  enable_control_computation: z.boolean().optional(),
  subject_images: z.array(SubjectImageSchema).optional(),
  subject_description: z.string().optional(),
  subject_type: z.enum(['person', 'animal', 'product', 'default']).optional(),
  style_image_base64: z.string().optional(),
  style_image_path: z.string().optional(),
  style_description: z.string().optional(),
  output_path: z.string().optional(),
  aspect_ratio: AspectRatioSchema.default('1:1'),
  return_base64: z.boolean().optional(),
  include_thumbnail: z.boolean().optional(),
  safety_level: SafetyLevelSchema.default('BLOCK_MEDIUM_AND_ABOVE'),
  person_generation: PersonGenerationSchema.default('DONT_ALLOW'),
  language: LanguageSchema.default('auto'),
  negative_prompt: z.string().optional(),
  sample_count: z.number().int().min(1).max(4).default(1),
  model: ImagenCapabilityModelSchema.default('imagen-3.0-capability-001'),
  region: z.string().optional(),
  sample_image_size: SampleImageSizeSchema.optional(),
}).refine(
  (data) => {
    // Must have at least one of: control_image, subject_images, or style_image
    const hasControl = data.control_image_base64 || data.control_image_path;
    const hasSubject = data.subject_images && data.subject_images.length > 0;
    const hasStyle = data.style_image_base64 || data.style_image_path;
    return hasControl || hasSubject || hasStyle;
  },
  {
    message: 'At least one of control_image, subject_images, or style_image is required',
    path: ['prompt'],
  }
).refine(
  (data) => {
    // If control image is provided, control_type is required
    if (data.control_image_base64 || data.control_image_path) {
      return !!data.control_type;
    }
    return true;
  },
  {
    message: 'control_type is required when control image is provided',
    path: ['control_type'],
  }
).refine(
  (data) => {
    // If subject_images is provided, subject_description and subject_type are required
    if (data.subject_images && data.subject_images.length > 0) {
      return !!data.subject_description && !!data.subject_type;
    }
    return true;
  },
  {
    message: 'subject_description and subject_type are required when subject_images are provided',
    path: ['subject_description'],
  }
);

/**
 * Generate and Upscale Image Arguments Schema
 */
export const GenerateAndUpscaleImageArgsSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  output_path: z.string().optional(),
  aspect_ratio: AspectRatioSchema.default('1:1'),
  scale_factor: z.enum(['2', '4']).default('2'),
  return_base64: z.boolean().optional(),
  include_thumbnail: z.boolean().optional(),
  safety_level: SafetyLevelSchema.default('BLOCK_MEDIUM_AND_ABOVE'),
  person_generation: PersonGenerationSchema.default('DONT_ALLOW'),
  language: LanguageSchema.default('auto'),
  model: ImagenGenerateModelSchema.default('imagen-3.0-generate-002'),
  region: z.string().optional(),
  sample_image_size: SampleImageSizeSchema.optional(),
}).refine(
  (data) => {
    if (data.sample_image_size === '2K') {
      return data.model === 'imagen-4.0-generate-001' ||
             data.model === 'imagen-4.0-ultra-generate-001';
    }
    return true;
  },
  {
    message: '2K resolution is only supported by imagen-4.0-generate-001 and imagen-4.0-ultra-generate-001',
    path: ['sample_image_size'],
  }
);

/**
 * Job-related schemas
 */
export const StartJobArgsSchema = z.object({
  tool_type: z.enum(['generate', 'edit', 'customize', 'upscale', 'generate_and_upscale']),
  params: z.record(z.string(), z.any()),
});

export const CheckJobStatusArgsSchema = z.object({
  job_id: z.string().uuid('Job ID must be a valid UUID'),
});

export const GetJobResultArgsSchema = z.object({
  job_id: z.string().uuid('Job ID must be a valid UUID'),
});

export const CancelJobArgsSchema = z.object({
  job_id: z.string().uuid('Job ID must be a valid UUID'),
});

export const ListJobsArgsSchema = z.object({
  status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
  limit: z.number().int().positive().default(50),
});

/**
 * History-related schemas
 */
export const ListHistoryArgsSchema = z.object({
  filters: z.object({
    tool_name: z.string().optional(),
    model: z.string().optional(),
    aspect_ratio: z.string().optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
  }).optional(),
  sort_by: z.enum(['created_at', 'file_size']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
});

export const SearchHistoryArgsSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  limit: z.number().int().positive().default(50),
  filters: z.object({
    tool_name: z.string().optional(),
    model: z.string().optional(),
    aspect_ratio: z.string().optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
  }).optional(),
});

export const GetHistoryByUuidArgsSchema = z.object({
  uuid: z.string().uuid('UUID must be a valid UUID'),
});

export const GetMetadataFromImageArgsSchema = z.object({
  image_path: z.string().min(1, 'Image path is required'),
});

/**
 * Template-related schemas
 */
export const SavePromptTemplateArgsSchema = z.object({
  name: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'Template name must contain only alphanumeric characters, hyphens, and underscores'),
  description: z.string().min(1, 'Description is required'),
  template: z.string().min(1, 'Template is required'),
  variables: z.array(z.string()).optional(),
  default_params: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
});

export const ListPromptTemplatesArgsSchema = z.object({
  tags: z.array(z.string()).optional(),
  search: z.string().optional(),
});

export const GetTemplateDetailArgsSchema = z.object({
  template_name: z.string().min(1, 'Template name is required'),
});

export const GenerateFromTemplateArgsSchema = z.object({
  template_name: z.string().min(1, 'Template name is required'),
  variable_values: z.record(z.string(), z.any()),
  override_params: z.record(z.string(), z.any()).optional(),
});

export const DeleteTemplateArgsSchema = z.object({
  template_name: z.string().min(1, 'Template name is required'),
});

export const UpdateTemplateArgsSchema = z.object({
  template_name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  template: z.string().optional(),
  variables: z.array(z.string()).optional(),
  default_params: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * Other tool schemas
 */
export const ListGeneratedImagesArgsSchema = z.object({
  directory: z.string().optional(),
});

export const ListSemanticClassesArgsSchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  ids: z.array(z.number().int()).optional(),
});

export const CustomizeImageFromYamlArgsSchema = z.object({
  yaml_path: z.string().min(1, 'YAML path is required'),
});

export const CustomizeImageFromYamlInlineArgsSchema = z.object({
  yaml_content: z.string().min(1, 'YAML content is required'),
});
