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
import {
  generateImageUUID,
  calculateParamsHash,
  embedMetadata,
  isMetadataEmbeddingEnabled,
} from '../utils/metadata.js';
import { GOOGLE_IMAGEN_EDIT_MODEL } from '../config/constants.js';
import type { GoogleImagenRequest, GoogleImagenResponse, ReferenceImage } from '../types/api.js';
import type { CustomizeImageArgs } from '../types/tools.js';
import type { ToolContext } from './types.js';
import type { ImageMetadata } from '../types/history.js';

export async function customizeImage(
  context: ToolContext,
  args: CustomizeImageArgs,
) {
  const {
    prompt,
    control_image_base64,
    control_image_path,
    control_type,
    enable_control_computation = true,
    subject_images,
    subject_description,
    subject_type,
    style_image_base64,
    style_image_path,
    style_description,
    output_path = 'customized_image.png',
    aspect_ratio = '1:1',
    return_base64 = false,
    include_thumbnail,
    safety_level = 'BLOCK_MEDIUM_AND_ABOVE',
    person_generation = 'DONT_ALLOW',
    language = 'auto',
    negative_prompt,
    sample_count = 1,
    model = GOOGLE_IMAGEN_EDIT_MODEL,
    region,
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
    throw new McpError(
      ErrorCode.InvalidParams,
      '2K resolution is only supported by imagen-4.0-generate-001 and imagen-4.0-ultra-generate-001. ' +
        'The customize_image tool uses Imagen-3 capability models which do not support 2K. Please use "1K" or omit sample_image_size.',
    );
  }

  const hasControl = control_image_base64 || control_image_path;
  const hasSubject = subject_images && subject_images.length > 0;
  const hasStyle = style_image_base64 || style_image_path;

  if (!hasControl && !hasSubject && !hasStyle) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'At least one reference image type must be provided (control, subject, or style)',
    );
  }

  if (hasControl && !control_type) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'control_type is required when control image is provided',
    );
  }

  if (hasSubject) {
    if (!subject_description) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'subject_description is required when subject_images is provided',
      );
    }
    if (!subject_type) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'subject_type is required when subject_images is provided',
      );
    }
  }

  const normalizedPath = return_base64 ? undefined : await normalizeAndValidatePath(output_path);

  const refTypeCount = (hasControl ? 1 : 0) + (hasSubject ? 1 : 0) + (hasStyle ? 1 : 0);

  if (refTypeCount > 2 && aspect_ratio !== '1:1') {
    throw new McpError(
      ErrorCode.InvalidParams,
      'API limitation: Cannot use more than 2 reference image types with non-square aspect ratio. ' +
        `You are using ${refTypeCount} types (${hasControl ? 'control ' : ''}${hasSubject ? 'subject ' : ''}${hasStyle ? 'style' : ''}) ` +
        `with aspect ratio ${aspect_ratio}. Please either: ` +
        '1) Use aspect_ratio="1:1" (square) to enable 3 reference types, or ' +
        '2) Reduce to 2 or fewer reference image types.',
    );
  }

  if (process.env.DEBUG) {
    console.error(
      `[DEBUG] customize_image: model=${model}, ctrl=${hasControl}, subj=${hasSubject}, style=${hasStyle}`,
    );
  }

  const referenceImages: ReferenceImage[] = [];
  let currentRefId = 1;

  if (hasControl) {
    const controlImage = await resolveImageSource({
      base64Value: control_image_base64,
      pathValue: control_image_path,
      label: 'Control image',
      required: true,
    });

    if (!controlImage) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Control image could not be resolved',
      );
    }

    const controlTypeMap = {
      face_mesh: 'CONTROL_TYPE_FACE_MESH',
      canny: 'CONTROL_TYPE_CANNY',
      scribble: 'CONTROL_TYPE_SCRIBBLE',
    } as const;

    const resolvedControlType =
      controlTypeMap[control_type as keyof typeof controlTypeMap] || control_type!;

    referenceImages.push({
      referenceType: 'REFERENCE_TYPE_CONTROL',
      referenceId: currentRefId++,
      referenceImage: {
        bytesBase64Encoded: controlImage.base64,
        ...(controlImage.mimeType ? { mimeType: controlImage.mimeType } : {}),
      },
      controlImageConfig: {
        controlType: resolvedControlType,
        enableControlImageComputation: enable_control_computation,
      },
    });
  }

  if (hasSubject && subject_images) {
    const subjectTypeMap = {
      person: 'SUBJECT_TYPE_PERSON',
      animal: 'SUBJECT_TYPE_ANIMAL',
      product: 'SUBJECT_TYPE_PRODUCT',
      default: 'SUBJECT_TYPE_DEFAULT',
    } as const;

    const resolvedSubjectType =
      subjectTypeMap[subject_type as keyof typeof subjectTypeMap] || 'SUBJECT_TYPE_DEFAULT';

    for (const subjectImage of subject_images) {
      const { image_base64, image_path } = subjectImage;
      const subjectSource = await resolveImageSource({
        base64Value: image_base64,
        pathValue: image_path,
        label: 'Subject image',
        required: true,
      });

      if (!subjectSource) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Subject image could not be resolved',
        );
      }

      referenceImages.push({
        referenceType: 'REFERENCE_TYPE_SUBJECT',
        referenceId: currentRefId++,
        referenceImage: {
          bytesBase64Encoded: subjectSource.base64,
          ...(subjectSource.mimeType ? { mimeType: subjectSource.mimeType } : {}),
        },
        subjectImageConfig: {
          subjectType: resolvedSubjectType,
          subjectDescription: subject_description!,
        },
      });
    }
  }

  if (hasStyle) {
    const styleImage = await resolveImageSource({
      base64Value: style_image_base64,
      pathValue: style_image_path,
      label: 'Style image',
      required: true,
    });

    if (!styleImage) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Style image could not be resolved',
      );
    }

    referenceImages.push({
      referenceType: 'REFERENCE_TYPE_STYLE',
      referenceId: currentRefId++,
      referenceImage: {
        bytesBase64Encoded: styleImage.base64,
        ...(styleImage.mimeType ? { mimeType: styleImage.mimeType } : {}),
      },
      styleImageConfig: {
        ...(style_description ? { styleDescription: style_description } : {}),
      },
    });
  }

  const requestBody: GoogleImagenRequest = {
    instances: [
      {
        prompt,
        referenceImages,
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
    },
  };

  if (negative_prompt) {
    requestBody.parameters!.negativePrompt = negative_prompt;
  }

  if (sample_image_size) {
    requestBody.parameters!.sampleImageSize = sample_image_size;
  }

  if (process.env.DEBUG) {
    console.error('[DEBUG] Reference images structure:');
    referenceImages.forEach((ref, idx) => {
      console.error(
        `[DEBUG]   Ref ${idx}: type=${ref.referenceType}, id=${ref.referenceId}`,
      );
    });
  }

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
    negative_prompt: negative_prompt || undefined,
    has_control: hasControl,
    has_subject: hasSubject,
    has_style: hasStyle,
    control_type: hasControl ? control_type : undefined,
    subject_type: hasSubject ? subject_type : undefined,
    subject_description: hasSubject ? subject_description : undefined,
    style_description: hasStyle ? style_description : undefined,
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
      throw new Error('No images were generated');
    }

    const predictions = response.data.predictions;
    const baseInfoText = `Image customized successfully!\n\nPrompt: ${prompt}\nAspect ratio: ${aspect_ratio}\nModel: ${model}\nReference types: ${hasControl ? 'control ' : ''}${hasSubject ? 'subject ' : ''}${hasStyle ? 'style' : ''}`;

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
      throw new Error(
        'Normalized path is required for file save mode.\n' +
          'This is an internal error - please report this issue.',
      );
    }

    const filePaths = await generateMultipleFilePaths(normalizedPath, sample_count);

    if (process.env.DEBUG) {
      console.error(`[DEBUG] Saving ${predictions.length} customized image(s)`);
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
          tool_name: 'customize_image',
          model,
          created_at: new Date().toISOString(),
          aspect_ratio,
          sample_image_size: sample_image_size || undefined,
        };

        try {
          imageBuffer = (await embedMetadata(imageBuffer, metadata)) as Buffer;
        } catch (error) {
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
          toolName: 'customize_image',
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
