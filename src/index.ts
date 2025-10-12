#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { GoogleAuth } from 'google-auth-library';
import { createRequire } from 'module';
import { getDefaultOutputDirectory } from './utils/path.js';
import { ImageResourceManager } from './utils/resources.js';
import type {
  GenerateImageArgs,
  UpscaleImageArgs,
  GenerateAndUpscaleImageArgs,
  ListGeneratedImagesArgs,
  EditImageArgs,
  CustomizeImageArgs,
  ListSemanticClassesArgs
} from './types/tools.js';
import type { ToolContext } from './tools/types.js';
import { generateImage as handleGenerateImage } from './tools/generateImage.js';
import { editImage as handleEditImage } from './tools/editImage.js';
import { customizeImage as handleCustomizeImage } from './tools/customizeImage.js';
import { upscaleImage as handleUpscaleImage } from './tools/upscaleImage.js';
import { generateAndUpscaleImage as handleGenerateAndUpscaleImage } from './tools/generateAndUpscaleImage.js';
import { listGeneratedImages as handleListGeneratedImages } from './tools/listGeneratedImages.js';
import { listSemanticClasses as handleListSemanticClasses } from './tools/listSemanticClasses.js';

const require = createRequire(import.meta.url);
const { version: PACKAGE_VERSION } = require('../package.json') as { version: string };

const TOOL_GENERATE_IMAGE = "generate_image";
const TOOL_UPSCALE_IMAGE = "upscale_image";
const TOOL_GENERATE_AND_UPSCALE_IMAGE = "generate_and_upscale_image";
const TOOL_LIST_GENERATED_IMAGES = "list_generated_images";
const TOOL_EDIT_IMAGE = "edit_image";
const TOOL_CUSTOMIZE_IMAGE = "customize_image";
const TOOL_LIST_SEMANTIC_CLASSES = "list_semantic_classes";

class GoogleImagenMCPServer {
  private server: Server;
  private auth: GoogleAuth;
  private resourceManager: ImageResourceManager;
  private toolContext: ToolContext;

  constructor() {
    this.server = new Server(
      {
        name: "vertexai-imagen-server",
        version: PACKAGE_VERSION,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    // Google Cloud認証の設定
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      credentials: process.env.GOOGLE_SERVICE_ACCOUNT_KEY ?
        JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY) : undefined,
    });

    // リソースマネージャーの初期化
    const outputDir = getDefaultOutputDirectory();
    this.resourceManager = new ImageResourceManager(outputDir);
    this.toolContext = {
      auth: this.auth,
      resourceManager: this.resourceManager
    };

    this.setupToolHandlers();
    this.setupResourceHandlers();
    this.handleProcessArguments();
  }

  private handleProcessArguments() {
    // --version フラグの処理
    if (process.argv.includes('--version') || process.argv.includes('-v')) {
      console.log(PACKAGE_VERSION);
      process.exit(0);
    }

    // --help フラグの処理
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      console.log(`
VertexAI Imagen MCP Server v${PACKAGE_VERSION}

Usage: vertexai-imagen-mcp-server [options]

Options:
  -v, --version    Show version number
  -h, --help       Show help

Environment Variables:
  GOOGLE_SERVICE_ACCOUNT_KEY      Service account JSON key (required)
  GOOGLE_PROJECT_ID               Google Cloud Project ID (optional, auto-detected from service account)
  GOOGLE_REGION                   Region (optional, default: us-central1)
  GOOGLE_IMAGEN_MODEL             Model name (optional, default: imagen-3.0-generate-002)
  VERTEXAI_IMAGEN_OUTPUT_DIR      Default output directory for generated images
                                  (optional, default: ~/Downloads/vertexai-imagen-files)
  VERTEXAI_IMAGEN_THUMBNAIL       Enable thumbnail generation for image previews
                                  (optional, default: false, set to 'true' to enable)
                                  Note: Thumbnails consume ~30-50 tokens per image
  DEBUG                           Enable debug logging

File Path Handling:
  - Relative paths are saved to VERTEXAI_IMAGEN_OUTPUT_DIR
  - Absolute paths are used as-is
  - Parent directories are created automatically

Examples:
  # Use default output directory
  output_path: "my_image.png"
  → ~/Downloads/vertexai-imagen-files/my_image.png

  # Custom output directory via environment variable
  VERTEXAI_IMAGEN_OUTPUT_DIR=/path/to/images
  output_path: "my_image.png"
  → /path/to/images/my_image.png

  # Absolute path (ignores VERTEXAI_IMAGEN_OUTPUT_DIR)
  output_path: "/tmp/my_image.png"
  → /tmp/my_image.png

This is an MCP (Model Context Protocol) server for Google Imagen image generation.
It should be run by an MCP client like Claude Desktop.
      `);
      process.exit(0);
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: TOOL_GENERATE_IMAGE,
            description: "Generate an image using Google Imagen API. Images are saved to ~/Downloads/vertexai-imagen-files by default (customizable via VERTEXAI_IMAGEN_OUTPUT_DIR environment variable).",
            inputSchema: {
              type: "object",
              properties: {
                prompt: {
                  type: "string",
                  description: "Text prompt describing the image to generate",
                },
                output_path: {
                  type: "string",
                  description: "Path to save the generated image. Can be absolute or relative to VERTEXAI_IMAGEN_OUTPUT_DIR (default: ~/Downloads/vertexai-imagen-files). Default filename: generated_image.png",
                },
                aspect_ratio: {
                  type: "string",
                  enum: ["1:1", "3:4", "4:3", "9:16", "16:9"],
                  description: "Aspect ratio of the generated image (default: 1:1). Options: 1:1 (square), 3:4 (portrait), 4:3 (landscape), 9:16 (tall), 16:9 (wide)",
                },
                return_base64: {
                  type: "boolean",
                  description: "DEPRECATED: Return image as base64 data instead of file URI (default: false). This option will be removed in v1.0.0. File save mode with Resources API is strongly recommended.",
                },
                include_thumbnail: {
                  type: "boolean",
                  description: "Generate thumbnail preview image (128x128, ~30-50 tokens). Defaults to VERTEXAI_IMAGEN_THUMBNAIL environment variable setting. Only applies when return_base64 is false.",
                },
                safety_level: {
                  type: "string",
                  enum: ["BLOCK_NONE", "BLOCK_ONLY_HIGH", "BLOCK_MEDIUM_AND_ABOVE", "BLOCK_LOW_AND_ABOVE"],
                  description: "Safety filter level (default: BLOCK_MEDIUM_AND_ABOVE)",
                },
                person_generation: {
                  type: "string",
                  enum: ["DONT_ALLOW", "ALLOW_ADULT", "ALLOW_ALL"],
                  description: "Person generation policy (default: DONT_ALLOW)",
                },
                language: {
                  type: "string",
                  enum: ["auto", "en", "zh", "zh-TW", "hi", "ja", "ko", "pt", "es"],
                  description: "Language for prompt processing (default: auto)",
                },
                model: {
                  type: "string",
                  enum: ["imagen-4.0-ultra-generate-001", "imagen-4.0-fast-generate-001", "imagen-4.0-generate-001", "imagen-3.0-generate-002", "imagen-3.0-fast-generate-001"],
                  description: "Imagen model to use (default: imagen-3.0-generate-002)",
                },
                region: {
                  type: "string",
                  description: "Google Cloud region to use (default: from environment variable GOOGLE_REGION or us-central1)",
                },
                sample_count: {
                  type: "integer",
                  minimum: 1,
                  maximum: 4,
                  description: "Number of images to generate (default: 1). Range: 1-4 for Imagen-3",
                },
                sample_image_size: {
                  type: "string",
                  enum: ["1K", "2K"],
                  description: "Output resolution of generated image (default: 1K). 1K for faster generation, 2K for higher quality. IMPORTANT: 2K is only supported by imagen-4.0-generate-001 and imagen-4.0-ultra-generate-001. All other models (including imagen-4.0-fast-generate-001 and Imagen-3 models) only support 1K.",
                }
              },
              required: ["prompt"],
            },
          },
          {
            name: TOOL_EDIT_IMAGE,
            description: "Edit an existing image using Google Imagen API with support for automatic mask generation, semantic segmentation, and various edit modes (inpainting, background replacement). Images are saved to ~/Downloads/vertexai-imagen-files by default (customizable via VERTEXAI_IMAGEN_OUTPUT_DIR environment variable).",
            inputSchema: {
              type: "object",
              properties: {
                prompt: {
                  type: "string",
                  description: "Text prompt describing how the masked area should change",
                },
                reference_image_base64: {
                  type: "string",
                  description: "Base64 encoded source image (data URI strings are also accepted)",
                },
                reference_image_path: {
                  type: "string",
                  description: "Path to the source image file; used when base64 is too large",
                },
                mask_image_base64: {
                  type: "string",
                  description: "Optional Base64 encoded mask image (white = editable, black = preserved)",
                },
                mask_image_path: {
                  type: "string",
                  description: "Optional path to the mask image file (white = editable, black = preserved)",
                },
                mask_mode: {
                  type: "string",
                  enum: ["background", "foreground", "semantic", "user_provided", "mask_free"],
                  description: "Mask generation mode: 'background' (auto-detect background), 'foreground' (auto-detect foreground), 'semantic' (use semantic classes), 'user_provided' (use provided mask image), 'mask_free' (no mask, edit based on prompt only). If not specified, defaults to mask-free editing.",
                },
                mask_classes: {
                  type: "array",
                  items: {
                    type: "integer"
                  },
                  description: "Array of semantic class IDs for automatic mask generation (required when mask_mode is 'semantic'). Example: [175, 176] for person-related classes",
                },
                mask_dilation: {
                  type: "number",
                  description: "Proportion of image width to dilate the mask (default: 0.01). Recommended range: 0.01-0.1",
                },
                edit_mode: {
                  type: "string",
                  enum: ["inpaint_removal", "inpaint_insertion", "bgswap", "outpainting"],
                  description: "Edit operation mode: 'inpaint_removal' (remove content), 'inpaint_insertion' (add/modify content), 'bgswap' (change background), 'outpainting' (expand image beyond original canvas). Default: inpaint_insertion",
                },
                base_steps: {
                  type: "integer",
                  minimum: 1,
                  maximum: 75,
                  description: "Number of sampling steps for the base model. Higher values may improve quality but take longer. Range: 1-75, recommended: 12-20 for removal, up to 75 for insertion",
                },
                output_path: {
                  type: "string",
                  description: "Path to save the edited image. Can be absolute or relative to VERTEXAI_IMAGEN_OUTPUT_DIR (default: ~/Downloads/vertexai-imagen-files). Default filename: edited_image.png",
                },
                return_base64: {
                  type: "boolean",
                  description: "DEPRECATED: Return edited image as base64 data instead of file URI (default: false). This option will be removed in v1.0.0. File save mode with Resources API is strongly recommended.",
                },
                include_thumbnail: {
                  type: "boolean",
                  description: "Generate thumbnail preview image (128x128, ~30-50 tokens). Defaults to VERTEXAI_IMAGEN_THUMBNAIL environment variable setting. Only applies when return_base64 is false.",
                },
                guidance_scale: {
                  type: "number",
                  description: "Optional guidance scale (prompt strength), typically 0-30",
                },
                sample_count: {
                  type: "integer",
                  minimum: 1,
                  maximum: 4,
                  description: "Number of images to generate (default: 1). Range: 1-4 for Imagen-3",
                },
                negative_prompt: {
                  type: "string",
                  description: "Optional negative text prompt to avoid certain traits",
                },
                model: {
                  type: "string",
                  enum: ["imagen-3.0-capability-001"],
                  description: "Imagen edit model to use (default: imagen-3.0-capability-001)",
                },
                region: {
                  type: "string",
                  description: "Google Cloud region to use (default: from environment variable GOOGLE_REGION or us-central1)",
                },
                sample_image_size: {
                  type: "string",
                  enum: ["1K", "2K"],
                  description: "Output resolution of generated image (default: 1K). IMPORTANT: edit_image uses Imagen-3 capability models which only support 1K. 2K is not supported.",
                }
              },
              required: ["prompt"],
              description: "Provide either reference_image_base64 or reference_image_path for the source image. For masking: use mask_mode='user_provided' with mask_image_base64/mask_image_path, use automatic masking with mask_mode='background'/'foreground'/'semantic', or omit mask_mode for mask-free editing (prompt-based editing). For semantic masking, also specify mask_classes array.",
            },
          },
          {
            name: TOOL_UPSCALE_IMAGE,
            description: "Upscale an existing image using Google Imagen API. Images are saved to ~/Downloads/vertexai-imagen-files by default (customizable via VERTEXAI_IMAGEN_OUTPUT_DIR environment variable).",
            inputSchema: {
              type: "object",
              properties: {
                input_path: {
                  type: "string",
                  description: "Path to the input image file to upscale",
                },
                output_path: {
                  type: "string",
                  description: "Path to save the upscaled image. Can be absolute or relative to VERTEXAI_IMAGEN_OUTPUT_DIR (default: ~/Downloads/vertexai-imagen-files). Default filename: upscaled_[scale_factor]x_[original_name]",
                },
                scale_factor: {
                  type: "string",
                  enum: ["2", "4"],
                  description: "Upscaling factor - 2x or 4x (default: 2)",
                },
                return_base64: {
                  type: "boolean",
                  description: "DEPRECATED: Return image as base64 data instead of file URI (default: false). This option will be removed in v1.0.0. File save mode with Resources API is strongly recommended.",
                },
                include_thumbnail: {
                  type: "boolean",
                  description: "Generate thumbnail preview image (128x128, ~30-50 tokens). Defaults to VERTEXAI_IMAGEN_THUMBNAIL environment variable setting. Only applies when return_base64 is false.",
                },
                region: {
                  type: "string",
                  description: "Google Cloud region to use (default: from environment variable GOOGLE_REGION or us-central1)",
                }
              },
              required: ["input_path"],
            },
          },
          {
            name: TOOL_GENERATE_AND_UPSCALE_IMAGE,
            description: "Generate an image and automatically upscale it using Google Imagen API. Images are saved to ~/Downloads/vertexai-imagen-files by default (customizable via VERTEXAI_IMAGEN_OUTPUT_DIR environment variable).",
            inputSchema: {
              type: "object",
              properties: {
                prompt: {
                  type: "string",
                  description: "Text prompt describing the image to generate",
                },
                output_path: {
                  type: "string",
                  description: "Path to save the final upscaled image. Can be absolute or relative to VERTEXAI_IMAGEN_OUTPUT_DIR (default: ~/Downloads/vertexai-imagen-files). Default filename: generated_upscaled_image.png",
                },
                aspect_ratio: {
                  type: "string",
                  enum: ["1:1", "3:4", "4:3", "9:16", "16:9"],
                  description: "Aspect ratio of the generated image (default: 1:1). Options: 1:1 (square), 3:4 (portrait), 4:3 (landscape), 9:16 (tall), 16:9 (wide)",
                },
                scale_factor: {
                  type: "string",
                  enum: ["2", "4"],
                  description: "Upscaling factor - 2x or 4x (default: 2)",
                },
                return_base64: {
                  type: "boolean",
                  description: "DEPRECATED: Return image as base64 data instead of file URI (default: false). This option will be removed in v1.0.0. File save mode with Resources API is strongly recommended.",
                },
                include_thumbnail: {
                  type: "boolean",
                  description: "Generate thumbnail preview image (128x128, ~30-50 tokens). Defaults to VERTEXAI_IMAGEN_THUMBNAIL environment variable setting. Only applies when return_base64 is false.",
                },
                safety_level: {
                  type: "string",
                  enum: ["BLOCK_NONE", "BLOCK_ONLY_HIGH", "BLOCK_MEDIUM_AND_ABOVE", "BLOCK_LOW_AND_ABOVE"],
                  description: "Safety filter level (default: BLOCK_MEDIUM_AND_ABOVE)",
                },
                person_generation: {
                  type: "string",
                  enum: ["DONT_ALLOW", "ALLOW_ADULT", "ALLOW_ALL"],
                  description: "Person generation policy (default: DONT_ALLOW)",
                },
                language: {
                  type: "string",
                  enum: ["auto", "en", "zh", "zh-TW", "hi", "ja", "ko", "pt", "es"],
                  description: "Language for prompt processing (default: auto)",
                },
                model: {
                  type: "string",
                  enum: ["imagen-4.0-ultra-generate-001", "imagen-4.0-fast-generate-001", "imagen-4.0-generate-001", "imagen-3.0-generate-002", "imagen-3.0-fast-generate-001"],
                  description: "Imagen model to use (default: imagen-3.0-generate-002)",
                },
                region: {
                  type: "string",
                  description: "Google Cloud region to use (default: from environment variable GOOGLE_REGION or us-central1)",
                },
                sample_image_size: {
                  type: "string",
                  enum: ["1K", "2K"],
                  description: "Output resolution of generated image (default: 1K). 1K for faster generation, 2K for higher quality. IMPORTANT: 2K is only supported by imagen-4.0-generate-001 and imagen-4.0-ultra-generate-001. All other models (including imagen-4.0-fast-generate-001 and Imagen-3 models) only support 1K.",
                }
              },
              required: ["prompt"],
            },
          },
          {
            name: TOOL_LIST_GENERATED_IMAGES,
            description: "List all generated images in the current directory",
            inputSchema: {
              type: "object",
              properties: {
                directory: {
                  type: "string",
                  description: "Directory to search for images (default: current directory)",
                }
              },
            },
          },
          {
            name: TOOL_CUSTOMIZE_IMAGE,
            description: "Generate an image with customization using reference images (control structure, subject consistency, style transfer). Use [1], [2], etc. in prompt to reference images by their ID. Images are saved to ~/Downloads/vertexai-imagen-files by default (customizable via VERTEXAI_IMAGEN_OUTPUT_DIR environment variable).",
            inputSchema: {
              type: "object",
              properties: {
                prompt: {
                  type: "string",
                  description: "Text prompt describing the image to generate. Use [1], [2], etc. to reference control/subject/style images by their ID",
                },
                control_image_base64: {
                  type: "string",
                  description: "Base64 encoded control image for structure guidance (data URI strings are also accepted)",
                },
                control_image_path: {
                  type: "string",
                  description: "Path to the control image file; used when base64 is too large",
                },
                control_type: {
                  type: "string",
                  enum: ["face_mesh", "canny", "scribble"],
                  description: "Control type: 'face_mesh' (face mesh for person customization), 'canny' (Canny edges), 'scribble' (freehand). Required when control image is provided",
                },
                enable_control_computation: {
                  type: "boolean",
                  description: "If true, compute control image from raw image automatically (recommended for normal images). If false, use provided pre-processed control image (default: true)",
                },
                subject_images: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      image_base64: {
                        type: "string",
                        description: "Base64 encoded subject image (data URI strings are also accepted)",
                      },
                      image_path: {
                        type: "string",
                        description: "Path to the subject image file",
                      }
                    }
                  },
                  description: "Array of subject reference images. Multiple images of the same subject can improve quality. Provide either image_base64 or image_path for each image",
                },
                subject_description: {
                  type: "string",
                  description: "Brief description of the subject (e.g., 'a man with short hair', 'a brown dog'). Required when subject_images is provided",
                },
                subject_type: {
                  type: "string",
                  enum: ["person", "animal", "product", "default"],
                  description: "Subject type: 'person', 'animal', 'product', or 'default'. Required when subject_images is provided",
                },
                style_image_base64: {
                  type: "string",
                  description: "Base64 encoded style reference image (data URI strings are also accepted)",
                },
                style_image_path: {
                  type: "string",
                  description: "Path to the style reference image file; used when base64 is too large",
                },
                style_description: {
                  type: "string",
                  description: "Optional brief description of the style",
                },
                output_path: {
                  type: "string",
                  description: "Path to save the generated image. Can be absolute or relative to VERTEXAI_IMAGEN_OUTPUT_DIR (default: ~/Downloads/vertexai-imagen-files). Default filename: customized_image.png",
                },
                aspect_ratio: {
                  type: "string",
                  enum: ["1:1", "3:4", "4:3", "9:16", "16:9"],
                  description: "Aspect ratio of the generated image (default: 1:1). Options: 1:1 (square), 3:4 (portrait), 4:3 (landscape), 9:16 (tall), 16:9 (wide)",
                },
                return_base64: {
                  type: "boolean",
                  description: "DEPRECATED: Return image as base64 data instead of file URI (default: false). This option will be removed in v1.0.0. File save mode with Resources API is strongly recommended.",
                },
                include_thumbnail: {
                  type: "boolean",
                  description: "Generate thumbnail preview image (128x128, ~30-50 tokens). Defaults to VERTEXAI_IMAGEN_THUMBNAIL environment variable setting. Only applies when return_base64 is false.",
                },
                safety_level: {
                  type: "string",
                  enum: ["BLOCK_NONE", "BLOCK_ONLY_HIGH", "BLOCK_MEDIUM_AND_ABOVE", "BLOCK_LOW_AND_ABOVE"],
                  description: "Safety filter level (default: BLOCK_MEDIUM_AND_ABOVE)",
                },
                person_generation: {
                  type: "string",
                  enum: ["DONT_ALLOW", "ALLOW_ADULT", "ALLOW_ALL"],
                  description: "Person generation policy (default: DONT_ALLOW)",
                },
                language: {
                  type: "string",
                  enum: ["auto", "en", "zh", "zh-TW", "hi", "ja", "ko", "pt", "es"],
                  description: "Language for prompt processing (default: auto)",
                },
                negative_prompt: {
                  type: "string",
                  description: "Optional negative text prompt to avoid certain traits",
                },
                sample_count: {
                  type: "integer",
                  minimum: 1,
                  maximum: 4,
                  description: "Number of images to generate (default: 1). Range: 1-4 for Imagen-3",
                },
                model: {
                  type: "string",
                  enum: ["imagen-3.0-capability-001"],
                  description: "Imagen customize model to use (default: imagen-3.0-capability-001)",
                },
                region: {
                  type: "string",
                  description: "Google Cloud region to use (default: from environment variable GOOGLE_REGION or us-central1)",
                },
                sample_image_size: {
                  type: "string",
                  enum: ["1K", "2K"],
                  description: "Output resolution of generated image (default: 1K). IMPORTANT: customize_image uses Imagen-3 capability models which only support 1K. 2K is not supported.",
                }
              },
              required: ["prompt"],
              description: "Provide at least one of: control_image (with control_type), subject_images (with subject_description and subject_type), or style_image. You can combine multiple reference types for advanced customization.",
            },
          },
          {
            name: TOOL_LIST_SEMANTIC_CLASSES,
            description: "List semantic segmentation class IDs for use with edit_image's mask_mode='semantic'. Returns a searchable database of 194 object classes (0-193) supported by Imagen API for semantic masking.",
            inputSchema: {
              type: "object",
              properties: {
                category: {
                  type: "string",
                  description: "Filter by category (e.g., '人物', '動物', '乗り物', '家具', '電化製品', '食品', '建物・構造', '自然', '屋外設備', 'スポーツ用品', 'アクセサリー', 'その他')",
                },
                search: {
                  type: "string",
                  description: "Search by keyword in Japanese or English (e.g., '車', 'car', '人', 'person')",
                },
                ids: {
                  type: "array",
                  items: {
                    type: "integer"
                  },
                  description: "Get details for specific class IDs (e.g., [125, 175, 176])",
                }
              },
              description: "Filter options: category (by category), search (keyword search), ids (specific IDs). If no parameters provided, returns all classes grouped by category with commonly used IDs highlighted."
            },
          }
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case TOOL_GENERATE_IMAGE:
            return await this.generateImage(args as unknown as GenerateImageArgs);
          case TOOL_EDIT_IMAGE:
            return await this.editImage(args as unknown as EditImageArgs);
          case TOOL_UPSCALE_IMAGE:
            return await this.upscaleImage(args as unknown as UpscaleImageArgs);
          case TOOL_GENERATE_AND_UPSCALE_IMAGE:
            return await this.generateAndUpscaleImage(args as unknown as GenerateAndUpscaleImageArgs);
          case TOOL_CUSTOMIZE_IMAGE:
            return await this.customizeImage(args as unknown as CustomizeImageArgs);
          case TOOL_LIST_GENERATED_IMAGES:
            return await this.listGeneratedImages(args as unknown as ListGeneratedImagesArgs);
          case TOOL_LIST_SEMANTIC_CLASSES:
            return await this.listSemanticClasses(args as unknown as ListSemanticClassesArgs);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private async generateImage(args: GenerateImageArgs) {
    return await handleGenerateImage(this.toolContext, args);
  }

  private async editImage(args: EditImageArgs) {
    return await handleEditImage(this.toolContext, args);
  }

  private async upscaleImage(args: UpscaleImageArgs) {
    return await handleUpscaleImage(this.toolContext, args);
  }

  private async generateAndUpscaleImage(args: GenerateAndUpscaleImageArgs) {
    return await handleGenerateAndUpscaleImage(this.toolContext, args);
  }

  private async listGeneratedImages(args: ListGeneratedImagesArgs) {
    return await handleListGeneratedImages(this.toolContext, args);
  }

  private async customizeImage(args: CustomizeImageArgs) {
    return await handleCustomizeImage(this.toolContext, args);
  }

  private async listSemanticClasses(args: ListSemanticClassesArgs) {
    return await handleListSemanticClasses(this.toolContext, args);
  }

  private setupResourceHandlers() {
    // リソース一覧の取得
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      try {
        const resources = await this.resourceManager.listResources();

        return {
          resources: resources.map(r => ({
            uri: r.uri,
            name: r.name,
            mimeType: r.mimeType,
            description: r.description,
          }))
        };
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to list resources: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });

    // リソースの読み込み
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        const uri = request.params.uri;
        const buffer = await this.resourceManager.readResource(uri);
        const metadata = await this.resourceManager.getResourceMetadata(uri);

        if (!metadata) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Resource not found: ${uri}`
          );
        }

        // Base64エンコード
        const base64Data = buffer.toString('base64');

        return {
          contents: [
            {
              uri: uri,
              mimeType: metadata.mimeType,
              blob: base64Data
            }
          ]
        };
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to read resource: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }


  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    if (process.env.DEBUG) {
      console.error("VertexAI Imagen MCP server running on stdio (DEBUG mode)");
    } else {
      console.error("VertexAI Imagen MCP server running on stdio");
    }
  }
}

const server = new GoogleImagenMCPServer();
server.run().catch(console.error);
