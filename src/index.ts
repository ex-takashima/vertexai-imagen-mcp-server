#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { GoogleAuth } from 'google-auth-library';

// Google Imagen API の設定
const GOOGLE_REGION = process.env.GOOGLE_REGION || 'asia-northeast1';
const GOOGLE_IMAGEN_MODEL = process.env.GOOGLE_IMAGEN_MODEL || 'imagen-3.0-generate-002';
const GOOGLE_IMAGEN_UPSCALE_MODEL = process.env.GOOGLE_IMAGEN_UPSCALE_MODEL || 'imagegeneration@002';

// プロジェクトIDを動的に取得するための関数
let PROJECT_ID: string | null = null;

async function getProjectId(auth: GoogleAuth): Promise<string> {
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

// APIのURLを動的に生成する関数
function getImagenApiUrl(projectId: string): string {
  return `https://${GOOGLE_REGION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${GOOGLE_REGION}/publishers/google/models/${GOOGLE_IMAGEN_MODEL}:predict`;
}

function getUpscaleApiUrl(projectId: string): string {
  return `https://${GOOGLE_REGION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${GOOGLE_REGION}/publishers/google/models/${GOOGLE_IMAGEN_UPSCALE_MODEL}:predict`;
}

interface GoogleImagenRequest {
  instances: Array<{
    prompt: string;
  }>;
  parameters?: {
    sampleCount?: number;
    aspectRatio?: string;
    safetySettings?: Array<{
      category: string;
      threshold: string;
    }>;
    personGeneration?: string;
  };
}

interface GoogleUpscaleRequest {
  instances: Array<{
    prompt?: string;
    image?: {
      bytesBase64Encoded: string;
    };
  }>;
  parameters: {
    mode: string;
    upscaleConfig: {
      upscaleFactor: string;
    };
    sampleCount?: number;
  };
}

interface GoogleImagenResponse {
  predictions: Array<{
    bytesBase64Encoded: string;
    mimeType: string;
  }>;
}


interface GenerateImageArgs {
  prompt: string;
  output_path?: string;
  aspect_ratio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  return_base64?: boolean;
  safety_level?: "BLOCK_NONE" | "BLOCK_ONLY_HIGH" | "BLOCK_MEDIUM_AND_ABOVE" | "BLOCK_LOW_AND_ABOVE";
  person_generation?: "DONT_ALLOW" | "ALLOW_ADULT" | "ALLOW_ALL";
}

interface UpscaleImageArgs {
  input_path: string;
  output_path?: string;
  scale_factor?: "2" | "4";
  return_base64?: boolean;
}

interface GenerateAndUpscaleImageArgs {
  prompt: string;
  output_path?: string;
  aspect_ratio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  scale_factor?: "2" | "4";
  return_base64?: boolean;
  safety_level?: "BLOCK_NONE" | "BLOCK_ONLY_HIGH" | "BLOCK_MEDIUM_AND_ABOVE" | "BLOCK_LOW_AND_ABOVE";
  person_generation?: "DONT_ALLOW" | "ALLOW_ADULT" | "ALLOW_ALL";
}

interface ListGeneratedImagesArgs {
  directory?: string;
}

const TOOL_GENERATE_IMAGE = "generate_image";
const TOOL_UPSCALE_IMAGE = "upscale_image";
const TOOL_GENERATE_AND_UPSCALE_IMAGE = "generate_and_upscale_image";
const TOOL_LIST_GENERATED_IMAGES = "list_generated_images";

class GoogleImagenMCPServer {
  private server: Server;
  private auth: GoogleAuth;

  private createImageResponse(imageBuffer: Buffer, mimeType: string, filePath?: string, additionalInfo?: string) {
    const base64Data = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    
    let responseText = additionalInfo || '';
    if (filePath) {
      responseText += `\nSaved to: ${filePath}`;
    }
    responseText += `\nFile size: ${imageBuffer.length} bytes\nMIME type: ${mimeType}`;

    return {
      content: [
        {
          type: "text",
          text: responseText
        },
        {
          type: "image",
          data: dataUrl,
          mimeType: mimeType
        }
      ],
    };
  }

  constructor() {
    this.server = new Server(
      {
        name: "google-imagen-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Google Cloud認証の設定
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      credentials: process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? 
        JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY) : undefined,
    });

    this.setupToolHandlers();
    this.handleProcessArguments();
  }

  private handleProcessArguments() {
    // --version フラグの処理
    if (process.argv.includes('--version') || process.argv.includes('-v')) {
      console.log('0.1.0');
      process.exit(0);
    }

    // --help フラグの処理
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      console.log(`
Google Imagen MCP Server v0.1.0

Usage: google-imagen-mcp-server [options]

Options:
  -v, --version    Show version number
  -h, --help       Show help
  
Environment Variables:
  GOOGLE_SERVICE_ACCOUNT_KEY      Service account JSON key (required)
  GOOGLE_PROJECT_ID               Google Cloud Project ID (optional, auto-detected from service account)
  GOOGLE_REGION                   Region (optional, default: asia-northeast1)
  GOOGLE_IMAGEN_MODEL            Model name (optional, default: imagen-3.0-generate-002)
  DEBUG                          Enable debug logging

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
            description: "Generate an image using Google Imagen API",
            inputSchema: {
              type: "object",
              properties: {
                prompt: {
                  type: "string",
                  description: "Text prompt describing the image to generate",
                },
                output_path: {
                  type: "string",
                  description: "Optional path to save the generated image (default: generated_image.png)",
                },
                aspect_ratio: {
                  type: "string",
                  enum: ["1:1", "3:4", "4:3", "9:16", "16:9"],
                  description: "Aspect ratio of the generated image (default: 1:1). Options: 1:1 (square), 3:4 (portrait), 4:3 (landscape), 9:16 (tall), 16:9 (wide)",
                },
                return_base64: {
                  type: "boolean",
                  description: "Return image as base64 encoded data for display in MCP client instead of saving to file (default: false)",
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
                }
              },
              required: ["prompt"],
            },
          },
          {
            name: TOOL_UPSCALE_IMAGE,
            description: "Upscale an existing image using Google Imagen API",
            inputSchema: {
              type: "object",
              properties: {
                input_path: {
                  type: "string",
                  description: "Path to the input image file to upscale",
                },
                output_path: {
                  type: "string",
                  description: "Optional path to save the upscaled image (default: upscaled_[original_name])",
                },
                scale_factor: {
                  type: "string",
                  enum: ["2", "4"],
                  description: "Upscaling factor - 2x or 4x (default: 2)",
                },
                return_base64: {
                  type: "boolean",
                  description: "Return image as base64 encoded data for display in MCP client instead of saving to file (default: false)",
                }
              },
              required: ["input_path"],
            },
          },
          {
            name: TOOL_GENERATE_AND_UPSCALE_IMAGE,
            description: "Generate an image and automatically upscale it using Google Imagen API",
            inputSchema: {
              type: "object",
              properties: {
                prompt: {
                  type: "string",
                  description: "Text prompt describing the image to generate",
                },
                output_path: {
                  type: "string",
                  description: "Optional path to save the final upscaled image (default: generated_upscaled_image.png)",
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
                  description: "Return image as base64 encoded data for display in MCP client instead of saving to file (default: false)",
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
      safety_level = "BLOCK_MEDIUM_AND_ABOVE",
      person_generation = "DONT_ALLOW"
    } = args;

    if (!prompt || typeof prompt !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, "prompt is required and must be a string");
    }

    // デバッグログ
    if (process.env.DEBUG) {
      console.error(`[DEBUG] Generating image with prompt: ${prompt}`);
      console.error(`[DEBUG] Output path: ${output_path}`);
      console.error(`[DEBUG] Aspect ratio: ${aspect_ratio}`);
      console.error(`[DEBUG] Safety level: ${safety_level}`);
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
        personGeneration: person_generation
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
      const apiUrl = getImagenApiUrl(projectId);
      
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
        
        return this.createImageResponse(
          imageBuffer, 
          generatedImage.mimeType,
          undefined,
          `Image generated successfully!\n\nPrompt: ${prompt}\nAspect ratio: ${aspect_ratio}`
        );
      } else {
        // ファイル保存モード
        const fullPath = path.resolve(output_path);
        await fs.writeFile(fullPath, imageBuffer);

        if (process.env.DEBUG) {
          console.error(`[DEBUG] Image saved to: ${fullPath}`);
        }

        return {
          content: [
            {
              type: "text",
              text: `Image generated successfully!\n\nPrompt: ${prompt}\nAspect ratio: ${aspect_ratio}\nSaved to: ${fullPath}\nFile size: ${imageBuffer.length} bytes\nMIME type: ${generatedImage.mimeType}`
            }
          ],
        };
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

  private async upscaleImage(args: UpscaleImageArgs) {
    const {
      input_path,
      output_path,
      scale_factor = "2",
      return_base64 = false
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
      // 入力画像ファイルを読み込み
      const inputImageBuffer = await fs.readFile(input_path);
      const inputImageBase64 = inputImageBuffer.toString('base64');

      // 出力パスの設定
      const parsedPath = path.parse(input_path);
      const defaultOutputPath = path.join(parsedPath.dir, `upscaled_${scale_factor}x_${parsedPath.base}`);
      const finalOutputPath = output_path || defaultOutputPath;

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
      const apiUrl = getUpscaleApiUrl(projectId);
      
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
        
        return this.createImageResponse(
          imageBuffer, 
          upscaledImage.mimeType,
          undefined,
          `Image upscaled successfully!\n\nInput: ${input_path}\nScale factor: ${scale_factor}`
        );
      } else {
        // ファイル保存モード
        const fullPath = path.resolve(finalOutputPath);
        await fs.writeFile(fullPath, imageBuffer);

        if (process.env.DEBUG) {
          console.error(`[DEBUG] Upscaled image saved to: ${fullPath}`);
        }

        return {
          content: [
            {
              type: "text",
              text: `Image upscaled successfully!\n\nInput: ${input_path}\nScale factor: ${scale_factor}\nSaved to: ${fullPath}\nFile size: ${imageBuffer.length} bytes\nMIME type: ${upscaledImage.mimeType}`
            }
          ],
        };
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
      safety_level = "BLOCK_MEDIUM_AND_ABOVE",
      person_generation = "DONT_ALLOW"
    } = args;

    if (!prompt || typeof prompt !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, "prompt is required and must be a string");
    }

    // デバッグログ
    if (process.env.DEBUG) {
      console.error(`[DEBUG] Generating and upscaling image with prompt: ${prompt}`);
      console.error(`[DEBUG] Aspect ratio: ${aspect_ratio}, Scale factor: ${scale_factor}`);
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
        person_generation
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
        return_base64
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
              text: `Image generated and upscaled successfully!\n\nPrompt: ${prompt}\nAspect ratio: ${aspect_ratio}\nScale factor: ${scale_factor}\n\nProcess completed in 2 steps:\n1. Generated original image\n2. Upscaled to ${scale_factor}x resolution\n\nFile size: ${originalContent.text?.match(/File size: (\d+) bytes/)?.[1] || 'unknown'} bytes`
            },
            imageContent
          ],
        };
      } else {
        // ファイル保存モード
        return {
          content: [
            {
              type: "text",
              text: `Image generated and upscaled successfully!\n\nPrompt: ${prompt}\nAspect ratio: ${aspect_ratio}\nScale factor: ${scale_factor}\nFinal output: ${path.resolve(output_path)}\n\nProcess completed in 2 steps:\n1. Generated original image\n2. Upscaled to ${scale_factor}x resolution`
            }
          ],
        };
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


  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    if (process.env.DEBUG) {
      console.error("Google Imagen MCP server running on stdio (DEBUG mode)");
    } else {
      console.error("Google Imagen MCP server running on stdio");
    }
  }
}

const server = new GoogleImagenMCPServer();
server.run().catch(console.error);
