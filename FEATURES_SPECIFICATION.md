# Image Generation MCP Server - Feature Specification
# 画像生成MCPサーバー - 機能仕様書

Version: 1.0.0
Last Updated: 2025-10-15

## Overview / 概要

This document describes the feature set and implementation guidelines for an MCP (Model Context Protocol) server that provides AI image generation capabilities. While the reference implementation uses Google Vertex AI Imagen, this specification is designed to be provider-agnostic and can be adapted for OpenAI DALL-E, Stable Diffusion, Midjourney, or other image generation models.

このドキュメントは、AI画像生成機能を提供するMCP（Model Context Protocol）サーバーの機能セットと実装ガイドラインを記述しています。リファレンス実装はGoogle Vertex AI Imagenを使用していますが、この仕様はプロバイダー非依存で設計されており、OpenAI DALL-E、Stable Diffusion、Midjourney、その他の画像生成モデルに適応可能です。

---

## 1. Core Capabilities / コア機能

### 1.1 Image Generation Tools / 画像生成ツール

#### 1.1.1 Basic Generation (generate_image)
**Purpose**: Generate images from text prompts
**目的**: テキストプロンプトから画像を生成

**Required Parameters**:
- `prompt` (string): Text description of desired image

**Optional Parameters**:
- `aspect_ratio` (enum): Image dimensions (1:1, 3:4, 4:3, 9:16, 16:9)
- `output_path` (string): File save location
- `sample_count` (integer): Number of variations (1-4)
- `sample_image_size` (enum): Resolution (1K, 2K, 4K, etc.)
- `model` (string): Specific model version to use
- `region` (string): Service region/endpoint
- `safety_level` (enum): Content filtering level
- `person_generation` (enum): Policy for generating people
- `language` (enum): Prompt language hint

**Provider-Specific Adaptations**:
- **OpenAI DALL-E**: Map to `size` parameter (256x256, 512x512, 1024x1024, 1024x1792, 1792x1024)
- **Stable Diffusion**: Map to width/height parameters
- **Midjourney**: Use aspect ratio as `--ar` parameter

#### 1.1.2 Image Editing (edit_image)
**Purpose**: Modify existing images with inpainting, outpainting, or mask-based editing
**目的**: インペイント、アウトペイント、マスクベース編集で既存画像を変更

**Required Parameters**:
- `prompt` (string): Description of desired changes
- `reference_image_base64` or `reference_image_path` (string): Source image

**Optional Parameters**:
- `mask_image_base64` or `mask_image_path` (string): Edit mask
- `mask_mode` (enum): background, foreground, semantic, user_provided, mask_free
- `mask_classes` (array[integer]): Semantic segmentation class IDs
- `mask_dilation` (float): Mask expansion factor
- `edit_mode` (enum): inpaint_removal, inpaint_insertion, bgswap, outpainting
- `base_steps` (integer): Sampling steps (quality vs speed)
- `guidance_scale` (float): Prompt adherence strength
- `negative_prompt` (string): Elements to avoid

**Provider-Specific Adaptations**:
- **OpenAI DALL-E**: Use Edit API with mask
- **Stable Diffusion**: img2img with inpainting pipeline
- **Midjourney**: Use `/blend` or image prompts with `--no` for negative prompts

#### 1.1.3 Image Upscaling (upscale_image)
**Purpose**: Enhance resolution of existing images
**目的**: 既存画像の解像度を向上

**Required Parameters**:
- `input_path` (string): Source image file

**Optional Parameters**:
- `scale_factor` (enum): 2x, 4x, 8x
- `output_path` (string): Save location

**Provider-Specific Adaptations**:
- **OpenAI**: Not directly supported (use third-party upscalers)
- **Stable Diffusion**: Use SD Upscale or ESRGAN
- **Midjourney**: Use `--uplight` or `--upbeta` parameters

#### 1.1.4 Generation + Upscaling (generate_and_upscale_image)
**Purpose**: Combined workflow for high-quality output
**目的**: 高品質出力のための組み合わせワークフロー

Combines `generate_image` and `upscale_image` parameters.

#### 1.1.5 Advanced Customization (customize_image)
**Purpose**: Generate with reference images for structure, subject, or style control
**目的**: 構造、被写体、スタイル制御のためのリファレンス画像を使用した生成

**Optional Parameters**:
- **Control Image**:
  - `control_image_base64/path`: Structure reference
  - `control_type`: face_mesh, canny, scribble, depth, pose
  - `enable_control_computation`: Auto-process raw image

- **Subject Images**:
  - `subject_images`: Array of reference images
  - `subject_description`: Brief subject description
  - `subject_type`: person, animal, product, default

- **Style Image**:
  - `style_image_base64/path`: Artistic style reference
  - `style_description`: Style description

**Provider-Specific Adaptations**:
- **OpenAI**: Limited; use image prompts where available
- **Stable Diffusion**: Use ControlNet for control images, IP-Adapter for subject/style
- **Midjourney**: Use image URLs followed by `--iw` for image weight

#### 1.1.6 YAML Configuration (customize_image_from_yaml, customize_image_from_yaml_inline)
**Purpose**: Manage complex parameters via configuration files
**目的**: 設定ファイルによる複雑なパラメータ管理

Allows storing all customization parameters in YAML format for reproducibility.

---

### 1.2 Async Job Management / 非同期ジョブ管理

For long-running operations and queue management.

#### Tools:
- `start_generation_job`: Submit job, return job_id
- `check_job_status`: Query current status (pending, running, completed, failed)
- `get_job_result`: Retrieve completed results
- `cancel_job`: Stop running job
- `list_jobs`: View all jobs with filtering

**Implementation Requirements**:
- Job database (SQLite, PostgreSQL, etc.)
- Status tracking
- Concurrent job limiting
- Timeout handling

---

### 1.3 History & Metadata / 履歴とメタデータ

Track all generations for reproducibility and auditing.

#### Tools:
- `list_history`: Browse past generations with filters
- `get_history_by_uuid`: Retrieve specific generation details
- `search_history`: Full-text search in prompts/parameters
- `get_metadata_from_image`: Read embedded metadata from image files

**Database Schema Requirements**:
```sql
CREATE TABLE history (
  uuid TEXT PRIMARY KEY,
  tool_name TEXT,
  model TEXT,
  prompt TEXT,
  parameters TEXT, -- JSON
  output_paths TEXT, -- JSON array
  file_sizes INTEGER,
  aspect_ratio TEXT,
  created_at DATETIME,
  metadata TEXT -- JSON
);
```

**Metadata Embedding**:
Store generation parameters in image EXIF/PNG metadata for traceability.

---

### 1.4 Prompt Templates / プロンプトテンプレート

Reusable prompt patterns with variable substitution.

#### Tools:
- `save_prompt_template`: Create template with {variable} placeholders
- `list_prompt_templates`: Browse available templates
- `get_template_detail`: View template details and examples
- `generate_from_template`: Generate using template + variable values
- `update_template`: Modify existing template
- `delete_template`: Remove template

**Database Schema**:
```sql
CREATE TABLE templates (
  name TEXT PRIMARY KEY,
  description TEXT,
  template TEXT,
  variables TEXT, -- JSON array
  default_params TEXT, -- JSON
  tags TEXT, -- JSON array
  created_at DATETIME,
  updated_at DATETIME
);
```

**Example Template**:
```yaml
name: "portrait-style"
description: "Professional portrait with customizable style"
template: "A professional portrait of {subject}, {style}, high quality photography"
variables: ["subject", "style"]
default_params:
  aspect_ratio: "3:4"
  model: "imagen-3.0-generate-002"
tags: ["portrait", "professional"]
```

---

### 1.5 Resource Management / リソース管理

MCP Resources API integration for file access.

#### Capabilities:
- `list_resources`: Enumerate generated images
- `read_resource`: Access image data via file:// URIs

**Implementation**:
- Track all generated files
- Provide file:// URI scheme
- Return metadata (name, size, mimeType, description)
- Support thumbnail generation (128x128 JPEG, configurable)

**Thumbnail Configuration**:
- Environment variables: `THUMBNAIL_SIZE` (default: 128, max: 512)
- `THUMBNAIL_QUALITY` (default: 60, range: 1-100)
- Token consumption: ~15-20 tokens for 14KB thumbnail

---

### 1.6 Utility Tools / ユーティリティツール

#### list_generated_images
Browse files in output directory.

#### list_semantic_classes
For models supporting semantic segmentation (Imagen only):
- Return database of 194 object classes
- Enable mask-based editing with class IDs

**Provider Adaptation**:
Skip this tool for providers without semantic segmentation.

---

## 2. MCP Protocol Implementation / MCPプロトコル実装

### 2.1 Server Configuration

```typescript
{
  name: "image-generation-server",
  version: "1.0.0",
  capabilities: {
    tools: {},
    resources: {}
  }
}
```

### 2.2 Tool Response Format

All tools must return MCP-compliant responses:

```typescript
{
  content: [
    {
      type: "text",
      text: "Generation successful\nSaved to: /path/to/image.png"
    },
    {
      type: "image",
      data: "<base64_string>", // Pure base64, NOT data URI
      mimeType: "image/jpeg" or "image/png",
      annotations: {
        audience: ["user", "assistant"],
        priority: 0.8
      }
    }
  ]
}
```

**Critical**: Use pure base64 in `data` field, not `data:image/jpeg;base64,...` format.

### 2.3 Resource URI Format

```
file:///absolute/path/to/image.png
```

Must use absolute file paths compatible with MCP Resources API.

---

## 3. Provider-Specific Implementation Guides / プロバイダー別実装ガイド

### 3.1 OpenAI DALL-E

**API Endpoint**: `https://api.openai.com/v1/images/generations`

**Parameter Mappings**:
| Generic Parameter | DALL-E Equivalent |
|-------------------|-------------------|
| `aspect_ratio: "1:1"` | `size: "1024x1024"` |
| `aspect_ratio: "16:9"` | `size: "1792x1024"` |
| `aspect_ratio: "9:16"` | `size: "1024x1792"` |
| `sample_count` | `n` |
| `model` | `model` (dall-e-2, dall-e-3) |

**Not Supported**:
- Upscaling (use external tool)
- Advanced customization (ControlNet, etc.)
- Semantic segmentation

**Authentication**:
```typescript
const response = await fetch('https://api.openai.com/v1/images/generations', {
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ prompt, size, n, model })
});
```

### 3.2 Stable Diffusion (via Automatic1111 API)

**API Endpoint**: `http://localhost:7860/sdapi/v1/txt2img`

**Parameter Mappings**:
| Generic Parameter | SD Equivalent |
|-------------------|---------------|
| `prompt` | `prompt` |
| `negative_prompt` | `negative_prompt` |
| `aspect_ratio` | Calculate `width` x `height` |
| `sample_count` | `batch_size` |
| `base_steps` | `steps` |
| `guidance_scale` | `cfg_scale` |
| `model` | Use `/sdapi/v1/sd-models` to switch |

**Advanced Features**:
- ControlNet: `/controlnet/txt2img`
- Upscaling: `/sdapi/v1/extra-single-image`
- Inpainting: `/sdapi/v1/img2img` with mask

**Example Request**:
```typescript
const response = await fetch('http://localhost:7860/sdapi/v1/txt2img', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: args.prompt,
    negative_prompt: args.negative_prompt || "",
    width: calculateWidth(args.aspect_ratio),
    height: calculateHeight(args.aspect_ratio),
    steps: args.base_steps || 20,
    cfg_scale: args.guidance_scale || 7.0,
    batch_size: args.sample_count || 1
  })
});
```

### 3.3 Midjourney (via Discord API)

**Implementation**: Use Discord bot with slash commands

**Parameter Mappings**:
| Generic Parameter | Midjourney Equivalent |
|-------------------|-----------------------|
| `prompt` | `/imagine prompt: {prompt}` |
| `aspect_ratio` | `--ar 16:9` |
| `model` | `--v 6` or `--niji 6` |
| `negative_prompt` | `--no {items}` |
| `style_image` | Image URL in prompt |

**Example Command**:
```
/imagine prompt: A portrait of a woman, cinematic lighting --ar 3:4 --v 6 --no blurry
```

**Limitations**:
- No direct API; requires Discord bot
- Async-only workflow
- Limited parameter control

---

## 4. Environment Variables / 環境変数

### Authentication / 認証
- `PROVIDER_API_KEY`: API key for service
- `PROVIDER_PROJECT_ID`: Project/account identifier
- `PROVIDER_REGION`: Service region (if applicable)

### Configuration / 設定
- `IMAGE_OUTPUT_DIR`: Default save directory (~/Downloads/ai-images)
- `THUMBNAIL_ENABLED`: Enable thumbnail generation (true/false)
- `THUMBNAIL_SIZE`: Thumbnail dimensions in pixels (128)
- `THUMBNAIL_QUALITY`: JPEG quality 1-100 (60)
- `MAX_CONCURRENT_JOBS`: Job queue limit (2)
- `DB_PATH`: Database location for history/jobs
- `DEBUG`: Enable verbose logging

---

## 5. File Structure / ファイル構造

Recommended project organization:

```
project-root/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── tools/                # Tool implementations
│   │   ├── generateImage.ts
│   │   ├── editImage.ts
│   │   ├── upscaleImage.ts
│   │   └── ...
│   ├── providers/            # Provider adapters
│   │   ├── openai.ts
│   │   ├── stableDiffusion.ts
│   │   └── imagen.ts
│   ├── utils/
│   │   ├── database.ts       # SQLite/history management
│   │   ├── jobManager.ts     # Async job queue
│   │   ├── resources.ts      # MCP resources API
│   │   ├── thumbnail.ts      # Image resizing
│   │   └── path.ts           # File path handling
│   └── types/                # TypeScript interfaces
├── package.json
├── tsconfig.json
└── README.md
```

---

## 6. Testing Checklist / テストチェックリスト

### Basic Generation / 基本生成
- [ ] Text-to-image with default parameters
- [ ] Multiple aspect ratios (1:1, 16:9, 9:16, etc.)
- [ ] Batch generation (sample_count > 1)
- [ ] Different models/versions

### Advanced Features / 高度な機能
- [ ] Image editing with user-provided mask
- [ ] Auto-mask generation (background/foreground)
- [ ] Upscaling at 2x and 4x
- [ ] Subject/style reference images
- [ ] Negative prompts

### System Integration / システム統合
- [ ] File save to custom directory
- [ ] Absolute vs relative paths
- [ ] Thumbnail generation (display in Claude Desktop)
- [ ] MCP Resources API (file:// URIs)
- [ ] Async job queue (start/check/cancel)

### Database & History / データベースと履歴
- [ ] History recording for all generations
- [ ] Search by prompt keywords
- [ ] Filter by date/model/aspect_ratio
- [ ] Metadata embedding in images
- [ ] Template save/load/generate

### Error Handling / エラーハンドリング
- [ ] Invalid parameters (out of range)
- [ ] Missing API keys
- [ ] API rate limits
- [ ] File permission errors
- [ ] Network timeouts

---

## 7. Migration Guide / 移行ガイド

### From Vertex AI Imagen to OpenAI DALL-E

1. **Replace API Client**:
   ```typescript
   // Before
   import { GoogleAuth } from 'google-auth-library';
   const auth = new GoogleAuth({ scopes: [...] });

   // After
   import OpenAI from 'openai';
   const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
   ```

2. **Update Tool Handlers**:
   ```typescript
   async function generateImage(args) {
     const response = await client.images.generate({
       model: "dall-e-3",
       prompt: args.prompt,
       n: args.sample_count || 1,
       size: mapAspectRatioToSize(args.aspect_ratio),
       response_format: "b64_json"
     });

     // Save images and return MCP response
     return createImageResponse(response.data);
   }
   ```

3. **Remove Unsupported Features**:
   - Semantic segmentation tools
   - Upscaling (or integrate external service)
   - Advanced customization (ControlNet, etc.)

4. **Update Documentation**:
   - Modify README with OpenAI setup instructions
   - Update environment variable names
   - Note feature limitations

---

## 8. Best Practices / ベストプラクティス

### Performance / パフォーマンス
1. Use async job queue for operations > 30 seconds
2. Implement result caching for identical prompts
3. Compress thumbnails aggressively (60 quality, 128px)
4. Limit concurrent API calls to avoid rate limits

### Security / セキュリティ
1. Validate all file paths (prevent traversal attacks)
2. Never expose API keys in responses
3. Sanitize user prompts for SQL injection
4. Implement content safety filters

### UX / ユーザー体験
1. Always return file paths + URIs for generated images
2. Include generation parameters in response text
3. Provide thumbnail previews when possible
4. Show progress updates for long operations

### Maintainability / 保守性
1. Use TypeScript for type safety
2. Separate provider logic into adapters
3. Write comprehensive error messages
4. Log all API calls with timestamps

---

## 9. Future Enhancements / 将来の拡張

### Planned Features / 計画中の機能
- [ ] Video generation support
- [ ] Animation/GIF output
- [ ] Batch processing from CSV
- [ ] Image variation generation
- [ ] Auto-prompt enhancement with LLMs
- [ ] Cost tracking per generation
- [ ] Multi-provider fallback

### Research Areas / 研究領域
- [ ] Hybrid generation (multiple models in pipeline)
- [ ] Real-time streaming for progressive refinement
- [ ] On-device generation with local models
- [ ] Blockchain-based provenance tracking

---

## 10. References / 参考資料

### Specifications / 仕様
- [MCP Protocol Documentation](https://modelcontextprotocol.io/docs)
- [MCP Resources API](https://modelcontextprotocol.io/docs/concepts/resources)
- [MCP Tools Schema](https://modelcontextprotocol.io/docs/concepts/tools)

### Provider APIs / プロバイダーAPI
- [OpenAI DALL-E API](https://platform.openai.com/docs/api-reference/images)
- [Vertex AI Imagen API](https://cloud.google.com/vertex-ai/docs/generative-ai/image/overview)
- [Stable Diffusion Web UI API](https://github.com/AUTOMATIC1111/stable-diffusion-webui/wiki/API)
- [Midjourney API (unofficial)](https://github.com/erictik/midjourney-api)

### Libraries / ライブラリ
- [Sharp](https://sharp.pixelplumbing.com/) - Image processing for thumbnails
- [Better-SQLite3](https://github.com/WiseLibs/better-sqlite3) - Database for history
- [YAML](https://github.com/eemeli/yaml) - Configuration file parsing

---

## Contact & Support / 連絡先とサポート

For questions about this specification or implementation assistance:
- GitHub Issues: [Project Repository]
- Email: [Maintainer Contact]
- Discord: [Community Server]

---

**Document Version History**:
- v1.0.0 (2025-10-15): Initial specification based on Vertex AI Imagen MCP Server v0.6.1
