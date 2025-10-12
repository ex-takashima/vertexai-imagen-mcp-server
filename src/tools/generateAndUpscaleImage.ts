import fs from 'fs/promises';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import {
  normalizeAndValidatePath,
  getDisplayPath,
} from '../utils/path.js';
import { createUriImageResponse } from '../utils/image.js';
import {
  generateImageUUID,
  calculateParamsHash,
  embedMetadata,
  isMetadataEmbeddingEnabled,
} from '../utils/metadata.js';
import { generateImage } from './generateImage.js';
import { upscaleImage } from './upscaleImage.js';
import type {
  GenerateAndUpscaleImageArgs,
  GenerateImageArgs,
  UpscaleImageArgs,
} from '../types/tools.js';
import type { ToolContext } from './types.js';
import type { ImageMetadata } from '../types/history.js';

export async function generateAndUpscaleImage(
  context: ToolContext,
  args: GenerateAndUpscaleImageArgs,
) {
  const {
    prompt,
    output_path = 'generated_upscaled_image.png',
    aspect_ratio = '1:1',
    scale_factor = '2',
    return_base64 = false,
    include_thumbnail,
    safety_level = 'BLOCK_MEDIUM_AND_ABOVE',
    person_generation = 'DONT_ALLOW',
    language = 'auto',
    model = 'imagen-3.0-generate-002',
    region,
    sample_image_size,
  } = args;

  if (!prompt || typeof prompt !== 'string') {
    throw new McpError(
      ErrorCode.InvalidParams,
      'prompt is required and must be a string',
    );
  }

  if (sample_image_size === '2K') {
    const supports2K =
      model === 'imagen-4.0-generate-001' || model === 'imagen-4.0-ultra-generate-001';
    if (!supports2K) {
      throw new McpError(
        ErrorCode.InvalidParams,
        '2K resolution is only supported by imagen-4.0-generate-001 and imagen-4.0-ultra-generate-001. ' +
          `Current model "${model}" does not support 2K. Please use "1K" or switch to a 2K-compatible model.`,
      );
    }
  }

  if (process.env.DEBUG) {
    console.error(
      `[DEBUG] generate_and_upscale: model=${model}, aspect=${aspect_ratio}, scale=${scale_factor}`,
    );
  }

  const { historyDb } = context;

  // パラメータハッシュの計算（履歴管理用）
  const params = {
    prompt,
    model,
    aspect_ratio,
    safety_level,
    person_generation,
    language,
    scale_factor,
    sample_image_size: sample_image_size || undefined,
  };
  const paramsHash = calculateParamsHash(params);

  // UUID発行
  const uuid = generateImageUUID();

  const metadataEmbeddingEnabled = isMetadataEmbeddingEnabled();

  if (process.env.DEBUG && metadataEmbeddingEnabled) {
    console.error(`[DEBUG] Metadata embedding enabled. UUID: ${uuid}`);
  }

  const tempImageTimestamp = Date.now();
  const tempImagePath = `temp_generated_${tempImageTimestamp}.png`;
  const tempImageAbsPath = await normalizeAndValidatePath(tempImagePath);

  try {
    const generateArgs: GenerateImageArgs = {
      prompt,
      output_path: tempImageAbsPath,
      aspect_ratio,
      safety_level,
      person_generation,
      language,
      model,
      region,
      ...(sample_image_size ? { sample_image_size } : {}),
    };

    await generateImage(context, generateArgs);

    const upscaleArgs: UpscaleImageArgs = {
      input_path: tempImageAbsPath,
      output_path: return_base64 ? undefined : output_path,
      scale_factor,
      return_base64,
      region,
    };

    const upscaleResult = await upscaleImage(context, upscaleArgs);

    try {
      await fs.unlink(tempImageAbsPath);
    } catch {
      // ignore cleanup errors
    }

    if (return_base64) {
      const originalContent = upscaleResult.content[0];
      const imageContent = upscaleResult.content[1];

      return {
        content: [
          {
            type: 'text',
            text: `Image generated and upscaled successfully!\n\nPrompt: ${prompt}\nAspect ratio: ${aspect_ratio}\nModel: ${model}\nScale factor: ${scale_factor}\n\nProcess completed in 2 steps:\n1. Generated original image\n2. Upscaled to ${scale_factor}x resolution\n\nFile size: ${originalContent.text?.match(/File size: (\\d+) bytes/)?.[1] || 'unknown'} bytes`,
          },
          imageContent,
        ],
      };
    }

    const resourceContent = upscaleResult.content.find(
      (
        c,
      ): c is {
        type: 'resource';
        resource: { uri: string; mimeType: string; text: string };
      } => c.type === 'resource',
    );

    if (!resourceContent) {
      throw new Error('Failed to get resource from upscale result');
    }

    const actualFileUri = resourceContent.resource.uri;

    let normalizedPath: string;
    try {
      const resolvedPath = context.resourceManager.resolveUri(actualFileUri);
      if (!resolvedPath) {
        throw new Error(`Invalid file URI: ${actualFileUri}`);
      }
      normalizedPath = resolvedPath;
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to resolve upscaled image path: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const displayPath = getDisplayPath(normalizedPath);
    const fileUri = actualFileUri;

    const mimeType =
      upscaleResult.content[0]?.text?.match(/MIME type: ([\\w/]+)/)?.[1] || 'image/png';
    const fileSize = upscaleResult.content[0]?.text?.match(/File size: (\\d+) bytes/)?.[1];
    const size = fileSize ? parseInt(fileSize, 10) : 0;

    const shouldIncludeThumbnail =
      include_thumbnail !== undefined
        ? include_thumbnail
        : process.env.VERTEXAI_IMAGEN_THUMBNAIL === 'true';

    // Re-embed metadata for the composite operation
    if (metadataEmbeddingEnabled) {
      try {
        let imageBuffer = await fs.readFile(normalizedPath);
        const metadata: ImageMetadata = {
          vertexai_imagen_uuid: uuid,
          params_hash: paramsHash,
          tool_name: 'generate_and_upscale_image',
          model,
          created_at: new Date().toISOString(),
          aspect_ratio,
          sample_image_size: sample_image_size || undefined,
        };

        imageBuffer = (await embedMetadata(imageBuffer, metadata)) as Buffer;
        await fs.writeFile(normalizedPath, imageBuffer);

        if (process.env.DEBUG) {
          console.error(`[DEBUG] Re-embedded metadata for generate_and_upscale: ${uuid}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[WARNING] Failed to re-embed metadata for ${uuid}: ${errorMsg}`);
      }
    }

    // データベースに履歴記録
    try {
      historyDb.createImageHistory({
        uuid,
        filePath: normalizedPath,
        toolName: 'generate_and_upscale_image',
        prompt,
        model,
        aspectRatio: aspect_ratio,
        sampleCount: 1,
        sampleImageSize: sample_image_size || undefined,
        safetyLevel: safety_level,
        personGeneration: person_generation,
        language,
        parameters: JSON.stringify(params),
        paramsHash,
        success: true,
        fileSize: size,
        mimeType,
      });

      if (process.env.DEBUG) {
        console.error(`[DEBUG] Image history recorded: ${uuid}`);
      }
    } catch (dbError) {
      const errorMsg = dbError instanceof Error ? dbError.message : String(dbError);
      console.error(`[WARNING] Failed to record image history for ${uuid}: ${errorMsg}`);
    }

    return await createUriImageResponse(
      fileUri,
      mimeType,
      size,
      displayPath,
      normalizedPath,
      `Image generated and upscaled successfully!\n\nPrompt: ${prompt}\nAspect ratio: ${aspect_ratio}\nModel: ${model}\nScale factor: ${scale_factor}\n\nProcess completed in 2 steps:\n1. Generated original image\n2. Upscaled to ${scale_factor}x resolution`,
      shouldIncludeThumbnail,
    );
  } catch (error) {
    try {
      await fs.unlink(tempImageAbsPath);
    } catch {
      // ignore cleanup errors
    }
    throw error;
  }
}
