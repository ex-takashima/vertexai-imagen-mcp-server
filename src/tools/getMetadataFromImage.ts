import fs from 'fs/promises';
import sharp from 'sharp';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { resolveInputPath } from '../utils/path.js';
import { extractMetadataFromImage } from '../utils/metadata.js';
import type { GetMetadataFromImageArgs } from '../types/history.js';
import type { ImageMetadata } from '../types/history.js';
import type { ToolContext } from './types.js';

/**
 * 画像ファイルからメタデータを読み取る
 * PNG: tEXtチャンク、JPEG/WebP: EXIFからメタデータを解析
 */
export async function getMetadataFromImage(
  context: ToolContext,
  args: GetMetadataFromImageArgs,
) {
  const { image_path } = args;
  const { historyDb } = context;

  if (!image_path || typeof image_path !== 'string') {
    throw new McpError(
      ErrorCode.InvalidParams,
      'image_path is required and must be a string',
    );
  }

  try {
    // ファイルパスの解決
    const resolvedPath = resolveInputPath(image_path);

    // ファイルの存在確認
    await fs.access(resolvedPath);

    // 中央化されたユーティリティを使用してメタデータを抽出
    const parsedMetadata = await extractMetadataFromImage(resolvedPath);

    if (!parsedMetadata) {
      return {
        content: [
          {
            type: 'text',
            text: `No Vertex AI Imagen metadata found in image: ${image_path}\n\n` +
                  'This image does not contain embedded Vertex AI Imagen metadata. ' +
                  'Metadata embedding may have been disabled when the image was generated, ' +
                  'or this image was not created by this MCP server.',
          },
        ],
      };
    }

    // Sharpで画像の基本情報を取得
    const image = sharp(resolvedPath);
    const metadata = await image.metadata();

    // 基本メタデータの表示
    let resultText = `📷 Image Metadata\n\n`;
    resultText += `File: ${image_path}\n`;
    resultText += `Format: ${metadata.format || 'unknown'}\n`;
    resultText += `Size: ${metadata.width}×${metadata.height}\n`;
    resultText += `File size: ${((await fs.stat(resolvedPath)).size / 1024).toFixed(1)} KB\n\n`;

    resultText += `🔖 Embedded Metadata\n\n`;
    resultText += `UUID: ${parsedMetadata.vertexai_imagen_uuid}\n`;
    resultText += `Parameters Hash: ${parsedMetadata.params_hash}\n`;

    if (parsedMetadata.tool_name) {
      resultText += `Tool: ${parsedMetadata.tool_name}\n`;
    }
    if (parsedMetadata.model) {
      resultText += `Model: ${parsedMetadata.model}\n`;
    }
    if (parsedMetadata.created_at) {
      resultText += `Created: ${parsedMetadata.created_at}\n`;
    }
    if (parsedMetadata.aspect_ratio) {
      resultText += `Aspect Ratio: ${parsedMetadata.aspect_ratio}\n`;
    }
    if (parsedMetadata.sample_image_size) {
      resultText += `Resolution: ${parsedMetadata.sample_image_size}\n`;
    }
    if (parsedMetadata.prompt) {
      resultText += `\nPrompt: ${parsedMetadata.prompt}\n`;
    }
    if (parsedMetadata.parameters) {
      resultText += `\nParameters:\n${JSON.stringify(parsedMetadata.parameters, null, 2)}\n`;
    }

    // データベースから詳細情報を取得（オプション）
    const uuid = parsedMetadata.vertexai_imagen_uuid;
    const dbRecord = historyDb.getImageHistory(uuid);

    if (dbRecord) {
      resultText += `\n📊 Database Record Found\n\n`;
      resultText += `Status: ${dbRecord.success ? '✓ Success' : '✗ Failed'}\n`;

      if (dbRecord.prompt && !parsedMetadata.prompt) {
        resultText += `Prompt: ${dbRecord.prompt}\n`;
      }

      if (dbRecord.model && !parsedMetadata.model) {
        resultText += `Model: ${dbRecord.model}\n`;
      }

      if (dbRecord.aspectRatio) {
        resultText += `Aspect Ratio: ${dbRecord.aspectRatio}\n`;
      }

      if (dbRecord.sampleCount) {
        resultText += `Sample Count: ${dbRecord.sampleCount}\n`;
      }

      if (dbRecord.safetyLevel) {
        resultText += `Safety Level: ${dbRecord.safetyLevel}\n`;
      }

      if (dbRecord.personGeneration) {
        resultText += `Person Generation: ${dbRecord.personGeneration}\n`;
      }

      if (dbRecord.language) {
        resultText += `Language: ${dbRecord.language}\n`;
      }

      // パラメータ整合性チェック
      const paramsMatch = dbRecord.paramsHash === parsedMetadata.params_hash;
      resultText += `\n🔐 Integrity Check: ${paramsMatch ? '✓ Valid' : '✗ Hash mismatch'}\n`;

      if (!paramsMatch) {
        resultText += `\n⚠️  Warning: The parameters hash in the image does not match the database record.\n`;
        resultText += `This may indicate that the image or database has been modified.\n`;
      }

      // 完全なパラメータ（fullレベルでない場合はDBから取得）
      if (!parsedMetadata.parameters && dbRecord.parameters) {
        try {
          const fullParams = JSON.parse(dbRecord.parameters);
          resultText += `\nFull Parameters (from database):\n${JSON.stringify(fullParams, null, 2)}\n`;
        } catch (error) {
          if (process.env.DEBUG) {
            console.error('[DEBUG] Failed to parse DB parameters:', error);
          }
        }
      }
    } else {
      resultText += `\n📊 Database Record: Not found\n\n`;
      resultText += `The image has embedded metadata but no corresponding database record was found.\n`;
      resultText += `This may occur if:\n`;
      resultText += `- The database was deleted or reset\n`;
      resultText += `- The image was generated on a different system\n`;
      resultText += `- Database recording was disabled during generation\n`;
    }

    return {
      content: [
        {
          type: 'text',
          text: resultText,
        },
      ],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Image file not found: ${image_path}`,
      );
    }

    if (error instanceof McpError) {
      throw error;
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to read image metadata: ${errorMsg}`,
    );
  }
}
