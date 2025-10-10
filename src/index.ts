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
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { GoogleAuth } from 'google-auth-library';
import { createRequire } from 'module';
import { normalizeAndValidatePath, getDisplayPath, getDefaultOutputDirectory, resolveInputPath } from './utils/path.js';
import { getProjectId, getImagenApiUrl, getUpscaleApiUrl } from './utils/auth.js';
import { ImageResourceManager } from './utils/resources.js';
import {
  normalizeBase64String,
  detectMimeTypeFromPath,
  resolveImageSource,
  createImageResponse,
  createUriImageResponse,
  type ResolvedImageSource
} from './utils/image.js';
import type {
  GoogleImagenRequest,
  GoogleImagenResponse,
  GoogleUpscaleRequest,
  GoogleImagenEditRequest,
  ReferenceImage
} from './types/api.js';
import type {
  GenerateImageArgs,
  UpscaleImageArgs,
  GenerateAndUpscaleImageArgs,
  ListGeneratedImagesArgs,
  EditImageArgs
} from './types/tools.js';

const require = createRequire(import.meta.url);
const { version: PACKAGE_VERSION } = require('../package.json') as { version: string };

// Google Imagen API の設定
const GOOGLE_IMAGEN_EDIT_MODEL = process.env.GOOGLE_IMAGEN_EDIT_MODEL || 'imagen-3.0-capability-001';

const TOOL_GENERATE_IMAGE = "generate_image";
const TOOL_UPSCALE_IMAGE = "upscale_image";
const TOOL_GENERATE_AND_UPSCALE_IMAGE = "generate_and_upscale_image";
const TOOL_LIST_GENERATED_IMAGES = "list_generated_images";
const TOOL_EDIT_IMAGE = "edit_image";

class GoogleImagenMCPServer {
  private server: Server;
  private auth: GoogleAuth;
  private resourceManager: ImageResourceManager;

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
                  enum: ["imagen-4.0-ultra-generate-preview-06-06", "imagen-4.0-fast-generate-preview-06-06", "imagen-4.0-generate-preview-06-06", "imagen-3.0-generate-002", "imagen-3.0-fast-generate-001"],
                  description: "Imagen model to use (default: imagen-3.0-generate-002)",
                },
                region: {
                  type: "string",
                  description: "Google Cloud region to use (default: from environment variable GOOGLE_REGION or us-central1)",
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
                  maximum: 1,
                  description: "Number of images to generate (only 1 is supported currently)",
                },
                negative_prompt: {
                  type: "string",
                  description: "Optional negative text prompt to avoid certain traits",
                },
                model: {
                  type: "string",
                  enum: ["imagen-3.0-capability-001", "imagegeneration@006", "imagegeneration@005", "imagegeneration@002"],
                  description: "Imagen edit model to use (default: imagen-3.0-capability-001)",
                },
                region: {
                  type: "string",
                  description: "Google Cloud region to use (default: from environment variable GOOGLE_REGION or us-central1)",
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
                  enum: ["imagen-4.0-ultra-generate-preview-06-06", "imagen-4.0-fast-generate-preview-06-06", "imagen-4.0-generate-preview-06-06", "imagen-3.0-generate-002", "imagen-3.0-fast-generate-001"],
                  description: "Imagen model to use (default: imagen-3.0-generate-002)",
                },
                region: {
                  type: "string",
                  description: "Google Cloud region to use (default: from environment variable GOOGLE_REGION or us-central1)",
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
          case TOOL_LIST_GENERATED_IMAGES:
            return await this.listGeneratedImages(args as unknown as ListGeneratedImagesArgs);
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
    const {
      prompt,
      output_path = "generated_image.png",
      aspect_ratio = "1:1",
      return_base64 = false,
      include_thumbnail,
      safety_level = "BLOCK_MEDIUM_AND_ABOVE",
      person_generation = "DONT_ALLOW",
      language = "auto",
      model = "imagen-3.0-generate-002",
      region
    } = args;

    if (!prompt || typeof prompt !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, "prompt is required and must be a string");
    }

    // Normalize path BEFORE API call (to avoid wasting API quota on invalid paths)
    const normalizedPath = return_base64 ? undefined : await normalizeAndValidatePath(output_path);

    // デバッグログ
    if (process.env.DEBUG) {
      console.error(`[DEBUG] Generating image with prompt: ${prompt}`);
      console.error(`[DEBUG] Output path: ${output_path}`);
      if (normalizedPath) {
        console.error(`[DEBUG] Normalized path: ${normalizedPath}`);
      }
      console.error(`[DEBUG] Aspect ratio: ${aspect_ratio}`);
      console.error(`[DEBUG] Safety level: ${safety_level}`);
      console.error(`[DEBUG] Model: ${model}`);
    }

    const requestBody: GoogleImagenRequest = {
      instances: [
        {
          prompt: prompt
        }
      ],
      parameters: {
        sampleCount: 1,
        aspectRatio: aspect_ratio,
        safetySettings: [
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: safety_level
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH", 
            threshold: safety_level
          },
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: safety_level
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: safety_level
          }
        ],
        personGeneration: person_generation,
        language: language
      }
    };

    try {
      // OAuth2アクセストークンを取得
      const authClient = await this.auth.getClient();
      const accessToken = await authClient.getAccessToken();

      if (!accessToken.token) {
        throw new Error('Failed to obtain access token');
      }

      // プロジェクトIDを取得してAPIのURLを構築
      const projectId = await getProjectId(this.auth);
      const apiUrl = getImagenApiUrl(projectId, model, region);
      
      const response = await axios.post<GoogleImagenResponse>(
        apiUrl,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken.token}`,
          },
          timeout: 30000, // 30秒のタイムアウト
        }
      );

      if (!response.data.predictions || response.data.predictions.length === 0) {
        throw new Error('No images were generated');
      }

      const generatedImage = response.data.predictions[0];
      const imageBuffer = Buffer.from(generatedImage.bytesBase64Encoded, 'base64');
      
      if (return_base64) {
        // Base64モード: 画像データを直接返す
        if (process.env.DEBUG) {
          console.error(`[DEBUG] Returning image as base64 data`);
        }

        // 警告: Base64モードのトークン消費について
        console.error(`[DEPRECATED WARNING] return_base64=true is deprecated and will be removed in v1.0.0`);
        console.error(`[WARNING] This mode consumes ~1,500 tokens per image. Use file save mode with Resources API instead.`);
        console.error(`[INFO] The default mode (return_base64=false) now returns images via file:// URI for optimal performance.`);
        
        return createImageResponse(
          imageBuffer,
          generatedImage.mimeType,
          undefined,
          `Image generated successfully!\n\nPrompt: ${prompt}\nAspect ratio: ${aspect_ratio}\nModel: ${model}`
        );
      } else {
        // ファイル保存モード
        if (!normalizedPath) {
          throw new Error(
            'Normalized path is required for file save mode.\n' +
            'This is an internal error - please report this issue.'
          );
        }

        await fs.writeFile(normalizedPath, imageBuffer);

        if (process.env.DEBUG) {
          console.error(`[DEBUG] Image saved to: ${normalizedPath}`);
        }

        const displayPath = getDisplayPath(normalizedPath);
        const fileUri = this.resourceManager.getFileUri(normalizedPath);

        // Determine if thumbnail should be generated
        const shouldIncludeThumbnail = include_thumbnail !== undefined
          ? include_thumbnail
          : (process.env.VERTEXAI_IMAGEN_THUMBNAIL === 'true');

        return await createUriImageResponse(
          fileUri,
          generatedImage.mimeType,
          imageBuffer.length,
          displayPath,
          normalizedPath,
          `Image generated successfully!\n\nPrompt: ${prompt}\nAspect ratio: ${aspect_ratio}\nModel: ${model}`,
          shouldIncludeThumbnail
        );
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || error.message;
        const errorCode = error.response?.status;

        if (process.env.DEBUG) {
          console.error(`[DEBUG] API Error: ${errorMessage}`);
          console.error(`[DEBUG] API Status Code: ${errorCode}`);
        }

        if (errorCode === 401 || errorCode === 403) {
          throw new McpError(ErrorCode.InvalidRequest, `Google Imagen API authentication error: ${errorMessage}`);
        }
        if (errorCode === 400) {
          throw new McpError(ErrorCode.InvalidParams, `Google Imagen API invalid parameter error: ${errorMessage}`);
        }
        if (errorCode && errorCode >= 500) {
          throw new McpError(ErrorCode.InternalError, `Google Imagen API server error: ${errorMessage}`);
        }
        
        throw new McpError(ErrorCode.InternalError, `Google Imagen API error: ${errorMessage}`);
      }
      throw error;
    }
  }

  private async editImage(args: EditImageArgs) {
    const {
      prompt,
      reference_image_base64,
      reference_image_path,
      mask_image_base64,
      mask_image_path,
      mask_mode,
      mask_classes,
      mask_dilation = 0.01,
      edit_mode = "inpaint_insertion",
      base_steps,
      output_path = "edited_image.png",
      return_base64 = false,
      include_thumbnail,
      guidance_scale,
      sample_count = 1,
      negative_prompt,
      model = GOOGLE_IMAGEN_EDIT_MODEL,
      region
    } = args;

    if (!prompt || typeof prompt !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, "prompt is required and must be a string");
    }

    if (sample_count !== 1) {
      throw new McpError(ErrorCode.InvalidParams, "sample_count other than 1 is not supported yet");
    }

    // Normalize path BEFORE API call
    const normalizedPath = return_base64 ? undefined : await normalizeAndValidatePath(output_path);

    // Parameter validation for mask mode and mask sources
    if (mask_mode === "semantic" && (!mask_classes || mask_classes.length === 0)) {
      throw new McpError(ErrorCode.InvalidParams, "mask_classes array is required and must not be empty when mask_mode is 'semantic'");
    }

    if (mask_mode === "user_provided" && !mask_image_base64 && !mask_image_path) {
      // For user_provided mode, if no mask is provided, treat as no masking (full image edit)
      if (process.env.DEBUG) {
        console.error(`[DEBUG] mask_mode is 'user_provided' but no mask image provided - proceeding without mask`);
      }
    }

    if ((mask_image_base64 || mask_image_path) && mask_mode !== "user_provided" && mask_mode !== undefined) {
      throw new McpError(ErrorCode.InvalidParams, "mask_image_base64/mask_image_path can only be used when mask_mode is 'user_provided'");
    }

    if (mask_mode && mask_mode !== "mask_free" && (mask_dilation < 0 || mask_dilation > 1)) {
      throw new McpError(ErrorCode.InvalidParams, "mask_dilation must be between 0 and 1");
    }

    const baseImage = await resolveImageSource({
      base64Value: reference_image_base64,
      pathValue: reference_image_path,
      label: "Reference image",
      required: true,
    });

    if (!baseImage) {
      throw new McpError(ErrorCode.InvalidParams, "Reference image could not be resolved");
    }

    // Build reference images array
    const referenceImages: ReferenceImage[] = [
      {
        referenceType: "REFERENCE_TYPE_RAW",
        referenceId: 0,
        referenceImage: {
          bytesBase64Encoded: baseImage.base64,
          ...(baseImage.mimeType ? { mimeType: baseImage.mimeType } : {})
        }
      }
    ];

    // Handle mask configuration
    if (mask_mode === "user_provided") {
      // User-provided mask image
      const maskImage = await resolveImageSource({
        base64Value: mask_image_base64,
        pathValue: mask_image_path,
        label: "Mask image",
      });

      if (maskImage) {
        referenceImages.push({
          referenceType: "REFERENCE_TYPE_MASK",
          referenceId: 1,
          referenceImage: {
            bytesBase64Encoded: maskImage.base64,
            ...(maskImage.mimeType ? { mimeType: maskImage.mimeType } : {})
          },
          maskImageConfig: {
            maskMode: "MASK_MODE_USER_PROVIDED",
            dilation: mask_dilation
          }
        });
      }
    } else if (mask_mode && ["background", "foreground", "semantic"].includes(mask_mode)) {
      // Automatic mask generation
      const maskModeMap = {
        "background": "MASK_MODE_BACKGROUND",
        "foreground": "MASK_MODE_FOREGROUND",
        "semantic": "MASK_MODE_SEMANTIC"
      } as const;

      const maskConfig: ReferenceImage = {
        referenceType: "REFERENCE_TYPE_MASK",
        referenceId: 1,
        maskImageConfig: {
          maskMode: maskModeMap[mask_mode as keyof typeof maskModeMap],
          dilation: mask_dilation
        }
      };

      if (mask_mode === "semantic" && mask_classes) {
        maskConfig.maskImageConfig!.maskClasses = mask_classes;
      } else if (mask_mode === "semantic" && !mask_classes) {
        throw new McpError(ErrorCode.InvalidParams, "mask_classes is required when mask_mode is 'semantic'");
      }

      referenceImages.push(maskConfig);
    } else if (!mask_mode || mask_mode === "mask_free") {
      // Mask-free editing: no mask is added
      // Only the base image reference is used (already added above)
      if (process.env.DEBUG) {
        console.error(`[DEBUG] Mask-free editing mode - no mask will be applied`);
      }
    }

    // Map edit mode to API format
    const editModeMap = {
      "inpaint_removal": "EDIT_MODE_INPAINT_REMOVAL",
      "inpaint_insertion": "EDIT_MODE_INPAINT_INSERTION",
      "bgswap": "EDIT_MODE_BGSWAP",
      "outpainting": "outpainting"
    } as const;

    const apiEditMode = editModeMap[edit_mode as keyof typeof editModeMap] || "edit";

    const requestBody: GoogleImagenEditRequest = {
      instances: [
        {
          prompt,
          referenceImages
        }
      ],
      parameters: {
        editMode: apiEditMode,
      }
    };

    // Add edit config if base_steps is specified
    if (base_steps !== undefined) {
      if (typeof base_steps !== 'number' || Number.isNaN(base_steps) || base_steps < 1) {
        throw new McpError(ErrorCode.InvalidParams, "base_steps must be a positive number");
      }
      requestBody.parameters.editConfig = {
        baseSteps: base_steps
      };
    }

    if (guidance_scale !== undefined) {
      if (typeof guidance_scale !== 'number' || Number.isNaN(guidance_scale)) {
        throw new McpError(ErrorCode.InvalidParams, "guidance_scale must be a number");
      }
      requestBody.parameters.guidanceScale = guidance_scale;
    }

    if (negative_prompt) {
      if (typeof negative_prompt !== 'string') {
        throw new McpError(ErrorCode.InvalidParams, "negative_prompt must be a string");
      }
      requestBody.parameters.negativePrompt = negative_prompt;
    }

    if (sample_count) {
      requestBody.parameters.sampleCount = sample_count;
    }

    if (process.env.DEBUG) {
      console.error(`[DEBUG] Editing image`);
      console.error(`[DEBUG] Model: ${model}`);
      console.error(`[DEBUG] Edit mode: ${edit_mode} -> ${apiEditMode}`);
      console.error(`[DEBUG] Mask mode: ${mask_mode}`);
      console.error(`[DEBUG] Return as base64: ${return_base64}`);
      console.error(`[DEBUG] Reference images count: ${referenceImages.length}`);
      console.error(
        `[DEBUG] Reference image source: ${
          baseImage.source === "file"
            ? `file:${baseImage.filePath}`
            : baseImage.source === "data-uri"
              ? 'data URI'
              : 'base64 string'
        }`
      );
      if (mask_mode === "semantic" && mask_classes) {
        console.error(`[DEBUG] Semantic mask classes: ${mask_classes.join(', ')}`);
      }
      if (mask_dilation !== undefined) {
        console.error(`[DEBUG] Mask dilation: ${mask_dilation}`);
      }
      if (base_steps !== undefined) {
        console.error(`[DEBUG] Base steps: ${base_steps}`);
      }
      if (guidance_scale !== undefined) {
        console.error(`[DEBUG] Guidance scale: ${guidance_scale}`);
      }
      if (negative_prompt) {
        console.error(`[DEBUG] Negative prompt: ${negative_prompt}`);
      }
    }

    try {
      const authClient = await this.auth.getClient();
      const accessToken = await authClient.getAccessToken();

      if (!accessToken.token) {
        throw new Error('Failed to obtain access token');
      }

      const projectId = await getProjectId(this.auth);
      const apiUrl = getImagenApiUrl(projectId, model, region);

      const response = await axios.post<GoogleImagenResponse>(
        apiUrl,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken.token}`,
          },
          timeout: 45000,
        }
      );

      if (!response.data.predictions || response.data.predictions.length === 0) {
        throw new Error('Editing failed - no output received');
      }

      const editedImage = response.data.predictions[0];
      const imageBuffer = Buffer.from(editedImage.bytesBase64Encoded, 'base64');

      const maskApplied = referenceImages.length > 1 ? 'yes' : 'no';
      const infoText = `Image edited successfully!\n\nPrompt: ${prompt}\nModel: ${model}\nEdit mode: ${edit_mode}\nMask mode: ${mask_mode}\nMask applied: ${maskApplied}`;

      if (return_base64) {
        // 警告: Base64モードのトークン消費について
        console.error(`[DEPRECATED WARNING] return_base64=true is deprecated and will be removed in v1.0.0`);
        console.error(`[WARNING] This mode consumes ~1,500 tokens per image. Use file save mode with Resources API instead.`);
        console.error(`[INFO] The default mode (return_base64=false) now returns images via file:// URI for optimal performance.`);

        return createImageResponse(
          imageBuffer,
          editedImage.mimeType,
          undefined,
          infoText
        );
      }

      if (!normalizedPath) {
        throw new Error('Normalized path is required for file save mode');
      }

      await fs.writeFile(normalizedPath, imageBuffer);

      const displayPath = getDisplayPath(normalizedPath);
      const fileUri = this.resourceManager.getFileUri(normalizedPath);

      // Determine if thumbnail should be generated
      const shouldIncludeThumbnail = include_thumbnail !== undefined
        ? include_thumbnail
        : (process.env.VERTEXAI_IMAGEN_THUMBNAIL === 'true');

      return await createUriImageResponse(
        fileUri,
        editedImage.mimeType,
        imageBuffer.length,
        displayPath,
        normalizedPath,
        infoText,
        shouldIncludeThumbnail
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || error.message;
        const errorCode = error.response?.status;

        if (process.env.DEBUG) {
          console.error(`[DEBUG] Edit API Error: ${errorMessage}`);
          console.error(`[DEBUG] Edit API Status Code: ${errorCode}`);
        }

        if (errorCode === 401 || errorCode === 403) {
          throw new McpError(ErrorCode.InvalidRequest, `Google Imagen API authentication error: ${errorMessage}`);
        }
        if (errorCode === 400) {
          throw new McpError(ErrorCode.InvalidParams, `Google Imagen API invalid parameter error: ${errorMessage}`);
        }
        if (errorCode && errorCode >= 500) {
          throw new McpError(ErrorCode.InternalError, `Google Imagen API server error: ${errorMessage}`);
        }

        throw new McpError(ErrorCode.InternalError, `Google Imagen API error: ${errorMessage}`);
      }
      throw error;
    }
  }

  private async upscaleImage(args: UpscaleImageArgs) {
    const {
      input_path,
      output_path,
      scale_factor = "2",
      return_base64 = false,
      include_thumbnail,
      region
    } = args;

    if (!input_path || typeof input_path !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, "input_path is required and must be a string");
    }

    // デバッグログ
    if (process.env.DEBUG) {
      console.error(`[DEBUG] Upscaling image: ${input_path}`);
      console.error(`[DEBUG] Scale factor: ${scale_factor}`);
    }

    try {
      // 入力画像ファイルパスを解決（相対パスの場合はVERTEXAI_IMAGEN_OUTPUT_DIRから解決）
      const resolvedInputPath = resolveInputPath(input_path);

      if (process.env.DEBUG) {
        console.error(`[DEBUG] Resolved input path: ${resolvedInputPath}`);
      }

      // 入力画像ファイルを読み込み
      const inputImageBuffer = await fs.readFile(resolvedInputPath);
      const inputImageBase64 = inputImageBuffer.toString('base64');

      // 出力パスの設定
      const parsedPath = path.parse(input_path);
      const defaultOutputPath = path.join(parsedPath.dir, `upscaled_${scale_factor}x_${parsedPath.base}`);
      const finalOutputPath = output_path || defaultOutputPath;

      // Normalize path BEFORE API call
      const normalizedPath = return_base64 ? undefined : await normalizeAndValidatePath(finalOutputPath);

      const requestBody: GoogleUpscaleRequest = {
        instances: [
          {
            prompt: "",
            image: {
              bytesBase64Encoded: inputImageBase64
            }
          }
        ],
        parameters: {
          mode: "upscale",
          upscaleConfig: {
            upscaleFactor: `x${scale_factor}`
          },
          sampleCount: 1
        }
      };

      // OAuth2アクセストークンを取得
      const authClient = await this.auth.getClient();
      const accessToken = await authClient.getAccessToken();

      if (!accessToken.token) {
        throw new Error('Failed to obtain access token');
      }

      // プロジェクトIDを取得してAPIのURLを構築
      const projectId = await getProjectId(this.auth);
      const apiUrl = getUpscaleApiUrl(projectId, region);
      
      const response = await axios.post<GoogleImagenResponse>(
        apiUrl,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken.token}`,
          },
          timeout: 60000, // アップスケーリングは時間がかかるため60秒に設定
        }
      );

      if (!response.data.predictions || response.data.predictions.length === 0) {
        throw new Error('Upscaling failed - no output received');
      }

      const upscaledImage = response.data.predictions[0];
      const imageBuffer = Buffer.from(upscaledImage.bytesBase64Encoded, 'base64');
      
      if (return_base64) {
        // Base64モード: 画像データを直接返す
        if (process.env.DEBUG) {
          console.error(`[DEBUG] Returning upscaled image as base64 data`);
        }

        // 警告: Base64モードのトークン消費について
        console.error(`[DEPRECATED WARNING] return_base64=true is deprecated and will be removed in v1.0.0`);
        console.error(`[WARNING] This mode consumes ~1,500 tokens per image. Use file save mode with Resources API instead.`);
        console.error(`[INFO] The default mode (return_base64=false) now returns images via file:// URI for optimal performance.`);

        return createImageResponse(
          imageBuffer,
          upscaledImage.mimeType,
          undefined,
          `Image upscaled successfully!\n\nInput: ${input_path}\nScale factor: ${scale_factor}`
        );
      } else {
        // ファイル保存モード
        if (!normalizedPath) {
          throw new Error(
            'Normalized path is required for file save mode.\n' +
            'This is an internal error - please report this issue.'
          );
        }

        await fs.writeFile(normalizedPath, imageBuffer);

        if (process.env.DEBUG) {
          console.error(`[DEBUG] Upscaled image saved to: ${normalizedPath}`);
        }

        const displayPath = getDisplayPath(normalizedPath);
        const fileUri = this.resourceManager.getFileUri(normalizedPath);

        // Determine if thumbnail should be generated
        const shouldIncludeThumbnail = include_thumbnail !== undefined
          ? include_thumbnail
          : (process.env.VERTEXAI_IMAGEN_THUMBNAIL === 'true');

        return await createUriImageResponse(
          fileUri,
          upscaledImage.mimeType,
          imageBuffer.length,
          displayPath,
          normalizedPath,
          `Image upscaled successfully!\n\nInput: ${input_path}\nScale factor: ${scale_factor}`,
          shouldIncludeThumbnail
        );
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || error.message;
        const errorCode = error.response?.status;

        if (process.env.DEBUG) {
          console.error(`[DEBUG] API Error: ${errorMessage}`);
          console.error(`[DEBUG] API Status Code: ${errorCode}`);
        }

        if (errorCode === 401 || errorCode === 403) {
          throw new McpError(ErrorCode.InvalidRequest, `Google Imagen API authentication error: ${errorMessage}`);
        }
        if (errorCode === 400) {
          throw new McpError(ErrorCode.InvalidParams, `Google Imagen API invalid parameter error: ${errorMessage}`);
        }
        if (errorCode && errorCode >= 500) {
          throw new McpError(ErrorCode.InternalError, `Google Imagen API server error: ${errorMessage}`);
        }
        
        throw new McpError(ErrorCode.InternalError, `Google Imagen API error: ${errorMessage}`);
      }
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new McpError(ErrorCode.InvalidParams, `Input image file not found: ${input_path}`);
      }
      throw error;
    }
  }

  private async generateAndUpscaleImage(args: GenerateAndUpscaleImageArgs) {
    const {
      prompt,
      output_path = "generated_upscaled_image.png",
      aspect_ratio = "1:1",
      scale_factor = "2",
      return_base64 = false,
      include_thumbnail,
      safety_level = "BLOCK_MEDIUM_AND_ABOVE",
      person_generation = "DONT_ALLOW",
      language = "auto",
      model = "imagen-3.0-generate-002",
      region
    } = args;

    if (!prompt || typeof prompt !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, "prompt is required and must be a string");
    }

    // デバッグログ
    if (process.env.DEBUG) {
      console.error(`[DEBUG] Generating and upscaling image with prompt: ${prompt}`);
      console.error(`[DEBUG] Aspect ratio: ${aspect_ratio}, Scale factor: ${scale_factor}`);
      console.error(`[DEBUG] Model: ${model}`);
      console.error(`[DEBUG] Final output path: ${output_path}`);
    }

    try {
      // Step 1: Generate the original image
      const tempImagePath = `temp_generated_${Date.now()}.png`;
      
      const generateArgs: GenerateImageArgs = {
        prompt,
        output_path: tempImagePath,
        aspect_ratio,
        safety_level,
        person_generation,
        language,
        model,
        region
      };

      const generateResult = await this.generateImage(generateArgs);
      
      if (process.env.DEBUG) {
        console.error(`[DEBUG] Step 1 completed: Image generated at ${tempImagePath}`);
      }

      // Step 2: Upscale the generated image
      const upscaleArgs: UpscaleImageArgs = {
        input_path: tempImagePath,
        output_path: return_base64 ? undefined : output_path,
        scale_factor,
        return_base64,
        region
      };

      const upscaleResult = await this.upscaleImage(upscaleArgs);

      // Step 3: Clean up temporary file
      try {
        await fs.unlink(tempImagePath);
        if (process.env.DEBUG) {
          console.error(`[DEBUG] Temporary file cleaned up: ${tempImagePath}`);
        }
      } catch (cleanupError) {
        // Non-critical error, just log it
        if (process.env.DEBUG) {
          console.error(`[DEBUG] Warning: Failed to clean up temporary file: ${tempImagePath}`);
        }
      }

      if (process.env.DEBUG) {
        console.error(`[DEBUG] Step 2 completed: Image upscaled and saved to final location`);
      }

      if (return_base64) {
        // Base64モード: upscaleResultをそのまま返すが、メッセージを更新
        const originalContent = upscaleResult.content[0];
        const imageContent = upscaleResult.content[1];
        
        return {
          content: [
            {
              type: "text",
              text: `Image generated and upscaled successfully!\n\nPrompt: ${prompt}\nAspect ratio: ${aspect_ratio}\nModel: ${model}\nScale factor: ${scale_factor}\n\nProcess completed in 2 steps:\n1. Generated original image\n2. Upscaled to ${scale_factor}x resolution\n\nFile size: ${originalContent.text?.match(/File size: (\d+) bytes/)?.[1] || 'unknown'} bytes`
            },
            imageContent
          ],
        };
      } else {
        // ファイル保存モード
        const normalizedPath = await normalizeAndValidatePath(output_path);
        const displayPath = getDisplayPath(normalizedPath);
        const fileUri = this.resourceManager.getFileUri(normalizedPath);

        // upscaleResult から画像のメタ情報を取得
        const mimeType = upscaleResult.content[0]?.text?.match(/MIME type: ([\w\/]+)/)?.[1] || 'image/png';
        const fileSize = upscaleResult.content[0]?.text?.match(/File size: (\d+) bytes/)?.[1];
        const size = fileSize ? parseInt(fileSize, 10) : 0;

        // Determine if thumbnail should be generated
        const shouldIncludeThumbnail = include_thumbnail !== undefined
          ? include_thumbnail
          : (process.env.VERTEXAI_IMAGEN_THUMBNAIL === 'true');

        return await createUriImageResponse(
          fileUri,
          mimeType,
          size,
          displayPath,
          normalizedPath,
          `Image generated and upscaled successfully!\n\nPrompt: ${prompt}\nAspect ratio: ${aspect_ratio}\nModel: ${model}\nScale factor: ${scale_factor}\n\nProcess completed in 2 steps:\n1. Generated original image\n2. Upscaled to ${scale_factor}x resolution`,
          shouldIncludeThumbnail
        );
      }
    } catch (error) {
      // Try to clean up temporary file if it exists
      const tempImagePath = `temp_generated_${Date.now()}.png`;
      try {
        await fs.unlink(tempImagePath);
      } catch {
        // Ignore cleanup errors
      }
      
      throw error;
    }
  }

  private async listGeneratedImages(args: ListGeneratedImagesArgs) {
    const { directory = "." } = args;

    try {
      const files = await fs.readdir(directory);
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

      const imageFiles = files.filter(file =>
        imageExtensions.some(ext => file.toLowerCase().endsWith(ext))
      );

      if (imageFiles.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No image files found in directory: ${path.resolve(directory)}`
            }
          ],
        };
      }

      const fileDetails = await Promise.all(
        imageFiles.map(async (file) => {
          const filePath = path.join(directory, file);
          const stats = await fs.stat(filePath);
          return {
            name: file,
            path: path.resolve(filePath),
            size: stats.size,
            modified: stats.mtime.toISOString()
          };
        })
      );

      const fileList = fileDetails
        .map(file => `• ${file.name} (${file.size} bytes, modified: ${file.modified})`)
        .join('\n');

      return {
        content: [
          {
            type: "text",
            text: `Found ${imageFiles.length} image file(s) in ${path.resolve(directory)}:\n\n${fileList}`
          }
        ],
      };
    } catch (error) {
      throw new Error(`Failed to list images: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private setupResourceHandlers() {
    // リソース一覧の取得
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      try {
        const resources = await this.resourceManager.listResources();

        if (process.env.DEBUG) {
          console.error(`[DEBUG] Listing ${resources.length} resources`);
        }

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

        if (process.env.DEBUG) {
          console.error(`[DEBUG] Reading resource: ${uri}`);
        }

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
