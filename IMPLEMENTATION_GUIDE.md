# Implementation Guide for Multi-Provider Support
# マルチプロバイダー対応実装ガイド

This guide provides step-by-step instructions for adapting this MCP server to support multiple AI image generation providers.

このガイドでは、このMCPサーバーを複数のAI画像生成プロバイダーに対応させるための段階的な手順を提供します。

---

## Quick Start / クイックスタート

### Option 1: OpenAI DALL-E Implementation / OpenAI DALL-E実装

**Time Estimate**: 2-4 hours
**Difficulty**: Easy

#### Step 1: Install Dependencies
```bash
npm install openai
```

#### Step 2: Create Provider Adapter
Create `src/providers/openai.ts`:

```typescript
import OpenAI from 'openai';
import { GenerateImageArgs } from '../types/tools.js';

export class OpenAIProvider {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  // Map aspect ratio to DALL-E size
  private mapAspectRatio(ratio: string): "1024x1024" | "1792x1024" | "1024x1792" {
    switch (ratio) {
      case "16:9": return "1792x1024";
      case "9:16": return "1024x1792";
      default: return "1024x1024";
    }
  }

  async generateImage(args: GenerateImageArgs): Promise<Buffer[]> {
    const response = await this.client.images.generate({
      model: args.model || "dall-e-3",
      prompt: args.prompt,
      n: args.sample_count || 1,
      size: this.mapAspectRatio(args.aspect_ratio || "1:1"),
      response_format: "b64_json",
      quality: args.sample_image_size === "2K" ? "hd" : "standard"
    });

    // Convert base64 to Buffer
    return response.data.map(img =>
      Buffer.from(img.b64_json!, 'base64')
    );
  }

  async editImage(args: EditImageArgs): Promise<Buffer[]> {
    // Convert base64 to File
    const imageBuffer = Buffer.from(args.reference_image_base64, 'base64');
    const maskBuffer = args.mask_image_base64
      ? Buffer.from(args.mask_image_base64, 'base64')
      : undefined;

    const response = await this.client.images.edit({
      image: imageBuffer,
      mask: maskBuffer,
      prompt: args.prompt,
      n: args.sample_count || 1,
      size: "1024x1024",
      response_format: "b64_json"
    });

    return response.data.map(img =>
      Buffer.from(img.b64_json!, 'base64')
    );
  }

  // Upscaling not supported - return original
  async upscaleImage(buffer: Buffer, scaleFactor: string): Promise<Buffer> {
    throw new Error("OpenAI does not support upscaling. Consider using an external service.");
  }
}
```

#### Step 3: Update Tool Handlers
Modify `src/tools/generateImage.ts`:

```typescript
import { OpenAIProvider } from '../providers/openai.js';

export async function generateImage(context: ToolContext, args: GenerateImageArgs) {
  const provider = process.env.IMAGE_PROVIDER === 'openai'
    ? new OpenAIProvider()
    : new ImagenProvider(context.auth);

  const buffers = await provider.generateImage(args);

  // Save images and return MCP response
  // ... existing file save logic
}
```

#### Step 4: Configure Environment
```bash
# .env
IMAGE_PROVIDER=openai
OPENAI_API_KEY=sk-...
IMAGE_OUTPUT_DIR=~/Downloads/ai-images
```

#### Step 5: Test
```bash
npm run build
# Test with Claude Desktop or MCP inspector
```

---

### Option 2: Stable Diffusion (Automatic1111) Implementation

**Time Estimate**: 3-6 hours
**Difficulty**: Medium

#### Step 1: Install Dependencies
```bash
npm install node-fetch form-data
```

#### Step 2: Start Automatic1111 Web UI
```bash
# Install from https://github.com/AUTOMATIC1111/stable-diffusion-webui
./webui.sh --api --listen
# Server runs on http://localhost:7860
```

#### Step 3: Create Provider Adapter
Create `src/providers/stableDiffusion.ts`:

```typescript
import fetch from 'node-fetch';
import FormData from 'form-data';

export class StableDiffusionProvider {
  private apiUrl: string;

  constructor() {
    this.apiUrl = process.env.SD_API_URL || 'http://localhost:7860';
  }

  private calculateDimensions(aspectRatio: string): { width: number, height: number } {
    const baseSize = 512;
    switch (aspectRatio) {
      case "1:1": return { width: 512, height: 512 };
      case "16:9": return { width: 768, height: 432 };
      case "9:16": return { width: 432, height: 768 };
      case "4:3": return { width: 640, height: 480 };
      case "3:4": return { width: 480, height: 640 };
      default: return { width: 512, height: 512 };
    }
  }

  async generateImage(args: GenerateImageArgs): Promise<Buffer[]> {
    const dims = this.calculateDimensions(args.aspect_ratio || "1:1");

    const response = await fetch(`${this.apiUrl}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: args.prompt,
        negative_prompt: args.negative_prompt || "",
        width: dims.width,
        height: dims.height,
        steps: args.base_steps || 20,
        cfg_scale: args.guidance_scale || 7.0,
        batch_size: args.sample_count || 1,
        sampler_name: "Euler a",
        seed: -1
      })
    });

    const data = await response.json();
    return data.images.map((img: string) => Buffer.from(img, 'base64'));
  }

  async editImage(args: EditImageArgs): Promise<Buffer[]> {
    const dims = this.calculateDimensions("1:1");

    const response = await fetch(`${this.apiUrl}/sdapi/v1/img2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        init_images: [args.reference_image_base64],
        mask: args.mask_image_base64,
        prompt: args.prompt,
        negative_prompt: args.negative_prompt || "",
        width: dims.width,
        height: dims.height,
        steps: args.base_steps || 20,
        cfg_scale: args.guidance_scale || 7.0,
        denoising_strength: 0.75,
        inpainting_fill: 1, // original
        inpaint_full_res: false
      })
    });

    const data = await response.json();
    return data.images.map((img: string) => Buffer.from(img, 'base64'));
  }

  async upscaleImage(buffer: Buffer, scaleFactor: string): Promise<Buffer> {
    const base64 = buffer.toString('base64');

    const response = await fetch(`${this.apiUrl}/sdapi/v1/extra-single-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64,
        upscaling_resize: parseInt(scaleFactor),
        upscaler_1: "R-ESRGAN 4x+",
        upscaler_2: "None",
        extras_upscaler_2_visibility: 0
      })
    });

    const data = await response.json();
    return Buffer.from(data.image, 'base64');
  }

  // ControlNet support
  async generateWithControlNet(args: CustomizeImageArgs): Promise<Buffer[]> {
    const dims = this.calculateDimensions(args.aspect_ratio || "1:1");

    const controlnetUnits = [];
    if (args.control_image_base64) {
      controlnetUnits.push({
        input_image: args.control_image_base64,
        model: this.mapControlType(args.control_type),
        module: args.enable_control_computation ? "auto" : "none",
        weight: 1.0,
        guidance_start: 0.0,
        guidance_end: 1.0
      });
    }

    const response = await fetch(`${this.apiUrl}/controlnet/txt2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: args.prompt,
        negative_prompt: args.negative_prompt || "",
        width: dims.width,
        height: dims.height,
        steps: 20,
        cfg_scale: 7.0,
        controlnet_units: controlnetUnits
      })
    });

    const data = await response.json();
    return data.images.map((img: string) => Buffer.from(img, 'base64'));
  }

  private mapControlType(type: string): string {
    const mapping: Record<string, string> = {
      "canny": "control_canny",
      "scribble": "control_scribble",
      "face_mesh": "control_openpose"
    };
    return mapping[type] || "control_canny";
  }
}
```

#### Step 4: Environment Setup
```bash
# .env
IMAGE_PROVIDER=stable-diffusion
SD_API_URL=http://localhost:7860
IMAGE_OUTPUT_DIR=~/Downloads/ai-images
```

---

### Option 3: Multi-Provider Architecture

**Time Estimate**: 8-12 hours
**Difficulty**: Advanced

#### Step 1: Define Provider Interface
Create `src/providers/base.ts`:

```typescript
export interface ImageProvider {
  name: string;

  // Core methods
  generateImage(args: GenerateImageArgs): Promise<Buffer[]>;
  editImage?(args: EditImageArgs): Promise<Buffer[]>;
  upscaleImage?(buffer: Buffer, scaleFactor: string): Promise<Buffer>;
  customizeImage?(args: CustomizeImageArgs): Promise<Buffer[]>;

  // Capabilities
  supports: {
    generation: boolean;
    editing: boolean;
    upscaling: boolean;
    customization: boolean;
    asyncJobs: boolean;
  };

  // Limits
  limits: {
    maxSampleCount: number;
    supportedAspectRatios: string[];
    maxResolution: string;
  };
}
```

#### Step 2: Implement Provider Factory
Create `src/providers/factory.ts`:

```typescript
import { ImageProvider } from './base.js';
import { ImagenProvider } from './imagen.js';
import { OpenAIProvider } from './openai.js';
import { StableDiffusionProvider } from './stableDiffusion.js';

export class ProviderFactory {
  static create(providerName?: string): ImageProvider {
    const provider = providerName || process.env.IMAGE_PROVIDER || 'imagen';

    switch (provider.toLowerCase()) {
      case 'openai':
      case 'dall-e':
        return new OpenAIProvider();

      case 'stable-diffusion':
      case 'sd':
        return new StableDiffusionProvider();

      case 'imagen':
      case 'vertex-ai':
      default:
        return new ImagenProvider();
    }
  }

  static listProviders(): string[] {
    return ['imagen', 'openai', 'stable-diffusion'];
  }

  static getProviderCapabilities(providerName: string): ImageProvider['supports'] {
    const provider = ProviderFactory.create(providerName);
    return provider.supports;
  }
}
```

#### Step 3: Update Tool Handlers
Modify all tool files to use factory:

```typescript
import { ProviderFactory } from '../providers/factory.js';

export async function generateImage(context: ToolContext, args: GenerateImageArgs) {
  const provider = ProviderFactory.create();

  // Check capability
  if (!provider.supports.generation) {
    throw new Error(`Provider ${provider.name} does not support image generation`);
  }

  // Validate parameters against provider limits
  if (args.sample_count && args.sample_count > provider.limits.maxSampleCount) {
    throw new Error(`Sample count exceeds provider limit of ${provider.limits.maxSampleCount}`);
  }

  // Generate images
  const buffers = await provider.generateImage(args);

  // Rest of the logic (save files, create response)
  // ...
}
```

#### Step 4: Add Provider Selection Tool
Add new tool `select_provider`:

```typescript
{
  name: "select_provider",
  description: "Switch between image generation providers (Imagen, OpenAI, Stable Diffusion)",
  inputSchema: {
    type: "object",
    properties: {
      provider: {
        type: "string",
        enum: ["imagen", "openai", "stable-diffusion"],
        description: "Provider to use for subsequent generations"
      }
    },
    required: ["provider"]
  }
}
```

---

## Feature Compatibility Matrix / 機能互換性マトリックス

| Feature | Vertex AI Imagen | OpenAI DALL-E | Stable Diffusion | Midjourney |
|---------|------------------|---------------|------------------|------------|
| Text-to-Image | ✅ | ✅ | ✅ | ✅ |
| Image Editing | ✅ | ✅ (limited) | ✅ | ❌ |
| Upscaling | ✅ | ❌ | ✅ | ✅ |
| ControlNet | ❌ | ❌ | ✅ | ❌ |
| Semantic Masking | ✅ | ❌ | ✅ (extensions) | ❌ |
| Subject Consistency | ✅ | ❌ | ✅ (IP-Adapter) | ✅ (image refs) |
| Batch Generation | ✅ (1-4) | ✅ (1-10) | ✅ (unlimited) | ✅ (limited) |
| Aspect Ratios | 5 presets | 3 sizes | Custom | Custom |
| Async Jobs | ✅ | ❌ | ❌ | ✅ (native) |
| API Cost | $$$ | $$ | Free (local) | $$$$ |

---

## Database Schema Updates / データベーススキーマ更新

Add provider tracking to history:

```sql
ALTER TABLE history ADD COLUMN provider TEXT;
ALTER TABLE history ADD COLUMN provider_model TEXT;
ALTER TABLE history ADD COLUMN api_version TEXT;
```

Update insertion:

```typescript
await db.run(`
  INSERT INTO history (
    uuid, tool_name, model, provider, provider_model,
    prompt, parameters, output_paths, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`, [
  uuid,
  toolName,
  args.model || 'default',
  provider.name,
  provider.getModelVersion(),
  args.prompt,
  JSON.stringify(args),
  JSON.stringify(outputPaths),
  new Date().toISOString()
]);
```

---

## Environment Variable Template / 環境変数テンプレート

Create `.env.template`:

```bash
# Provider Selection (imagen | openai | stable-diffusion)
IMAGE_PROVIDER=imagen

# === Vertex AI Imagen ===
GOOGLE_API_KEY=
GOOGLE_PROJECT_ID=
GOOGLE_REGION=us-central1
GOOGLE_IMAGEN_MODEL=imagen-3.0-generate-002

# === OpenAI DALL-E ===
OPENAI_API_KEY=
OPENAI_ORG_ID=

# === Stable Diffusion ===
SD_API_URL=http://localhost:7860
SD_DEFAULT_MODEL=v1-5-pruned-emaonly.safetensors

# === Common Settings ===
IMAGE_OUTPUT_DIR=~/Downloads/ai-images
THUMBNAIL_ENABLED=true
THUMBNAIL_SIZE=128
THUMBNAIL_QUALITY=60
MAX_CONCURRENT_JOBS=2
DB_PATH=
DEBUG=false
```

---

## Testing Strategy / テスト戦略

### Unit Tests
Create `tests/providers/openai.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { OpenAIProvider } from '../../src/providers/openai.js';

describe('OpenAIProvider', () => {
  it('should map aspect ratio 1:1 to 1024x1024', () => {
    const provider = new OpenAIProvider();
    const size = provider['mapAspectRatio']('1:1');
    expect(size).toBe('1024x1024');
  });

  it('should generate image from prompt', async () => {
    const provider = new OpenAIProvider();
    const buffers = await provider.generateImage({
      prompt: 'A test image',
      aspect_ratio: '1:1'
    });
    expect(buffers).toHaveLength(1);
    expect(buffers[0]).toBeInstanceOf(Buffer);
  });
});
```

### Integration Tests
Create `tests/integration/multiProvider.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ProviderFactory } from '../../src/providers/factory.js';

describe('Multi-Provider Integration', () => {
  it('should switch between providers', async () => {
    const imagen = ProviderFactory.create('imagen');
    expect(imagen.name).toBe('Vertex AI Imagen');

    const openai = ProviderFactory.create('openai');
    expect(openai.name).toBe('OpenAI DALL-E');

    const sd = ProviderFactory.create('stable-diffusion');
    expect(sd.name).toBe('Stable Diffusion');
  });

  it('should respect provider capabilities', () => {
    const openai = ProviderFactory.create('openai');
    expect(openai.supports.upscaling).toBe(false);

    const sd = ProviderFactory.create('stable-diffusion');
    expect(sd.supports.upscaling).toBe(true);
  });
});
```

### End-to-End Tests
Use MCP Inspector or Claude Desktop:

```bash
# Install MCP Inspector
npm install -g @modelcontextprotocol/inspector

# Run server in debug mode
DEBUG=true npm run build && mcp-inspector node build/index.js

# Test each provider:
# 1. Call generate_image with different providers
# 2. Verify output files exist
# 3. Check thumbnail generation
# 4. Validate history recording
```

---

## Performance Optimization / パフォーマンス最適化

### 1. Caching Strategy
```typescript
import NodeCache from 'node-cache';

class CachedProvider implements ImageProvider {
  private cache = new NodeCache({ stdTTL: 3600 }); // 1 hour

  async generateImage(args: GenerateImageArgs): Promise<Buffer[]> {
    const cacheKey = this.hashArgs(args);
    const cached = this.cache.get<Buffer[]>(cacheKey);

    if (cached) {
      console.log('Cache hit for prompt:', args.prompt);
      return cached;
    }

    const result = await this.provider.generateImage(args);
    this.cache.set(cacheKey, result);
    return result;
  }

  private hashArgs(args: any): string {
    return crypto.createHash('sha256')
      .update(JSON.stringify(args))
      .digest('hex');
  }
}
```

### 2. Rate Limiting
```typescript
import Bottleneck from 'bottleneck';

class RateLimitedProvider implements ImageProvider {
  private limiter = new Bottleneck({
    maxConcurrent: 2,
    minTime: 1000 // 1 request per second
  });

  async generateImage(args: GenerateImageArgs): Promise<Buffer[]> {
    return this.limiter.schedule(() =>
      this.provider.generateImage(args)
    );
  }
}
```

### 3. Parallel Processing
```typescript
async function generateBatch(prompts: string[]): Promise<Buffer[][]> {
  const provider = ProviderFactory.create();

  // Process in batches of 5
  const batchSize = 5;
  const results = [];

  for (let i = 0; i < prompts.length; i += batchSize) {
    const batch = prompts.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(prompt => provider.generateImage({ prompt }))
    );
    results.push(...batchResults);
  }

  return results;
}
```

---

## Deployment / デプロイ

### Docker Support
Create `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built files
COPY build ./build

# Environment
ENV NODE_ENV=production
ENV IMAGE_PROVIDER=imagen

# Run server
CMD ["node", "build/index.js"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  mcp-server:
    build: .
    environment:
      - IMAGE_PROVIDER=${IMAGE_PROVIDER}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - IMAGE_OUTPUT_DIR=/data/images
    volumes:
      - ./data:/data
    restart: unless-stopped

  stable-diffusion:
    image: sd-webui:latest
    ports:
      - "7860:7860"
    volumes:
      - ./models:/models
```

---

## Troubleshooting / トラブルシューティング

### Common Issues / よくある問題

#### 1. "Provider not found" Error
**Cause**: Invalid `IMAGE_PROVIDER` value
**Solution**: Check spelling and use one of: imagen, openai, stable-diffusion

#### 2. Thumbnail Not Displaying in Claude Desktop
**Cause**: Data URI format in `data` field
**Solution**: Ensure pure base64 string (no `data:image/...` prefix)

```typescript
// ❌ Wrong
{ type: "image", data: "data:image/png;base64,iVBORw..." }

// ✅ Correct
{ type: "image", data: "iVBORw...", mimeType: "image/png" }
```

#### 3. Stable Diffusion Connection Failed
**Cause**: Web UI not running or wrong URL
**Solution**:
```bash
# Check if server is running
curl http://localhost:7860/sdapi/v1/sd-models

# Start with API enabled
./webui.sh --api --listen
```

#### 4. OpenAI Rate Limit Exceeded
**Cause**: Too many concurrent requests
**Solution**: Implement rate limiting (see Performance Optimization)

---

## Maintenance Checklist / メンテナンスチェックリスト

### Weekly / 毎週
- [ ] Review error logs for failed generations
- [ ] Check disk space in `IMAGE_OUTPUT_DIR`
- [ ] Verify database integrity
- [ ] Update provider API clients if new versions available

### Monthly / 毎月
- [ ] Archive old images to cold storage
- [ ] Analyze usage patterns by provider
- [ ] Review and optimize slow queries
- [ ] Test disaster recovery procedures

### Quarterly / 四半期ごと
- [ ] Evaluate new providers/models
- [ ] Update documentation
- [ ] Conduct security audit
- [ ] Performance benchmarking

---

## Resources / リソース

### Documentation / ドキュメント
- [Vertex AI Imagen Docs](https://cloud.google.com/vertex-ai/docs/generative-ai/image/overview)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [SD Web UI API Wiki](https://github.com/AUTOMATIC1111/stable-diffusion-webui/wiki/API)

### Community / コミュニティ
- [MCP Discord](https://discord.gg/mcp)
- [Stable Diffusion Reddit](https://reddit.com/r/StableDiffusion)
- [OpenAI Community](https://community.openai.com/)

### Tools / ツール
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
- [Postman Collections](https://www.postman.com/)
- [Diffusers Library](https://github.com/huggingface/diffusers)

---

**Last Updated**: 2025-10-15
**Maintainer**: [Your Name/Team]
**License**: MIT
