/**
 * Generate Image Tool Implementation
 *
 * Example of a complete tool implementation with history tracking
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import sharp from 'sharp';
import type { GenerateImageArgs, ToolContext, MCPToolResponse } from '../types/index.js';
import { embedMetadata } from '../utils/metadata.js';

export async function generateImage(
  context: ToolContext,
  args: GenerateImageArgs
): Promise<MCPToolResponse> {
  try {
    console.log(`[generateImage] Starting generation with prompt: "${args.prompt}"`);

    // 1. Generate image(s) using provider
    const buffers = await context.provider.generateImage(args);

    // 2. Determine output path
    const outputDir = process.env.IMAGE_OUTPUT_DIR || join(process.env.HOME || '', 'Downloads', 'ai-images');
    await mkdir(outputDir, { recursive: true });

    const timestamp = Date.now();
    const outputPaths: string[] = [];
    const fileSizes: number[] = [];

    // 3. Save images
    for (let i = 0; i < buffers.length; i++) {
      const buffer = buffers[i];
      const filename = args.output_path || `generated_${timestamp}_${i + 1}.png`;
      const outputPath = join(outputDir, filename);

      // Ensure parent directory exists
      await mkdir(dirname(outputPath), { recursive: true });

      // Write file
      await writeFile(outputPath, buffer);

      outputPaths.push(outputPath);
      fileSizes.push(buffer.length);

      console.log(`[generateImage] Saved image ${i + 1}/${buffers.length} to ${outputPath}`);
    }

    // 4. Record in history
    const uuid = context.historyManager.createRecord({
      tool_name: 'generate_image',
      model: args.model || context.provider.getModelVersion?.() || 'default',
      provider: context.provider.name,
      prompt: args.prompt,
      negative_prompt: args.negative_prompt,
      parameters: args,
      output_paths: outputPaths,
      file_sizes: fileSizes.reduce((a, b) => a + b, 0),
      mime_types: 'image/png',
      aspect_ratio: args.aspect_ratio,
      sample_count: args.sample_count || 1,
      sample_image_size: args.sample_image_size
    });

    console.log(`[generateImage] Created history record with UUID: ${uuid}`);

    // 5. Embed metadata (if enabled)
    if (shouldEmbedMetadata()) {
      for (const outputPath of outputPaths) {
        await embedMetadata(
          outputPath,
          {
            uuid,
            params_hash: context.historyManager.calculateHash?.(args) || '',
            tool_name: 'generate_image',
            model: args.model || 'default',
            provider: context.provider.name,
            created_at: new Date().toISOString(),
            aspect_ratio: args.aspect_ratio,
            sample_image_size: args.sample_image_size
          },
          getMetadataLevel()
        );
      }
    }

    // 6. Generate thumbnails (if requested)
    const thumbnails: Buffer[] = [];
    if (args.include_thumbnail || shouldIncludeThumbnail()) {
      for (const buffer of buffers) {
        const thumbnail = await generateThumbnail(buffer);
        thumbnails.push(thumbnail);
      }
    }

    // 7. Build MCP response
    return buildMCPResponse({
      uuid,
      outputPaths,
      fileSizes,
      buffers: thumbnails,
      prompt: args.prompt,
      model: args.model,
      provider: context.provider.name
    });

  } catch (error) {
    console.error('[generateImage] Error:', error);

    return {
      content: [
        {
          type: "text",
          text: `Error generating image: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
      isError: true
    };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function shouldEmbedMetadata(): boolean {
  const env = process.env.EMBED_METADATA?.toLowerCase();
  return env !== 'false' && env !== '0' && env !== 'no';
}

function getMetadataLevel(): 'minimal' | 'standard' | 'full' {
  const level = process.env.METADATA_LEVEL?.toLowerCase();
  if (level === 'minimal' || level === 'full') return level;
  return 'standard';
}

function shouldIncludeThumbnail(): boolean {
  const env = process.env.THUMBNAIL_ENABLED?.toLowerCase();
  return env === 'true' || env === '1' || env === 'yes';
}

async function generateThumbnail(imageBuffer: Buffer): Promise<Buffer> {
  const size = parseInt(process.env.THUMBNAIL_SIZE || '128');
  const quality = parseInt(process.env.THUMBNAIL_QUALITY || '60');

  return await sharp(imageBuffer)
    .resize(size, size, { fit: 'inside' })
    .jpeg({ quality })
    .toBuffer();
}

function buildMCPResponse(data: {
  uuid: string;
  outputPaths: string[];
  fileSizes: number[];
  buffers: Buffer[];
  prompt: string;
  model?: string;
  provider: string;
}): MCPToolResponse {
  const content: any[] = [];

  // Text content
  let text = `✅ Image generation successful\n\n`;
  text += `UUID: ${data.uuid}\n`;
  text += `Prompt: "${data.prompt}"\n`;
  text += `Model: ${data.model || 'default'}\n`;
  text += `Provider: ${data.provider}\n\n`;

  for (let i = 0; i < data.outputPaths.length; i++) {
    const path = data.outputPaths[i];
    const size = data.fileSizes[i];
    text += `📁 Image ${i + 1}:\n`;
    text += `   Path: ${path}\n`;
    text += `   Size: ${formatBytes(size)}\n`;
    text += `   URI: file://${path}\n\n`;
  }

  content.push({
    type: "text",
    text
  });

  // Add thumbnails
  for (const buffer of data.buffers) {
    content.push({
      type: "image",
      data: buffer.toString('base64'),  // Pure base64
      mimeType: "image/jpeg",
      annotations: {
        audience: ["user", "assistant"],
        priority: 0.8
      }
    });
  }

  return { content };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}
