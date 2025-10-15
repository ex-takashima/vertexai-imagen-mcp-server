/**
 * Provider Factory and Base Implementation
 *
 * This file provides the factory pattern for creating image generation providers.
 * Add your custom providers here.
 */

import type { ImageProvider } from '../types/index.js';

/**
 * Provider Factory
 * Handles creation and management of image generation providers
 */
export class ProviderFactory {
  /**
   * Create a provider instance based on environment variable or parameter
   */
  static create(providerName?: string): ImageProvider {
    const provider = providerName || process.env.IMAGE_PROVIDER || 'example';

    switch (provider.toLowerCase()) {
      case 'example':
      case 'demo':
        return ProviderFactory.createExampleProvider();

      // Uncomment and implement when you add OpenAI support
      // case 'openai':
      // case 'dall-e':
      //   const { OpenAIProvider } = await import('./openai.js');
      //   return new OpenAIProvider();

      // Uncomment and implement when you add Stable Diffusion support
      // case 'stable-diffusion':
      // case 'sd':
      //   const { StableDiffusionProvider } = await import('./stableDiffusion.js');
      //   return new StableDiffusionProvider();

      default:
        throw new Error(
          `Unknown provider: ${provider}. ` +
          `Available providers: example, openai, stable-diffusion`
        );
    }
  }

  /**
   * List all available providers
   */
  static listProviders(): string[] {
    return ['example', 'openai', 'stable-diffusion'];
  }

  /**
   * Get capabilities of a provider without instantiating it
   */
  static async getProviderCapabilities(providerName: string) {
    const provider = ProviderFactory.create(providerName);
    return provider.supports;
  }

  /**
   * Create an example/demo provider for testing
   */
  private static createExampleProvider(): ImageProvider {
    return new ExampleProvider();
  }
}

/**
 * Example Provider Implementation
 * Replace this with your actual provider (OpenAI, Stable Diffusion, etc.)
 */
class ExampleProvider implements ImageProvider {
  name = 'Example Provider';

  supports = {
    generation: true,
    editing: false,
    upscaling: false,
    customization: false,
    asyncJobs: false
  };

  limits = {
    maxSampleCount: 4,
    supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    maxResolution: '1024x1024'
  };

  async generateImage(args: any): Promise<Buffer[]> {
    // This is a placeholder implementation
    // Replace with actual API calls to your provider

    console.log('Generating image with prompt:', args.prompt);

    // For demo: create a simple colored square
    const sharp = await import('sharp');

    const width = 512;
    const height = 512;

    // Create a gradient image
    const svg = `
      <svg width="${width}" height="${height}">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:rgb(255,100,100);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgb(100,100,255);stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#grad1)" />
        <text x="50%" y="50%" text-anchor="middle" font-family="Arial" font-size="20" fill="white">
          Example Image
        </text>
      </svg>
    `;

    const buffer = await sharp.default(Buffer.from(svg))
      .png()
      .toBuffer();

    return [buffer];
  }

  getModelVersion(): string {
    return 'example-v1.0';
  }
}

/**
 * Validate provider configuration
 */
export function validateProviderConfig(provider: string): {valid: boolean, errors: string[]} {
  const errors: string[] = [];

  switch (provider.toLowerCase()) {
    case 'openai':
      if (!process.env.OPENAI_API_KEY) {
        errors.push('OPENAI_API_KEY environment variable is required');
      }
      break;

    case 'stable-diffusion':
      if (!process.env.SD_API_URL) {
        errors.push('SD_API_URL environment variable is required');
      }
      break;

    case 'example':
      // No config required
      break;

    default:
      errors.push(`Unknown provider: ${provider}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
