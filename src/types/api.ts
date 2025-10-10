/**
 * Google Imagen API型定義
 */

export interface GoogleImagenRequestInstance {
  prompt: string;
  image?: {
    bytesBase64Encoded?: string;
    gcsUri?: string;
    mimeType?: string;
  };
  mask?: {
    image?: {
      bytesBase64Encoded?: string;
      gcsUri?: string;
      mimeType?: string;
    };
    polygons?: Array<unknown>;
  };
}

export interface GoogleImagenRequest {
  instances: Array<GoogleImagenRequestInstance>;
  parameters?: {
    sampleCount?: number;
    aspectRatio?: string;
    safetySettings?: Array<{
      category: string;
      threshold: string;
    }>;
    personGeneration?: string;
    language?: string;
  };
}

export interface GoogleUpscaleRequest {
  instances: Array<{
    prompt?: string;
    image?: {
      bytesBase64Encoded: string;
    };
  }>;
  parameters: {
    mode: string;
    upscaleConfig: {
      upscaleFactor: string;
    };
    sampleCount?: number;
  };
}

export interface GoogleImagenResponse {
  predictions: Array<{
    bytesBase64Encoded: string;
    mimeType: string;
  }>;
}

export interface ReferenceImage {
  referenceType: "REFERENCE_TYPE_RAW" | "REFERENCE_TYPE_MASK";
  referenceId: number;
  referenceImage?: {
    bytesBase64Encoded: string;
    mimeType?: string;
  };
  maskImageConfig?: {
    maskMode: "MASK_MODE_USER_PROVIDED" | "MASK_MODE_BACKGROUND" | "MASK_MODE_FOREGROUND" | "MASK_MODE_SEMANTIC";
    maskClasses?: number[];
    dilation?: number;
  };
}

export interface GoogleImagenEditRequest {
  instances: Array<{
    prompt: string;
    referenceImages: ReferenceImage[];
  }>;
  parameters: {
    editMode: "EDIT_MODE_INPAINT_REMOVAL" | "EDIT_MODE_INPAINT_INSERTION" | "EDIT_MODE_BGSWAP" | "edit";
    editConfig?: {
      baseSteps?: number;
    };
    sampleCount?: number;
    guidanceScale?: number;
    negativePrompt?: string;
  };
}
