/**
 * バッチ処理のテスト
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, rm, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { BatchProcessor } from './batch.js';

describe('BatchProcessor', () => {
  let tempDir: string;
  let batchProcessor: BatchProcessor;

  beforeEach(async () => {
    // テスト用の一時ディレクトリを作成
    tempDir = join(tmpdir(), `batch-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    // モックのJobManagerとJobDatabaseを作成
    const mockJobManager = {
      createJob: () => 'test-job-id',
      cancelJob: () => true,
      destroy: () => {},
    } as any;

    const mockJobDatabase = {
      getJob: () => null,
      close: () => {},
    } as any;

    batchProcessor = new BatchProcessor(
      mockJobManager,
      mockJobDatabase,
      tempDir
    );
  });

  afterEach(async () => {
    // テスト用ディレクトリをクリーンアップ
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('loadBatchConfig', () => {
    it('should load valid batch config from JSON file', async () => {
      const configPath = join(tempDir, 'batch.json');
      const config = {
        jobs: [
          {
            prompt: 'A beautiful sunset',
            output_filename: 'sunset.png',
          },
          {
            prompt: 'A futuristic city',
            output_filename: 'city.png',
            aspect_ratio: '16:9',
          },
        ],
      };

      await writeFile(configPath, JSON.stringify(config, null, 2));

      const result = await batchProcessor.loadBatchConfig(configPath);

      expect(result).toEqual(config);
      expect(result.jobs).toHaveLength(2);
      expect(result.jobs[0].prompt).toBe('A beautiful sunset');
      expect(result.jobs[1].aspect_ratio).toBe('16:9');
    });

    it('should throw error for invalid JSON', async () => {
      const configPath = join(tempDir, 'invalid.json');
      await writeFile(configPath, '{ invalid json }');

      await expect(batchProcessor.loadBatchConfig(configPath)).rejects.toThrow();
    });

    it('should throw error for missing jobs array', async () => {
      const configPath = join(tempDir, 'no-jobs.json');
      const config = {
        output_dir: './output',
      };

      await writeFile(configPath, JSON.stringify(config));

      await expect(batchProcessor.loadBatchConfig(configPath)).rejects.toThrow(
        'Invalid batch config: "jobs" array is required'
      );
    });

    it('should throw error for empty jobs array', async () => {
      const configPath = join(tempDir, 'empty-jobs.json');
      const config = {
        jobs: [],
      };

      await writeFile(configPath, JSON.stringify(config));

      await expect(batchProcessor.loadBatchConfig(configPath)).rejects.toThrow(
        'Invalid batch config: "jobs" array is required and must not be empty'
      );
    });

    it('should throw error for job without prompt', async () => {
      const configPath = join(tempDir, 'no-prompt.json');
      const config = {
        jobs: [
          {
            output_filename: 'test.png',
          },
        ],
      };

      await writeFile(configPath, JSON.stringify(config));

      await expect(batchProcessor.loadBatchConfig(configPath)).rejects.toThrow(
        'jobs[0].prompt is required'
      );
    });

    it('should throw error for invalid prompt type', async () => {
      const configPath = join(tempDir, 'invalid-prompt.json');
      const config = {
        jobs: [
          {
            prompt: 123, // Should be string
          },
        ],
      };

      await writeFile(configPath, JSON.stringify(config));

      await expect(batchProcessor.loadBatchConfig(configPath)).rejects.toThrow(
        'jobs[0].prompt is required and must be a string'
      );
    });

    it('should load config with optional fields', async () => {
      const configPath = join(tempDir, 'full-config.json');
      const config = {
        jobs: [
          {
            prompt: 'Test',
            output_filename: 'test.png',
            aspect_ratio: '1:1',
            safety_level: 'BLOCK_MEDIUM_AND_ABOVE',
            person_generation: 'ALLOW_ADULT',
            language: 'en',
            model: 'imagen-3.0-generate-002',
            region: 'us-central1',
            sample_count: 1,
            sample_image_size: '1K',
            include_thumbnail: true,
          },
        ],
        output_dir: './custom-output',
        max_concurrent: 4,
        timeout: 900000,
      };

      await writeFile(configPath, JSON.stringify(config));

      const result = await batchProcessor.loadBatchConfig(configPath);

      expect(result.jobs[0].aspect_ratio).toBe('1:1');
      expect(result.jobs[0].safety_level).toBe('BLOCK_MEDIUM_AND_ABOVE');
      expect(result.output_dir).toBe('./custom-output');
      expect(result.max_concurrent).toBe(4);
      expect(result.timeout).toBe(900000);
    });

    it('should load config with multiple jobs', async () => {
      const configPath = join(tempDir, 'multiple-jobs.json');
      const config = {
        jobs: [
          { prompt: 'Prompt 1' },
          { prompt: 'Prompt 2' },
          { prompt: 'Prompt 3' },
          { prompt: 'Prompt 4' },
          { prompt: 'Prompt 5' },
        ],
      };

      await writeFile(configPath, JSON.stringify(config));

      const result = await batchProcessor.loadBatchConfig(configPath);

      expect(result.jobs).toHaveLength(5);
      expect(result.jobs[2].prompt).toBe('Prompt 3');
    });
  });

  describe('formatResultAsJson', () => {
    it('should format result as JSON string', () => {
      const result = {
        total: 2,
        succeeded: 1,
        failed: 1,
        results: [
          {
            job_id: 'job-1',
            prompt: 'Test 1',
            status: 'completed' as const,
            output_path: '/output/test1.png',
          },
          {
            job_id: 'job-2',
            prompt: 'Test 2',
            status: 'failed' as const,
            error: 'API error',
          },
        ],
        started_at: '2025-01-01T00:00:00Z',
        finished_at: '2025-01-01T00:05:00Z',
        total_duration_ms: 300000,
      };

      const json = batchProcessor.formatResultAsJson(result);
      const parsed = JSON.parse(json);

      expect(parsed.total).toBe(2);
      expect(parsed.succeeded).toBe(1);
      expect(parsed.failed).toBe(1);
      expect(parsed.results).toHaveLength(2);
    });
  });

  describe('formatResultAsText', () => {
    it('should format result as human-readable text', () => {
      const result = {
        total: 2,
        succeeded: 1,
        failed: 1,
        results: [
          {
            job_id: 'job-1',
            prompt: 'Test 1',
            status: 'completed' as const,
            output_path: '/output/test1.png',
            duration_ms: 5000,
          },
          {
            job_id: 'job-2',
            prompt: 'Test 2',
            status: 'failed' as const,
            error: 'API error',
            duration_ms: 2000,
          },
        ],
        started_at: '2025-01-01T00:00:00Z',
        finished_at: '2025-01-01T00:05:00Z',
        total_duration_ms: 300000,
      };

      const text = batchProcessor.formatResultAsText(result);

      expect(text).toContain('Total Jobs: 2');
      expect(text).toContain('Succeeded: 1');
      expect(text).toContain('Failed: 1');
      expect(text).toContain('Duration: 300000ms');
      expect(text).toContain('COMPLETED');
      expect(text).toContain('FAILED');
      expect(text).toContain('Test 1');
      expect(text).toContain('Test 2');
      expect(text).toContain('/output/test1.png');
      expect(text).toContain('API error');
    });
  });
});
