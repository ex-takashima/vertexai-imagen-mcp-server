#!/usr/bin/env node

/**
 * Image Generation MCP Server
 *
 * Main entry point for the MCP server
 */

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
import { homedir } from 'os';
import { join } from 'path';
import { ProviderFactory, validateProviderConfig } from './providers/base.js';
import { HistoryDatabase } from './utils/database.js';
import { ResourceManager } from './utils/resources.js';
import { generateImage } from './tools/generateImage.js';
import type { ToolContext, GenerateImageArgs } from './types/index.js';

// Server version
const VERSION = process.env.SERVER_VERSION || '1.0.0';
const SERVER_NAME = process.env.SERVER_NAME || 'image-generation-server';

class ImageGenerationServer {
  private server: Server;
  private provider: any;
  private historyManager: HistoryDatabase;
  private resourceManager: ResourceManager;
  private context: ToolContext;

  constructor() {
    // Initialize MCP server
    this.server = new Server(
      {
        name: SERVER_NAME,
        version: VERSION,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    // Initialize provider
    const providerName = process.env.IMAGE_PROVIDER || 'example';
    const validation = validateProviderConfig(providerName);

    if (!validation.valid) {
      console.error('[Server] Provider configuration errors:');
      validation.errors.forEach(err => console.error(`  - ${err}`));
      process.exit(1);
    }

    this.provider = ProviderFactory.create(providerName);
    console.error(`[Server] Using provider: ${this.provider.name}`);

    // Initialize history database
    const outputDir = process.env.IMAGE_OUTPUT_DIR ||
      join(homedir(), 'Downloads', 'ai-images');
    const dbPath = process.env.HISTORY_DB_PATH ||
      join(outputDir, 'data', 'history.db');

    this.historyManager = new HistoryDatabase(dbPath);
    console.error(`[Server] History database: ${dbPath}`);

    // Initialize resource manager
    this.resourceManager = new ResourceManager(outputDir);
    console.error(`[Server] Output directory: ${outputDir}`);

    // Create tool context
    this.context = {
      provider: this.provider,
      historyManager: this.historyManager,
      resourceManager: this.resourceManager
    };

    // Setup handlers
    this.setupToolHandlers();
    this.setupResourceHandlers();
    this.handleProcessArguments();
  }

  private handleProcessArguments(): void {
    // --version flag
    if (process.argv.includes('--version') || process.argv.includes('-v')) {
      console.log(VERSION);
      process.exit(0);
    }

    // --help flag
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      console.log(`
${SERVER_NAME} v${VERSION}

Usage: ${SERVER_NAME} [options]

Options:
  -v, --version    Show version number
  -h, --help       Show help

Environment Variables:
  IMAGE_PROVIDER              Provider to use (example, openai, stable-diffusion)
  IMAGE_OUTPUT_DIR            Directory for generated images
  HISTORY_DB_PATH             Path to history database
  THUMBNAIL_ENABLED           Enable thumbnails (true/false)
  EMBED_METADATA              Embed metadata in images (true/false)
  METADATA_LEVEL              Metadata detail level (minimal/standard/full)
  DEBUG                       Enable debug logging

Provider-specific:
  OPENAI_API_KEY              OpenAI API key
  SD_API_URL                  Stable Diffusion API URL

This is an MCP server for AI image generation with history management.
It should be run by an MCP client like Claude Desktop.
      `);
      process.exit(0);
    }
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "generate_image",
            description: `Generate an image using ${this.provider.name}. Supports multiple aspect ratios and automatic history tracking.`,
            inputSchema: {
              type: "object",
              properties: {
                prompt: {
                  type: "string",
                  description: "Text description of the image to generate",
                },
                output_path: {
                  type: "string",
                  description: "Optional: Filename for the generated image (relative to IMAGE_OUTPUT_DIR)",
                },
                aspect_ratio: {
                  type: "string",
                  enum: this.provider.limits.supportedAspectRatios,
                  description: "Image aspect ratio",
                },
                sample_count: {
                  type: "integer",
                  minimum: 1,
                  maximum: this.provider.limits.maxSampleCount,
                  description: "Number of images to generate",
                },
                include_thumbnail: {
                  type: "boolean",
                  description: "Include thumbnail preview in response",
                },
                negative_prompt: {
                  type: "string",
                  description: "Elements to avoid in the image",
                },
              },
              required: ["prompt"],
            },
          },
          {
            name: "list_history",
            description: "List image generation history with filtering and sorting",
            inputSchema: {
              type: "object",
              properties: {
                limit: {
                  type: "integer",
                  description: "Maximum number of records to return",
                },
                filters: {
                  type: "object",
                  properties: {
                    provider: { type: "string" },
                    model: { type: "string" },
                    date_from: { type: "string" },
                    date_to: { type: "string" },
                  },
                },
              },
            },
          },
          {
            name: "get_history_by_uuid",
            description: "Get detailed information about a specific generation by UUID",
            inputSchema: {
              type: "object",
              properties: {
                uuid: {
                  type: "string",
                  description: "UUID of the generation to retrieve",
                },
              },
              required: ["uuid"],
            },
          },
          {
            name: "search_history",
            description: "Search history using full-text search on prompts",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query",
                },
                limit: {
                  type: "integer",
                  description: "Maximum results",
                },
              },
              required: ["query"],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "generate_image":
            return await generateImage(this.context, args as GenerateImageArgs);

          case "list_history":
            return this.listHistory(args);

          case "get_history_by_uuid":
            return this.getHistoryByUuid(args);

          case "search_history":
            return this.searchHistory(args);

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

  private setupResourceHandlers(): void {
    // List resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = await this.resourceManager.listResources();

      return {
        resources: resources.map(r => ({
          uri: r.uri,
          name: r.name,
          mimeType: r.mimeType,
          description: r.description,
        }))
      };
    });

    // Read resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      const buffer = await this.resourceManager.readResource(uri);
      const metadata = await this.resourceManager.getResourceMetadata(uri);

      if (!metadata) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Resource not found: ${uri}`
        );
      }

      return {
        contents: [
          {
            uri: uri,
            mimeType: metadata.mimeType,
            blob: buffer.toString('base64')
          }
        ]
      };
    });
  }

  // Tool implementations
  private listHistory(args: any) {
    const records = this.historyManager.list(args);

    let text = `📊 History (${records.length} records)\n\n`;
    records.forEach((record, i) => {
      text += `${i + 1}. ${record.prompt.substring(0, 50)}...\n`;
      text += `   UUID: ${record.uuid}\n`;
      text += `   Model: ${record.model}\n`;
      text += `   Created: ${record.created_at}\n\n`;
    });

    return {
      content: [{ type: "text", text }]
    };
  }

  private getHistoryByUuid(args: any) {
    const record = this.historyManager.getByUuid(args.uuid);

    if (!record) {
      return {
        content: [{ type: "text", text: `❌ No record found with UUID: ${args.uuid}` }],
        isError: true
      };
    }

    let text = `📄 History Record\n\n`;
    text += `UUID: ${record.uuid}\n`;
    text += `Prompt: ${record.prompt}\n`;
    text += `Model: ${record.model}\n`;
    text += `Provider: ${record.provider}\n`;
    text += `Created: ${record.created_at}\n`;
    text += `Files: ${record.output_paths.join(', ')}\n`;

    return {
      content: [{ type: "text", text }]
    };
  }

  private searchHistory(args: any) {
    const records = this.historyManager.search(args);

    let text = `🔍 Search Results (${records.length} matches)\n\n`;
    records.forEach((record, i) => {
      text += `${i + 1}. ${record.prompt}\n`;
      text += `   UUID: ${record.uuid}\n`;
      text += `   Created: ${record.created_at}\n\n`;
    });

    return {
      content: [{ type: "text", text }]
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    if (process.env.DEBUG) {
      console.error(`[Server] ${SERVER_NAME} v${VERSION} running in DEBUG mode`);
    } else {
      console.error(`[Server] ${SERVER_NAME} v${VERSION} running`);
    }
  }
}

// Start server
const server = new ImageGenerationServer();
server.run().catch(console.error);
