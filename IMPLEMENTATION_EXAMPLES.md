# Implementation Examples
# 実装サンプル集

Complete, production-ready code examples for integrating various image generation providers.

各種画像生成プロバイダーを統合するための、完全な実用レベルのコード例集。

---

## Table of Contents / 目次

1. [OpenAI DALL-E Integration](#openai-dall-e-integration)
2. [Stable Diffusion Integration](#stable-diffusion-integration)
3. [Database Operations](#database-operations)
4. [Metadata Embedding](#metadata-embedding)
5. [Error Handling Patterns](#error-handling-patterns)
6. [Testing Strategies](#testing-strategies)

---

## OpenAI DALL-E Integration

### Complete Provider Implementation

Create `src/providers/openai.ts`:

```typescript
import OpenAI from 'openai';
import type {
  ImageProvider,
  GenerateImageArgs,
  EditImageArgs
} from '../types/index.js';

export class OpenAIProvider implements ImageProvider {
  name = 'OpenAI DALL-E';
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({ apiKey });
  }

  supports = {
    generation: true,
    editing: true,
    upscaling: false,  // DALL-E doesn't support upscaling
    customization: false,
    asyncJobs: false
  };

  limits = {
    maxSampleCount: 10,
    supportedAspectRatios: ['1:1', '16:9', '9:16'],
    maxResolution: '1792x1024'
  };

  /**
   * Generate images using DALL-E
   */
  async generateImage(args: GenerateImageArgs): Promise<Buffer[]> {
    try {
      const response = await this.client.images.generate({
        model: args.model || 'dall-e-3',
        prompt: args.prompt,
        n: Math.min(args.sample_count || 1, 10),
        size: this.mapAspectRatio(args.aspect_ratio || '1:1'),
        quality: args.sample_image_size === '2K' ? 'hd' : 'standard',
        response_format: 'b64_json'
      });

      return response.data.map(img =>
        Buffer.from(img.b64_json!, 'base64')
      );
    } catch (error) {
      throw this.handleOpenAIError(error);
    }
  }

  /**
   * Edit images using DALL-E
   */
  async editImage(args: EditImageArgs): Promise<Buffer[]> {
    try {
      // Convert base64 to Buffer
      const imageBuffer = args.reference_image_base64
        ? Buffer.from(args.reference_image_base64, 'base64')
        : await this.readImageFile(args.reference_image_path!);

      const maskBuffer = args.mask_image_base64
        ? Buffer.from(args.mask_image_base64, 'base64')
        : args.mask_image_path
        ? await this.readImageFile(args.mask_image_path)
        : undefined;

      // DALL-E requires images as File objects
      const imageFile = new File([imageBuffer], 'image.png', {
        type: 'image/png'
      });

      const params: any = {
        image: imageFile,
        prompt: args.prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json'
      };

      if (maskBuffer) {
        params.mask = new File([maskBuffer], 'mask.png', {
          type: 'image/png'
        });
      }

      const response = await this.client.images.edit(params);

      return response.data.map(img =>
        Buffer.from(img.b64_json!, 'base64')
      );
    } catch (error) {
      throw this.handleOpenAIError(error);
    }
  }

  /**
   * Map generic aspect ratio to DALL-E size
   */
  private mapAspectRatio(aspectRatio: string): '1024x1024' | '1792x1024' | '1024x1792' {
    switch (aspectRatio) {
      case '16:9':
        return '1792x1024';
      case '9:16':
        return '1024x1792';
      case '1:1':
      default:
        return '1024x1024';
    }
  }

  /**
   * Read image file
   */
  private async readImageFile(path: string): Promise<Buffer> {
    const fs = await import('fs/promises');
    return await fs.readFile(path);
  }

  /**
   * Handle OpenAI API errors
   */
  private handleOpenAIError(error: unknown): Error {
    if (error instanceof OpenAI.APIError) {
      return new Error(`OpenAI API Error: ${error.message} (${error.status})`);
    }

    return error instanceof Error
      ? error
      : new Error(String(error));
  }

  getModelVersion(): string {
    return 'dall-e-3';
  }
}
```

### Usage Example

```typescript
// In your provider factory (src/providers/base.ts)
import { OpenAIProvider } from './openai.js';

export class ProviderFactory {
  static create(providerName?: string): ImageProvider {
    const provider = providerName || process.env.IMAGE_PROVIDER || 'example';

    switch (provider.toLowerCase()) {
      case 'openai':
      case 'dall-e':
        return new OpenAIProvider();

      // ... other providers
    }
  }
}
```

### Environment Configuration

```bash
IMAGE_PROVIDER=openai
OPENAI_API_KEY=sk-your-actual-api-key-here
IMAGE_OUTPUT_DIR=~/Downloads/ai-images
```

---

## Stable Diffusion Integration

### Complete Provider Implementation

Create `src/providers/stableDiffusion.ts`:

```typescript
import type {
  ImageProvider,
  GenerateImageArgs,
  EditImageArgs,
  CustomizeImageArgs
} from '../types/index.js';

export class StableDiffusionProvider implements ImageProvider {
  name = 'Stable Diffusion';
  private apiUrl: string;

  constructor() {
    this.apiUrl = process.env.SD_API_URL || 'http://localhost:7860';
  }

  supports = {
    generation: true,
    editing: true,
    upscaling: true,
    customization: true,  // ControlNet support
    asyncJobs: false
  };

  limits = {
    maxSampleCount: 100,  // Essentially unlimited
    supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', 'custom'],
    maxResolution: '2048x2048'
  };

  /**
   * Generate images using txt2img
   */
  async generateImage(args: GenerateImageArgs): Promise<Buffer[]> {
    const dims = this.calculateDimensions(args.aspect_ratio || '1:1');

    const response = await fetch(`${this.apiUrl}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: args.prompt,
        negative_prompt: args.negative_prompt || '',
        width: dims.width,
        height: dims.height,
        steps: 20,
        cfg_scale: 7.0,
        sampler_name: 'Euler a',
        batch_size: args.sample_count || 1,
        seed: -1
      })
    });

    if (!response.ok) {
      throw new Error(`SD API error: ${response.statusText}`);
    }

    const data = await response.json();

    return data.images.map((img: string) =>
      Buffer.from(img, 'base64')
    );
  }

  /**
   * Edit images using img2img with inpainting
   */
  async editImage(args: EditImageArgs): Promise<Buffer[]> {
    const imageBase64 = args.reference_image_base64 ||
      await this.fileToBase64(args.reference_image_path!);

    const maskBase64 = args.mask_image_base64 ||
      (args.mask_image_path ? await this.fileToBase64(args.mask_image_path) : undefined);

    const response = await fetch(`${this.apiUrl}/sdapi/v1/img2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        init_images: [imageBase64],
        mask: maskBase64,
        inpaint_full_res: false,
        inpainting_fill: 1,  // original
        prompt: args.prompt,
        negative_prompt: args.negative_prompt || '',
        steps: 20,
        cfg_scale: 7.0,
        denoising_strength: maskBase64 ? 0.75 : 0.5,
        width: 512,
        height: 512
      })
    });

    if (!response.ok) {
      throw new Error(`SD API error: ${response.statusText}`);
    }

    const data = await response.json();

    return data.images.map((img: string) =>
      Buffer.from(img, 'base64')
    );
  }

  /**
   * Upscale image using ESRGAN
   */
  async upscaleImage(buffer: Buffer, scaleFactor: string): Promise<Buffer> {
    const base64 = buffer.toString('base64');

    const response = await fetch(`${this.apiUrl}/sdapi/v1/extra-single-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64,
        upscaling_resize: parseInt(scaleFactor),
        upscaler_1: 'R-ESRGAN 4x+',
        upscaler_2: 'None',
        extras_upscaler_2_visibility: 0
      })
    });

    if (!response.ok) {
      throw new Error(`SD API error: ${response.statusText}`);
    }

    const data = await response.json();

    return Buffer.from(data.image, 'base64');
  }

  /**
   * Generate with ControlNet
   */
  async customizeImage(args: CustomizeImageArgs): Promise<Buffer[]> {
    const dims = this.calculateDimensions(args.aspect_ratio || '1:1');

    // Build ControlNet units
    const controlnetUnits = [];

    if (args.control_image_base64 || args.control_image_path) {
      const controlImage = args.control_image_base64 ||
        await this.fileToBase64(args.control_image_path!);

      controlnetUnits.push({
        input_image: controlImage,
        model: this.mapControlType(args.control_type || 'canny'),
        module: 'auto',
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
        width: dims.width,
        height: dims.height,
        steps: 20,
        cfg_scale: 7.0,
        controlnet_units: controlnetUnits
      })
    });

    if (!response.ok) {
      throw new Error(`SD API error: ${response.statusText}`);
    }

    const data = await response.json();

    return data.images.map((img: string) =>
      Buffer.from(img, 'base64')
    );
  }

  /**
   * Calculate dimensions from aspect ratio
   */
  private calculateDimensions(aspectRatio: string): { width: number; height: number } {
    const baseSize = 512;

    switch (aspectRatio) {
      case '1:1':
        return { width: 512, height: 512 };
      case '16:9':
        return { width: 768, height: 432 };
      case '9:16':
        return { width: 432, height: 768 };
      case '4:3':
        return { width: 640, height: 480 };
      case '3:4':
        return { width: 480, height: 640 };
      default:
        return { width: 512, height: 512 };
    }
  }

  /**
   * Map control type to ControlNet model
   */
  private mapControlType(type: string): string {
    const mapping: Record<string, string> = {
      'canny': 'control_canny',
      'scribble': 'control_scribble',
      'depth': 'control_depth',
      'pose': 'control_openpose'
    };

    return mapping[type] || 'control_canny';
  }

  /**
   * Convert file to base64
   */
  private async fileToBase64(path: string): Promise<string> {
    const fs = await import('fs/promises');
    const buffer = await fs.readFile(path);
    return buffer.toString('base64');
  }

  getModelVersion(): string {
    return 'stable-diffusion-v1-5';  // Or query from API
  }
}
```

### Starting Automatic1111 Web UI

```bash
# Install Automatic1111
git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui
cd stable-diffusion-webui

# Start with API enabled
./webui.sh --api --listen
```

### Environment Configuration

```bash
IMAGE_PROVIDER=stable-diffusion
SD_API_URL=http://localhost:7860
IMAGE_OUTPUT_DIR=~/Downloads/ai-images
```

---

## Database Operations

### Batch Insert with Transaction

```typescript
import type { HistoryDatabase } from './utils/database.js';

async function batchInsert(
  db: HistoryDatabase,
  records: Array<{
    tool_name: string;
    model: string;
    provider: string;
    prompt: string;
    parameters: Record<string, any>;
    output_paths: string[];
  }>
): Promise<string[]> {
  const uuids: string[] = [];

  // Use transaction for better performance
  for (const record of records) {
    const uuid = db.createRecord(record);
    uuids.push(uuid);
  }

  return uuids;
}
```

### Advanced Search with Multiple Filters

```typescript
function advancedSearch(db: HistoryDatabase) {
  // Search with multiple criteria
  const results = db.search({
    query: 'sunset AND landscape',
    limit: 50,
    filters: {
      provider: 'OpenAI DALL-E',
      date_from: '2025-01-01T00:00:00Z',
      date_to: '2025-12-31T23:59:59Z'
    }
  });

  return results;
}
```

### Pagination Helper

```typescript
function paginate<T>(items: T[], page: number, pageSize: number): {
  items: T[];
  totalPages: number;
  currentPage: number;
} {
  const totalPages = Math.ceil(items.length / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: items.slice(start, end),
    totalPages,
    currentPage: page
  };
}

// Usage with history database
const allRecords = historyDb.list({ limit: 1000 });
const page1 = paginate(allRecords, 1, 20);
```

---

## Metadata Embedding

### Full Metadata Embedding

```typescript
import { embedMetadata } from './utils/metadata.js';

async function embedFullMetadata(
  imagePath: string,
  generationData: {
    uuid: string;
    params_hash: string;
    tool_name: string;
    model: string;
    provider: string;
    prompt: string;
    parameters: Record<string, any>;
  }
) {
  await embedMetadata(
    imagePath,
    {
      uuid: generationData.uuid,
      params_hash: generationData.params_hash,
      tool_name: generationData.tool_name,
      model: generationData.model,
      provider: generationData.provider,
      created_at: new Date().toISOString(),
      prompt: generationData.prompt,
      parameters: generationData.parameters
    },
    'full'  // Include all data
  );
}
```

### Extracting and Verifying Metadata

```typescript
import { extractMetadata, verifyIntegrity } from './utils/metadata.js';

async function checkImageIntegrity(
  imagePath: string,
  historyDb: HistoryDatabase
) {
  // Extract metadata from image
  const metadata = await extractMetadata(imagePath);

  if (!metadata) {
    console.log('No metadata found in image');
    return;
  }

  // Get database record
  const dbRecord = historyDb.getByUuid(metadata.uuid);

  if (!dbRecord) {
    console.log('Image UUID not found in database');
    return;
  }

  // Verify integrity
  const verification = await verifyIntegrity(imagePath, {
    uuid: dbRecord.uuid,
    params_hash: dbRecord.params_hash
  });

  if (verification.valid) {
    console.log('✅ Image integrity verified');
  } else {
    console.log(`❌ Integrity check failed: ${verification.details}`);
  }
}
```

---

## Error Handling Patterns

### Retry Logic with Exponential Backoff

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Failed after ${maxRetries} retries: ${lastError!.message}`);
}

// Usage
const result = await withRetry(() =>
  provider.generateImage({ prompt: 'A test image' })
);
```

### Rate Limiting

```typescript
class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private running = 0;

  constructor(
    private maxConcurrent: number,
    private minInterval: number
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    while (this.running >= this.maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.running++;

    try {
      const result = await fn();
      await new Promise(resolve => setTimeout(resolve, this.minInterval));
      return result;
    } finally {
      this.running--;
    }
  }
}

// Usage
const limiter = new RateLimiter(2, 1000);  // 2 concurrent, 1s between calls

const results = await Promise.all([
  limiter.execute(() => provider.generateImage({ prompt: '1' })),
  limiter.execute(() => provider.generateImage({ prompt: '2' })),
  limiter.execute(() => provider.generateImage({ prompt: '3' }))
]);
```

---

## Testing Strategies

### Mocking Providers for Tests

```typescript
// tests/mocks/mockProvider.ts
import type { ImageProvider } from '../../src/types/index.js';

export class MockProvider implements ImageProvider {
  name = 'Mock Provider';

  supports = {
    generation: true,
    editing: true,
    upscaling: true,
    customization: true,
    asyncJobs: false
  };

  limits = {
    maxSampleCount: 10,
    supportedAspectRatios: ['1:1', '16:9', '9:16'],
    maxResolution: '1024x1024'
  };

  // Track calls for assertions
  calls: any[] = [];

  async generateImage(args: any): Promise<Buffer[]> {
    this.calls.push({ method: 'generateImage', args });

    // Return minimal valid image buffer
    return [Buffer.from('fake-image-data')];
  }

  async editImage(args: any): Promise<Buffer[]> {
    this.calls.push({ method: 'editImage', args });
    return [Buffer.from('fake-edited-image')];
  }

  async upscaleImage(buffer: Buffer, scaleFactor: string): Promise<Buffer> {
    this.calls.push({ method: 'upscaleImage', scaleFactor });
    return Buffer.from('fake-upscaled-image');
  }

  async customizeImage(args: any): Promise<Buffer[]> {
    this.calls.push({ method: 'customizeImage', args });
    return [Buffer.from('fake-customized-image')];
  }

  getModelVersion(): string {
    return 'mock-v1.0';
  }

  reset(): void {
    this.calls = [];
  }
}
```

### Integration Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { MockProvider } from './mocks/mockProvider.js';
import { generateImage } from '../src/tools/generateImage.js';

describe('Integration: generateImage', () => {
  it('should call provider and save to history', async () => {
    const mockProvider = new MockProvider();
    const mockHistoryDb = {
      createRecord: vi.fn().mockReturnValue('test-uuid-123'),
      calculateHash: vi.fn().mockReturnValue('test-hash')
    };

    const context = {
      provider: mockProvider,
      historyManager: mockHistoryDb,
      resourceManager: {} as any
    };

    const result = await generateImage(context, {
      prompt: 'Integration test'
    });

    // Verify provider was called
    expect(mockProvider.calls).toHaveLength(1);
    expect(mockProvider.calls[0].args.prompt).toBe('Integration test');

    // Verify history was saved
    expect(mockHistoryDb.createRecord).toHaveBeenCalled();

    // Verify response format
    expect(result.content).toBeDefined();
  });
});
```

---

## Related Documentation / 関連ドキュメント

- [FEATURES_SPECIFICATION.md](./FEATURES_SPECIFICATION.md) - Complete specifications
- [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) - Step-by-step guide
- [HISTORY_GUIDE.md](./HISTORY_GUIDE.md) - History management details
- [starter-templates/](./starter-templates/) - Ready-to-use template

---

**Last Updated**: 2025-10-15
**License**: MIT
