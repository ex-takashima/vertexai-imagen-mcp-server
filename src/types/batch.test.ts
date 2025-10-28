/**
 * バッチ処理型定義のテスト
 */

import { describe, it, expect } from 'vitest';
import { batchJobItemToGenerateImageArgs } from './batch.js';
import type { BatchJobItem } from './batch.js';

describe('batchJobItemToGenerateImageArgs', () => {
  it('should convert basic batch job item to GenerateImageArgs', () => {
    const item: BatchJobItem = {
      prompt: 'A beautiful sunset',
      output_filename: 'sunset.png',
    };

    const result = batchJobItemToGenerateImageArgs(item, '/output');

    expect(result).toEqual({
      prompt: 'A beautiful sunset',
      output_path: '/output/sunset.png',
      aspect_ratio: undefined,
      safety_level: undefined,
      person_generation: undefined,
      language: undefined,
      model: undefined,
      region: undefined,
      sample_count: undefined,
      sample_image_size: undefined,
      include_thumbnail: undefined,
      return_base64: false,
    });
  });

  it('should convert batch job item with all options', () => {
    const item: BatchJobItem = {
      prompt: 'A futuristic city',
      output_filename: 'city.png',
      aspect_ratio: '16:9',
      safety_level: 'BLOCK_MEDIUM_AND_ABOVE',
      person_generation: 'ALLOW_ADULT',
      language: 'en',
      model: 'imagen-3.0-generate-002',
      region: 'us-central1',
      sample_count: 1,
      sample_image_size: '1K',
      include_thumbnail: true,
    };

    const result = batchJobItemToGenerateImageArgs(item, '/output');

    expect(result).toEqual({
      prompt: 'A futuristic city',
      output_path: '/output/city.png',
      aspect_ratio: '16:9',
      safety_level: 'BLOCK_MEDIUM_AND_ABOVE',
      person_generation: 'ALLOW_ADULT',
      language: 'en',
      model: 'imagen-3.0-generate-002',
      region: 'us-central1',
      sample_count: 1,
      sample_image_size: '1K',
      include_thumbnail: true,
      return_base64: false,
    });
  });

  it('should handle item without output_filename', () => {
    const item: BatchJobItem = {
      prompt: 'A beautiful landscape',
    };

    const result = batchJobItemToGenerateImageArgs(item, '/output');

    expect(result.prompt).toBe('A beautiful landscape');
    expect(result.output_path).toBeUndefined();
    expect(result.return_base64).toBe(false);
  });

  it('should handle various aspect ratios', () => {
    const aspectRatios: Array<BatchJobItem['aspect_ratio']> = [
      '1:1', '3:4', '4:3', '9:16', '16:9'
    ];

    for (const aspect_ratio of aspectRatios) {
      const item: BatchJobItem = {
        prompt: 'Test',
        aspect_ratio,
      };

      const result = batchJobItemToGenerateImageArgs(item, '/output');
      expect(result.aspect_ratio).toBe(aspect_ratio);
    }
  });

  it('should handle various safety levels', () => {
    const safetyLevels: Array<BatchJobItem['safety_level']> = [
      'BLOCK_NONE',
      'BLOCK_ONLY_HIGH',
      'BLOCK_MEDIUM_AND_ABOVE',
      'BLOCK_LOW_AND_ABOVE'
    ];

    for (const safety_level of safetyLevels) {
      const item: BatchJobItem = {
        prompt: 'Test',
        safety_level,
      };

      const result = batchJobItemToGenerateImageArgs(item, '/output');
      expect(result.safety_level).toBe(safety_level);
    }
  });

  it('should handle various person generation policies', () => {
    const policies: Array<BatchJobItem['person_generation']> = [
      'DONT_ALLOW',
      'ALLOW_ADULT',
      'ALLOW_ALL'
    ];

    for (const person_generation of policies) {
      const item: BatchJobItem = {
        prompt: 'Test',
        person_generation,
      };

      const result = batchJobItemToGenerateImageArgs(item, '/output');
      expect(result.person_generation).toBe(person_generation);
    }
  });

  it('should handle various languages', () => {
    const languages: Array<BatchJobItem['language']> = [
      'auto', 'en', 'zh', 'zh-TW', 'hi', 'ja', 'ko', 'pt', 'es'
    ];

    for (const language of languages) {
      const item: BatchJobItem = {
        prompt: 'Test',
        language,
      };

      const result = batchJobItemToGenerateImageArgs(item, '/output');
      expect(result.language).toBe(language);
    }
  });

  it('should handle various models', () => {
    const models: Array<BatchJobItem['model']> = [
      'imagen-4.0-ultra-generate-001',
      'imagen-4.0-fast-generate-001',
      'imagen-4.0-generate-001',
      'imagen-3.0-generate-002',
      'imagen-3.0-fast-generate-001'
    ];

    for (const model of models) {
      const item: BatchJobItem = {
        prompt: 'Test',
        model,
      };

      const result = batchJobItemToGenerateImageArgs(item, '/output');
      expect(result.model).toBe(model);
    }
  });
});
