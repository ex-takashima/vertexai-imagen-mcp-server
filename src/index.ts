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
const GOOGLE_PROJECT_ID = process.env.GOOGLE_PROJECT_ID;
const GOOGLE_REGION = process.env.GOOGLE_REGION || 'us-central1';
const GOOGLE_IMAGEN_MODEL = process.env.GOOGLE_IMAGEN_MODEL || 'imagen-3.0-generate-001';

const GOOGLE_IMAGEN_API_URL = `https://${GOOGLE_REGION}-aiplatform.googleapis.com/v1/projects/${GOOGLE_PROJECT_ID}/locations/${GOOGLE_REGION}/publishers/google/models/${GOOGLE_IMAGEN_MODEL}:predict`;

interface GoogleImagenRequest {
  prompt: string;
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
  personGeneration?: string;
}

interface GoogleImagenResponse {
  generatedImages: Array<{
    bytesBase64Encoded: string;
    mimeType: string;
  }>;
}


interface GenerateImageArgs {
  prompt: string;
  output_path?: string;
  safety_level?: "BLOCK_NONE" | "BLOCK_ONLY_HIGH" | "BLOCK_MEDIUM_AND_ABOVE" | "BLOCK_LOW_AND_ABOVE";
  person_generation?: "DONT_ALLOW" | "ALLOW_ADULT" | "ALLOW_ALL";
}

interface ListGeneratedImagesArgs {
  directory?: string;
}

const TOOL_GENERATE_IMAGE = "generate_image";
const TOOL_LIST_GENERATED_IMAGES = "list_generated_images";

class GoogleImagenMCPServer {
  private server: Server;
  private auth: GoogleAuth;

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
      projectId: GOOGLE_PROJECT_ID,
    });

    // 必要な環境変数のチェック
    if (!GOOGLE_PROJECT_ID) {
      console.error('GOOGLE_PROJECT_ID environment variable is required');
      process.exit(1);
    }

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
  GOOGLE_PROJECT_ID               Google Cloud Project ID (required)
  GOOGLE_SERVICE_ACCOUNT_KEY      Service account JSON key (required)
  GOOGLE_REGION                   Region (optional, default: us-central1)
  GOOGLE_IMAGEN_MODEL            Model name (optional, default: imagen-3.0-generate-001)
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
      console.error(`[DEBUG] Safety level: ${safety_level}`);
    }

    const requestBody: GoogleImagenRequest = {
      prompt: prompt,
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
    };

    try {
      // OAuth2アクセストークンを取得
      const authClient = await this.auth.getClient();
      const accessToken = await authClient.getAccessToken();

      if (!accessToken.token) {
        throw new Error('Failed to obtain access token');
      }

      const response = await axios.post<GoogleImagenResponse>(
        GOOGLE_IMAGEN_API_URL,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken.token}`,
          },
          timeout: 30000, // 30秒のタイムアウト
        }
      );

      if (!response.data.generatedImages || response.data.generatedImages.length === 0) {
        throw new Error('No images were generated');
      }

      const generatedImage = response.data.generatedImages[0];
      const imageBuffer = Buffer.from(generatedImage.bytesBase64Encoded, 'base64');
      
      // ファイルに保存
      const fullPath = path.resolve(output_path);
      await fs.writeFile(fullPath, imageBuffer);

      if (process.env.DEBUG) {
        console.error(`[DEBUG] Image saved to: ${fullPath}`);
      }

      return {
        content: [
          {
            type: "text",
            text: `Image generated successfully!\n\nPrompt: ${prompt}\nSaved to: ${fullPath}\nFile size: ${imageBuffer.length} bytes\nMIME type: ${generatedImage.mimeType}`
          }
        ],
      };
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