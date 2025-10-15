/**
 * Provider Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderFactory, validateProviderConfig } from '../src/providers/base.js';

describe('ProviderFactory', () => {
  it('should create example provider', () => {
    const provider = ProviderFactory.create('example');

    expect(provider).toBeDefined();
    expect(provider.name).toBe('Example Provider');
  });

  it('should list available providers', () => {
    const providers = ProviderFactory.list Providers();

    expect(providers).toContain('example');
    expect(providers).toContain('openai');
    expect(providers).toContain('stable-diffusion');
  });

  it('should throw error for unknown provider', () => {
    expect(() => {
      ProviderFactory.create('unknown');
    }).toThrow('Unknown provider');
  });
});

describe('Provider Capabilities', () => {
  it('should have correct capabilities for example provider', () => {
    const provider = ProviderFactory.create('example');

    expect(provider.supports.generation).toBe(true);
    expect(provider.limits.maxSampleCount).toBeGreaterThan(0);
    expect(provider.limits.supportedAspectRatios).toContain('1:1');
  });
});

describe('validateProviderConfig', () => {
  beforeEach(() => {
    // Clear environment variables
    delete process.env.OPENAI_API_KEY;
    delete process.env.SD_API_URL;
  });

  it('should validate example provider without config', () => {
    const result = validateProviderConfig('example');

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject OpenAI without API key', () => {
    const result = validateProviderConfig('openai');

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('OPENAI_API_KEY environment variable is required');
  });

  it('should accept OpenAI with API key', () => {
    process.env.OPENAI_API_KEY = 'sk-test';

    const result = validateProviderConfig('openai');

    expect(result.valid).toBe(true);
  });
});

describe('Example Provider Implementation', () => {
  it('should generate placeholder image', async () => {
    const provider = ProviderFactory.create('example');

    const result = await provider.generateImage({
      prompt: 'A test image'
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(Buffer);
    expect(result[0].length).toBeGreaterThan(0);
  });

  it('should generate multiple images', async () => {
    const provider = ProviderFactory.create('example');

    const result = await provider.generateImage({
      prompt: 'Test images',
      sample_count: 3
    });

    expect(result).toHaveLength(3);
    result.forEach(buffer => {
      expect(buffer).toBeInstanceOf(Buffer);
    });
  });

  it('should respect aspect ratio', async () => {
    const provider = ProviderFactory.create('example');

    const result = await provider.generateImage({
      prompt: 'Wide image',
      aspect_ratio: '16:9'
    });

    expect(result).toHaveLength(1);
    // Note: actual dimension checking would require parsing the image
  });
});
