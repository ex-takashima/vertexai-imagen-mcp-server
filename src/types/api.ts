/**
 * Google Imagen API型定義
 */

export interface ReferenceImage {
  referenceType: "REFERENCE_TYPE_RAW" | "REFERENCE_TYPE_MASK" | "REFERENCE_TYPE_CONTROL" | "REFERENCE_TYPE_SUBJECT" | "REFERENCE_TYPE_STYLE";
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
  controlImageConfig?: {
    controlType: "CONTROL_TYPE_FACE_MESH" | "CONTROL_TYPE_CANNY" | "CONTROL_TYPE_SCRIBBLE";
    enableControlImageComputation?: boolean;
  };
  subjectImageConfig?: {
    subjectDescription: string;
    subjectType: "SUBJECT_TYPE_PERSON" | "SUBJECT_TYPE_ANIMAL" | "SUBJECT_TYPE_PRODUCT" | "SUBJECT_TYPE_DEFAULT";
  };
  styleImageConfig?: {
    styleDescription?: string;
  };
}

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
  referenceImages?: ReferenceImage[];
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
    negativePrompt?: string;
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

export interface GoogleImagenEditRequest {
  instances: Array<{
    prompt: string;
    referenceImages: ReferenceImage[];
  }>;
  parameters: {
    editMode: "EDIT_MODE_INPAINT_REMOVAL" | "EDIT_MODE_INPAINT_INSERTION" | "EDIT_MODE_BGSWAP" | "EDIT_MODE_OUTPAINT" | "EDIT_MODE_DEFAULT" | "edit";
    editConfig?: {
      baseSteps?: number;
    };
    sampleCount?: number;
    guidanceScale?: number;
    negativePrompt?: string;
  };
}
