import axios from 'axios';
import fs from 'fs/promises';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import {
  normalizeAndValidatePath,
  getDisplayPath,
  generateMultipleFilePaths,
} from '../utils/path.js';
import { getProjectId, getImagenApiUrl } from '../utils/auth.js';
import {
  createImageResponse,
  createUriImageResponse,
  createMultiUriImageResponse,
} from '../utils/image.js';
import type { GoogleImagenRequest, GoogleImagenResponse } from '../types/api.js';
import type { GenerateImageArgs } from '../types/tools.js';
import type { ToolContext } from './types.js';

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

  const { auth, resourceManager } = context;

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

  try {
    const authClient = await auth.getClient();
    const accessToken = await authClient.getAccessToken();

    if (!accessToken.token) {
      throw new Error('Failed to obtain access token');
    }

    const projectId = await getProjectId(auth);
    const apiUrl = getImagenApiUrl(projectId, model, region);

    const response = await axios.post<GoogleImagenResponse>(apiUrl, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken.token}`,
      },
      timeout: 30000,
    });

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
      const imageBuffer = Buffer.from(prediction.bytesBase64Encoded, 'base64');
      const absoluteFilePath = filePaths[i];

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
