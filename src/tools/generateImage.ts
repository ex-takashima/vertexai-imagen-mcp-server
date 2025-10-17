import axios from 'axios';
import fs from 'fs/promises';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import {
  normalizeAndValidatePath,
  getDisplayPath,
  generateMultipleFilePaths,
} from '../utils/path.js';
import { getProjectId, getImagenApiUrl, getAuthHeaders } from '../utils/auth.js';
import {
  createImageResponse,
  createUriImageResponse,
  createMultiUriImageResponse,
} from '../utils/image.js';
import {
  generateImageUUID,
  calculateParamsHash,
  embedMetadata,
  isMetadataEmbeddingEnabled,
} from '../utils/metadata.js';
import { vertexAIRateLimiter } from '../utils/rateLimiter.js';
import type { GoogleImagenRequest, GoogleImagenResponse } from '../types/api.js';
import type { GenerateImageArgs } from '../types/tools.js';
import type { ToolContext } from './types.js';
import type { ImageMetadata } from '../types/history.js';

export async function generateImage(
  context: ToolContext,
  args: GenerateImageArgs,
) {
  const {
    prompt,
    output_path = 'generated_image.png',
    aspect_ratio = '1:1',
    return_base64 = false,
    include_thumbnail,
    safety_level = 'BLOCK_MEDIUM_AND_ABOVE',
    person_generation = 'DONT_ALLOW',
    language = 'auto',
    model = 'imagen-3.0-generate-002',
    region,
    sample_count = 1,
    sample_image_size,
  } = args;

  const { auth, resourceManager, historyDb } = context;

  if (!prompt || typeof prompt !== 'string') {
    throw new McpError(
      ErrorCode.InvalidParams,
      'prompt is required and must be a string',
    );
  }

  if (sample_count < 1 || sample_count > 4) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'sample_count must be between 1 and 4',
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

  const normalizedPath = return_base64 ? undefined : await normalizeAndValidatePath(output_path);

  if (process.env.DEBUG) {
    console.error(
      `[DEBUG] generate_image: model=${model}, aspect=${aspect_ratio}, safety=${safety_level}`,
    );
  }

  const requestBody: GoogleImagenRequest = {
    instances: [
      {
        prompt,
      },
    ],
    parameters: {
      sampleCount: sample_count,
      aspectRatio: aspect_ratio,
      safetySettings: [
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: safety_level,
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: safety_level,
        },
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: safety_level,
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: safety_level,
        },
      ],
      personGeneration: person_generation,
      language,
      ...(sample_image_size ? { sampleImageSize: sample_image_size } : {}),
    },
  };

  // パラメータハッシュの計算（履歴管理用）
  const params = {
    prompt,
    model,
    aspect_ratio,
    safety_level,
    person_generation,
    language,
    sample_count,
    sample_image_size: sample_image_size || undefined,
  };
  const paramsHash = calculateParamsHash(params);

  // UUID発行（各画像ごと）
  const imageUUIDs: string[] = [];
  for (let i = 0; i < sample_count; i++) {
    imageUUIDs.push(generateImageUUID());
  }

  const metadataEmbeddingEnabled = isMetadataEmbeddingEnabled();

  if (process.env.DEBUG && metadataEmbeddingEnabled) {
    console.error(`[DEBUG] Metadata embedding enabled. UUIDs generated: ${imageUUIDs.length}`);
  }

  try {
    const projectId = await getProjectId(auth);
    const apiUrl = getImagenApiUrl(projectId, model, region);
    const authHeaders = await getAuthHeaders(auth);

    const response = await vertexAIRateLimiter.execute(() =>
      axios.post<GoogleImagenResponse>(apiUrl, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        timeout: 30000,
      })
    );

    if (!response.data.predictions || response.data.predictions.length === 0) {
      throw new Error('No images were generated');
    }

    const predictions = response.data.predictions;
    const baseInfoText = `Image generated successfully!\n\nPrompt: ${prompt}\nAspect ratio: ${aspect_ratio}\nModel: ${model}`;

    if (return_base64) {
      console.error(
        '[WARNING] return_base64=true is deprecated and consumes ~1,500 tokens. Use file save mode (default) instead.',
      );

      if (predictions.length > 1) {
        console.error(
          `[WARNING] return_base64 mode only returns the first image. ${predictions.length - 1} additional images were discarded.`,
        );
      }

      const generatedImage = predictions[0];
      const imageBuffer = Buffer.from(generatedImage.bytesBase64Encoded, 'base64');

      return createImageResponse(
        imageBuffer,
        generatedImage.mimeType,
        undefined,
        baseInfoText,
      );
    }

    if (!normalizedPath) {
      throw new Error('Normalized path is required for file save mode');
    }

    const filePaths = await generateMultipleFilePaths(normalizedPath, sample_count);

    if (process.env.DEBUG) {
      console.error(`[DEBUG] Saving ${predictions.length} generated image(s)`);
    }

    const imageInfos: Array<{
      uri: string;
      mimeType: string;
      fileSize: number;
      filePath: string;
      absoluteFilePath: string;
    }> = [];

    for (let i = 0; i < predictions.length; i++) {
      const prediction = predictions[i];
      let imageBuffer: Buffer = Buffer.from(prediction.bytesBase64Encoded, 'base64');
      const absoluteFilePath = filePaths[i];
      const uuid = imageUUIDs[i];

      // メタデータ埋め込み
      if (metadataEmbeddingEnabled) {
        const metadata: ImageMetadata = {
          vertexai_imagen_uuid: uuid,
          params_hash: paramsHash,
          tool_name: 'generate_image',
          model,
          created_at: new Date().toISOString(),
          aspect_ratio,
          sample_image_size: sample_image_size || undefined,
        };

        try {
          imageBuffer = (await embedMetadata(imageBuffer, metadata)) as Buffer;
        } catch (error) {
          // メタデータ埋め込みに失敗してもエラーとしない（警告のみ）
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`[WARNING] Failed to embed metadata for ${uuid}: ${errorMsg}`);
        }
      }

      await fs.writeFile(absoluteFilePath, imageBuffer);

      const displayPath = getDisplayPath(absoluteFilePath);
      const fileUri = resourceManager.getFileUri(absoluteFilePath);

      imageInfos.push({
        uri: fileUri,
        mimeType: prediction.mimeType,
        fileSize: imageBuffer.length,
        filePath: displayPath,
        absoluteFilePath,
      });

      // データベースに履歴記録
      try {
        historyDb.createImageHistory({
          uuid,
          filePath: absoluteFilePath,
          toolName: 'generate_image',
          prompt,
          model,
          aspectRatio: aspect_ratio,
          sampleCount: sample_count,
          sampleImageSize: sample_image_size || undefined,
          safetyLevel: safety_level,
          personGeneration: person_generation,
          language,
          parameters: JSON.stringify(params),
          paramsHash,
          success: true,
          fileSize: imageBuffer.length,
          mimeType: prediction.mimeType,
        });

        if (process.env.DEBUG) {
          console.error(`[DEBUG] Image history recorded: ${uuid}`);
        }
      } catch (dbError) {
        // DB記録失敗はエラーとしない（警告のみ）
        const errorMsg = dbError instanceof Error ? dbError.message : String(dbError);
        console.error(`[WARNING] Failed to record image history for ${uuid}: ${errorMsg}`);
      }
    }

    const shouldIncludeThumbnail =
      include_thumbnail !== undefined
        ? include_thumbnail
        : process.env.VERTEXAI_IMAGEN_THUMBNAIL === 'true';

    if (sample_count === 1) {
      const info = imageInfos[0];
      return await createUriImageResponse(
        info.uri,
        info.mimeType,
        info.fileSize,
        info.filePath,
        info.absoluteFilePath,
        baseInfoText,
        shouldIncludeThumbnail,
      );
    }

    return await createMultiUriImageResponse(
      imageInfos,
      baseInfoText,
      shouldIncludeThumbnail,
    );
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      const errorCode = error.response?.status;

      if (process.env.DEBUG) {
        console.error(`[DEBUG] API Error ${errorCode}: ${errorMessage}`);
      }

      if (errorCode === 401 || errorCode === 403) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Google Imagen API authentication error: ${errorMessage}`,
        );
      }
      if (errorCode === 400) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Google Imagen API invalid parameter error: ${errorMessage}`,
        );
      }
      if (errorCode && errorCode >= 500) {
        throw new McpError(
          ErrorCode.InternalError,
          `Google Imagen API server error: ${errorMessage}`,
        );
      }

      throw new McpError(
        ErrorCode.InternalError,
        `Google Imagen API error: ${errorMessage}`,
      );
    }

    throw error;
  }
}
