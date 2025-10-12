import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import {
  normalizeAndValidatePath,
  getDisplayPath,
  resolveInputPath,
} from '../utils/path.js';
import { getProjectId, getUpscaleApiUrl } from '../utils/auth.js';
import {
  createImageResponse,
  createUriImageResponse,
} from '../utils/image.js';
import {
  generateImageUUID,
  calculateParamsHash,
  embedMetadata,
  isMetadataEmbeddingEnabled,
} from '../utils/metadata.js';
import type { GoogleUpscaleRequest, GoogleImagenResponse } from '../types/api.js';
import type { UpscaleImageArgs } from '../types/tools.js';
import type { ToolContext } from './types.js';
import type { ImageMetadata } from '../types/history.js';

export async function upscaleImage(
  context: ToolContext,
  args: UpscaleImageArgs,
) {
  const {
    input_path,
    output_path,
    scale_factor = '2',
    return_base64 = false,
    include_thumbnail,
    region,
  } = args;

  const { auth, resourceManager, historyDb } = context;

  if (!input_path || typeof input_path !== 'string') {
    throw new McpError(
      ErrorCode.InvalidParams,
      'input_path is required and must be a string',
    );
  }

  if (process.env.DEBUG) {
    console.error(`[DEBUG] upscale_image: scale=${scale_factor}`);
  }

  // パラメータハッシュの計算（履歴管理用）
  const params = {
    input_path,
    scale_factor,
    tool: 'upscale_image',
  };
  const paramsHash = calculateParamsHash(params);

  // UUID発行
  const uuid = generateImageUUID();

  const metadataEmbeddingEnabled = isMetadataEmbeddingEnabled();

  if (process.env.DEBUG && metadataEmbeddingEnabled) {
    console.error(`[DEBUG] Metadata embedding enabled. UUID: ${uuid}`);
  }

  try {
    const resolvedInputPath = resolveInputPath(input_path);
    const inputImageBuffer = await fs.readFile(resolvedInputPath);
    const inputImageBase64 = inputImageBuffer.toString('base64');

    const parsedPath = path.parse(input_path);
    const defaultOutputPath = path.join(parsedPath.dir, `upscaled_${scale_factor}x_${parsedPath.base}`);
    const finalOutputPath = output_path || defaultOutputPath;

    const normalizedPath = return_base64 ? undefined : await normalizeAndValidatePath(finalOutputPath);

    const requestBody: GoogleUpscaleRequest = {
      instances: [
        {
          prompt: '',
          image: {
            bytesBase64Encoded: inputImageBase64,
          },
        },
      ],
      parameters: {
        mode: 'upscale',
        upscaleConfig: {
          upscaleFactor: `x${scale_factor}`,
        },
        sampleCount: 1,
      },
    };

    const authClient = await auth.getClient();
    const accessToken = await authClient.getAccessToken();

    if (!accessToken.token) {
      throw new Error('Failed to obtain access token');
    }

    const projectId = await getProjectId(auth);
    const apiUrl = getUpscaleApiUrl(projectId, region);

    const response = await axios.post<GoogleImagenResponse>(apiUrl, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken.token}`,
      },
      timeout: 60000,
    });

    if (!response.data.predictions || response.data.predictions.length === 0) {
      throw new Error('Upscaling failed - no output received');
    }

    const upscaledImage = response.data.predictions[0];
    let imageBuffer: Buffer = Buffer.from(upscaledImage.bytesBase64Encoded, 'base64');

    if (return_base64) {
      console.error(
        '[WARNING] return_base64=true is deprecated and consumes ~1,500 tokens. Use file save mode (default) instead.',
      );

      return createImageResponse(
        imageBuffer,
        upscaledImage.mimeType,
        undefined,
        `Image upscaled successfully!\n\nInput: ${input_path}\nScale factor: ${scale_factor}`,
      );
    }

    if (!normalizedPath) {
      throw new Error(
        'Normalized path is required for file save mode.\n' +
          'This is an internal error - please report this issue.',
      );
    }

    // メタデータ埋め込み
    if (metadataEmbeddingEnabled) {
      const metadata: ImageMetadata = {
        vertexai_imagen_uuid: uuid,
        params_hash: paramsHash,
        tool_name: 'upscale_image',
        model: 'imagen-upscale',
        created_at: new Date().toISOString(),
      };

      try {
        imageBuffer = (await embedMetadata(imageBuffer, metadata)) as Buffer;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[WARNING] Failed to embed metadata for ${uuid}: ${errorMsg}`);
      }
    }

    await fs.writeFile(normalizedPath, imageBuffer);
    const displayPath = getDisplayPath(normalizedPath);
    const fileUri = resourceManager.getFileUri(normalizedPath);

    const shouldIncludeThumbnail =
      include_thumbnail !== undefined
        ? include_thumbnail
        : process.env.VERTEXAI_IMAGEN_THUMBNAIL === 'true';

    // データベースに履歴記録
    try {
      historyDb.createImageHistory({
        uuid,
        filePath: normalizedPath,
        toolName: 'upscale_image',
        prompt: `Upscale ${scale_factor}x: ${input_path}`,
        model: 'imagen-upscale',
        sampleCount: 1,
        parameters: JSON.stringify(params),
        paramsHash,
        success: true,
        fileSize: imageBuffer.length,
        mimeType: upscaledImage.mimeType,
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
      upscaledImage.mimeType,
      imageBuffer.length,
      displayPath,
      normalizedPath,
      `Image upscaled successfully!\n\nInput: ${input_path}\nScale factor: ${scale_factor}`,
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
    if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'ENOENT') {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Input image file not found: ${input_path}`,
      );
    }
    throw error;
  }
}
