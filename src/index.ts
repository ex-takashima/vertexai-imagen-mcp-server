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

// Google Imagine API の設定
const GOOGLE_IMAGINE_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateImage';

interface GoogleImagineRequest {
  prompt: string;
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
  personGeneration?: string;
}

interface GoogleImagineResponse {
  generatedImages: Array<{
    bytesBase64Encoded: string;
    mimeType: string;
  }>;
}

class GoogleImagineMCPServer {
  private server: Server;
  private apiKey: string;

  constructor() {
    this.server = new Server(
      {
        name: "google-imagine-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.apiKey = process.env.GOOGLE_API_KEY || '';
    if (!this.apiKey) {
      console.error('GOOGLE_API_KEY environment variable is required');
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
Google Imagine MCP Server v0.1.0

Usage: google-imagine-mcp-server [options]

Options:
  -v, --version    Show version number
  -h, --help       Show help
  
Environment Variables:
  GOOGLE_API_KEY   Google Cloud API key (required)
  DEBUG           Enable debug logging

This is an MCP (Model Context Protocol) server for Google Imagine image generation.
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
            name: "generate_image",
            description: "Generate an image using Google Imagine API",
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
            name: "list_generated_images",
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
          case "generate_image":
            return await this.generateImage(args);
          case "list_generated_images":
            return await this.listGeneratedImages(args);
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

  private async generateImage(args: any) {
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

    const requestBody: GoogleImagineRequest = {
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
      const response = await axios.post<GoogleImagineResponse>(
        GOOGLE_IMAGINE_API_URL,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
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
        if (process.env.DEBUG) {
          console.error(`[DEBUG] API Error: ${errorMessage}`);
        }
        throw new Error(`Google Imagine API error: ${errorMessage}`);
      }
      throw error;
    }
  }

  private async listGeneratedImages(args: any) {
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
      console.error("Google Imagine MCP server running on stdio (DEBUG mode)");
    } else {
      console.error("Google Imagine MCP server running on stdio");
    }
  }
}

const server = new GoogleImagineMCPServer();
server.run().catch(console.error);