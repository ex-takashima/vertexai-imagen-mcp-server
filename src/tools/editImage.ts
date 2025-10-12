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
  resolveImageSource,
  createImageResponse,
  createUriImageResponse,
  createMultiUriImageResponse,
} from '../utils/image.js';
import { GOOGLE_IMAGEN_EDIT_MODEL } from '../config/constants.js';
import type {
  GoogleImagenEditRequest,
  GoogleImagenResponse,
  ReferenceImage,
} from '../types/api.js';
import type { EditImageArgs } from '../types/tools.js';
import type { ToolContext } from './types.js';

export async function editImage(
  context: ToolContext,
  args: EditImageArgs,
) {
  const {
    prompt,
    reference_image_base64,
    reference_image_path,
    mask_image_base64,
    mask_image_path,
    mask_mode,
    mask_classes,
    mask_dilation = 0.01,
    edit_mode = 'inpaint_insertion',
    base_steps,
    output_path = 'edited_image.png',
    return_base64 = false,
    include_thumbnail,
    guidance_scale,
    sample_count = 1,
    negative_prompt,
    model = GOOGLE_IMAGEN_EDIT_MODEL,
    region,
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
    throw new McpError(
      ErrorCode.InvalidParams,
      '2K resolution is only supported by imagen-4.0-generate-001 and imagen-4.0-ultra-generate-001. ' +
        'The edit_image tool uses Imagen-3 capability models which do not support 2K. Please use "1K" or omit sample_image_size.',
    );
  }

  const normalizedPath = return_base64 ? undefined : await normalizeAndValidatePath(output_path);

  if (mask_mode === 'semantic' && (!mask_classes || mask_classes.length === 0)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "mask_classes array is required and must not be empty when mask_mode is 'semantic'",
    );
  }

  if (mask_mode === 'user_provided' && !mask_image_base64 && !mask_image_path) {
    if (process.env.DEBUG) {
      console.error(
        `[DEBUG] mask_mode is 'user_provided' but no mask image provided - proceeding without mask`,
      );
    }
  }

  if ((mask_image_base64 || mask_image_path) && mask_mode !== 'user_provided' && mask_mode !== undefined) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "mask_image_base64/mask_image_path can only be used when mask_mode is 'user_provided'",
    );
  }

  if (mask_mode && mask_mode !== 'mask_free' && (mask_dilation < 0 || mask_dilation > 1)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'mask_dilation must be between 0 and 1',
    );
  }

  const baseImage = await resolveImageSource({
    base64Value: reference_image_base64,
    pathValue: reference_image_path,
    label: 'Reference image',
    required: true,
  });

  if (!baseImage) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'Reference image could not be resolved',
    );
  }

  const referenceImages: ReferenceImage[] = [
    {
      referenceType: 'REFERENCE_TYPE_RAW',
      referenceId: 0,
      referenceImage: {
        bytesBase64Encoded: baseImage.base64,
        ...(baseImage.mimeType ? { mimeType: baseImage.mimeType } : {}),
      },
    },
  ];

  if (mask_mode === 'user_provided') {
    const maskImage = await resolveImageSource({
      base64Value: mask_image_base64,
      pathValue: mask_image_path,
      label: 'Mask image',
    });

    if (maskImage) {
      referenceImages.push({
        referenceType: 'REFERENCE_TYPE_MASK',
        referenceId: 1,
        referenceImage: {
          bytesBase64Encoded: maskImage.base64,
          ...(maskImage.mimeType ? { mimeType: maskImage.mimeType } : {}),
        },
        maskImageConfig: {
          maskMode: 'MASK_MODE_USER_PROVIDED',
          dilation: mask_dilation,
        },
      });
    }
  } else if (mask_mode && ['background', 'foreground', 'semantic'].includes(mask_mode)) {
    const maskModeMap = {
      background: 'MASK_MODE_BACKGROUND',
      foreground: 'MASK_MODE_FOREGROUND',
      semantic: 'MASK_MODE_SEMANTIC',
    } as const;

    const maskConfig: ReferenceImage = {
      referenceType: 'REFERENCE_TYPE_MASK',
      referenceId: 1,
      maskImageConfig: {
        maskMode: maskModeMap[mask_mode as keyof typeof maskModeMap],
        dilation: mask_dilation,
      },
    };

    if (mask_mode === 'semantic' && mask_classes) {
      maskConfig.maskImageConfig!.maskClasses = mask_classes;
    } else if (mask_mode === 'semantic' && !mask_classes) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "mask_classes is required when mask_mode is 'semantic'",
      );
    }

    referenceImages.push(maskConfig);
  } else if (!mask_mode || mask_mode === 'mask_free') {
    if (process.env.DEBUG) {
      console.error('[DEBUG] Mask-free editing mode - no mask will be applied');
    }
  }

  const editModeMap = {
    inpaint_removal: 'EDIT_MODE_INPAINT_REMOVAL',
    inpaint_insertion: 'EDIT_MODE_INPAINT_INSERTION',
    bgswap: 'EDIT_MODE_BGSWAP',
    outpainting: 'EDIT_MODE_OUTPAINT',
    mask_free: 'EDIT_MODE_DEFAULT',
  } as const;

  let apiEditMode:
    | 'EDIT_MODE_INPAINT_REMOVAL'
    | 'EDIT_MODE_INPAINT_INSERTION'
    | 'EDIT_MODE_BGSWAP'
    | 'EDIT_MODE_OUTPAINT'
    | 'EDIT_MODE_DEFAULT'
    | 'edit';

  if (!mask_mode || mask_mode === 'mask_free') {
    apiEditMode = 'EDIT_MODE_DEFAULT';
  } else {
    apiEditMode = editModeMap[edit_mode as keyof typeof editModeMap] || 'EDIT_MODE_DEFAULT';
  }

  const requestBody: GoogleImagenEditRequest = {
    instances: [
      {
        prompt,
        referenceImages,
      },
    ],
    parameters: {
      editMode: apiEditMode,
    },
  };

  if (base_steps !== undefined) {
    if (typeof base_steps !== 'number' || Number.isNaN(base_steps) || base_steps < 1) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'base_steps must be a positive number',
      );
    }
    requestBody.parameters.editConfig = {
      baseSteps: base_steps,
    };
  }

  if (guidance_scale !== undefined) {
    if (typeof guidance_scale !== 'number' || Number.isNaN(guidance_scale)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'guidance_scale must be a number',
      );
    }
    requestBody.parameters.guidanceScale = guidance_scale;
  }

  if (negative_prompt) {
    if (typeof negative_prompt !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'negative_prompt must be a string',
      );
    }
    requestBody.parameters.negativePrompt = negative_prompt;
  }

  if (sample_count) {
    requestBody.parameters.sampleCount = sample_count;
  }

  if (sample_image_size) {
    requestBody.parameters.sampleImageSize = sample_image_size;
  }

  if (process.env.DEBUG) {
    console.error(
      `[DEBUG] edit_image: model=${model}, edit=${edit_mode}, mask=${mask_mode}, refs=${referenceImages.length}`,
    );
  }

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
      timeout: 45000,
    });

    if (!response.data.predictions || response.data.predictions.length === 0) {
      throw new Error('Editing failed - no output received');
    }

    const predictions = response.data.predictions;
    const maskApplied = referenceImages.length > 1 ? 'yes' : 'no';
    const baseInfoText = `Image edited successfully!\n\nPrompt: ${prompt}\nModel: ${model}\nEdit mode: ${edit_mode}\nMask mode: ${mask_mode}\nMask applied: ${maskApplied}`;

    if (return_base64) {
      console.error(
        '[WARNING] return_base64=true is deprecated and consumes ~1,500 tokens. Use file save mode (default) instead.',
      );

      if (predictions.length > 1) {
        console.error(
          `[WARNING] return_base64 mode only returns the first image. ${predictions.length - 1} additional images were discarded.`,
        );
      }

      const editedImage = predictions[0];
      const imageBuffer = Buffer.from(editedImage.bytesBase64Encoded, 'base64');

      return createImageResponse(
        imageBuffer,
        editedImage.mimeType,
        undefined,
        baseInfoText,
      );
    }

    if (!normalizedPath) {
      throw new Error('Normalized path is required for file save mode');
    }

    const filePaths = await generateMultipleFilePaths(normalizedPath, sample_count);

    if (process.env.DEBUG) {
      console.error(`[DEBUG] Saving ${predictions.length} edited image(s)`);
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
