# Inpainting Removal with Auto Mask Detection

## Overview

Use inpainting to remove content from images by providing a base image and text prompt. Imagen automatically detects and creates the mask area to modify in the base image.

## API Endpoint

```
POST https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{LOCATION}/publishers/google/models/imagen-3.0-capability-001:predict
```

## Parameters

### Path Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `PROJECT_ID` | Your Google Cloud project ID | `my-project-123` |
| `LOCATION` | Project region | `us-central1`, `europe-west2`, `asia-northeast3` |

See [Vertex AI Generative AI Locations](https://cloud.google.com/vertex-ai/docs/general/locations) for available regions.

### Request Body Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | string | **For best results with removal inpainting, omit both `prompt` and `negativePrompt`**. Note: Media Playground UI requires a prompt - this recommendation applies to API usage only |
| `B64_BASE_IMAGE` | string | Base image to edit or upscale (base64 encoded byte string). Max size: 10 MB |
| `MASK_MODE` | string | Type of automatic mask creation. See [Mask Modes](#mask-modes) below |
| `MASK_DILATION` | float | Percentage of image width to dilate the mask. Recommended: `0.01` to compensate for imperfect input masks |
| `EDIT_STEPS` | integer | Number of sampling steps for base model. Start with `12` for removal inpainting. Increase up to `75` if quality doesn't meet requirements (higher steps increase latency) |
| `EDIT_IMAGE_COUNT` | integer | Number of edited images to generate. Range: 1-4. Default: `4` |

### Mask Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `MASK_MODE_BACKGROUND` | Automatically generate mask using background segmentation | Modifying background content |
| `MASK_MODE_FOREGROUND` | Automatically generate mask using foreground segmentation | Modifying foreground content (e.g., removing foreground objects) |
| `MASK_MODE_SEMANTIC` | Automatically generate mask using semantic segmentation based on classes specified in `maskImageConfig.maskClasses` array | Removing specific object types |

#### Semantic Mode Example

```json
"maskImageConfig": {
  "maskMode": "MASK_MODE_SEMANTIC",
  "maskClasses": [175, 176],  // bicycle, car
  "dilation": 0.01
}
```

## Request Example

```json
{
  "instances": [
    {
      "prompt": "",
      "referenceImages": [
        {
          "referenceType": "REFERENCE_TYPE_RAW",
          "referenceId": 1,
          "referenceImage": {
            "bytesBase64Encoded": "B64_BASE_IMAGE"
          }
        },
        {
          "referenceType": "REFERENCE_TYPE_MASK",
          "referenceId": 2,
          "maskImageConfig": {
            "maskMode": "MASK_MODE",
            "dilation": MASK_DILATION
          }
        }
      ]
    }
  ],
  "parameters": {
    "editConfig": {
      "baseSteps": EDIT_STEPS
    },
    "editMode": "EDIT_MODE_INPAINT_REMOVAL",
    "sampleCount": EDIT_IMAGE_COUNT
  }
}
```

## Best Practices

- **For removal inpainting (API)**: Leave `prompt` empty for best results
- **Mask dilation**: Use `0.01` to compensate for imperfect masks
- **Edit steps**:
  - Start with `12` steps
  - Increase up to `75` if quality is insufficient
  - Note: More steps = higher latency
- **Sample count**: Generate multiple variations (1-4) to choose the best result

## Important Notes

### Media Playground vs API

- **API**: Empty `prompt` is recommended for optimal removal results
- **Media Playground UI**: Requires a prompt (cannot be left empty). This is a UI limitation only

## Related Documentation

- [Image Return Policy](./IMAGE_RETURN_POLICY.md)
- [Resource API Overview](./RESOURCE_API_OVERVIEW.md)
- [Vertex AI Image Generation API Reference](https://cloud.google.com/vertex-ai/docs/generative-ai/image/edit-images)
