/**
 * Integration Tests
 *
 * Tests the full workflow from image generation to history retrieval
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { unlinkSync } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ProviderFactory } from '../src/providers/base.js';
import { HistoryDatabase } from '../src/utils/database.js';
import { ResourceManager } from '../src/utils/resources.js';
import { generateImage } from '../src/tools/generateImage.js';

const TEST_OUTPUT_DIR = join(tmpdir(), 'image-gen-test');
const TEST_DB_PATH = join(TEST_OUTPUT_DIR, 'test.db');

describe('Integration Tests', () => {
  let provider: any;
  let historyDb: HistoryDatabase;
  let resourceManager: ResourceManager;

  beforeAll(async () => {
    // Setup test environment
    await mkdir(TEST_OUTPUT_DIR, { recursive: true });

    provider = ProviderFactory.create('example');
    historyDb = new HistoryDatabase(TEST_DB_PATH);
    resourceManager = new ResourceManager(TEST_OUTPUT_DIR);

    // Set environment variables
    process.env.IMAGE_OUTPUT_DIR = TEST_OUTPUT_DIR;
    process.env.EMBED_METADATA = 'false';  // Disable for faster tests
    process.env.THUMBNAIL_ENABLED = 'true';
  });

  afterAll(() => {
    historyDb.close();

    // Cleanup
    try {
      unlinkSync(TEST_DB_PATH);
      unlinkSync(TEST_DB_PATH + '-shm');
      unlinkSync(TEST_DB_PATH + '-wal');
    } catch {}
  });

  describe('Full Workflow', () => {
    it('should generate image and create history record', async () => {
      const context = {
        provider,
        historyManager: historyDb,
        resourceManager
      };

      const result = await generateImage(context, {
        prompt: 'A test image for integration test',
        aspect_ratio: '1:1',
        sample_count: 1
      });

      // Check response
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);

      // First content should be text with UUID
      const textContent = result.content.find(c => c.type === 'text');
      expect(textContent).toBeDefined();
      expect(textContent?.text).toContain('UUID:');

      // Should have thumbnail
      const imageContent = result.content.find(c => c.type === 'image');
      expect(imageContent).toBeDefined();
    });

    it('should retrieve generated image from history', async () => {
      // Generate an image
      const context = {
        provider,
        historyManager: historyDb,
        resourceManager
      };

      await generateImage(context, {
        prompt: 'Another test image',
        aspect_ratio: '16:9'
      });

      // List history
      const records = historyDb.list({ limit: 10 });

      expect(records.length).toBeGreaterThan(0);

      // Find our record
      const record = records.find(r => r.prompt.includes('Another test'));
      expect(record).toBeDefined();
      expect(record?.aspect_ratio).toBe('16:9');
      expect(record?.provider).toBe('Example Provider');
    });

    it('should search history by keywords', async () => {
      // Generate images with specific keywords
      const context = {
        provider,
        historyManager: historyDb,
        resourceManager
      };

      await generateImage(context, {
        prompt: 'A beautiful sunset landscape'
      });

      await generateImage(context, {
        prompt: 'A portrait of a developer'
      });

      // Search for "sunset"
      const results = historyDb.search({ query: 'sunset' });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].prompt).toContain('sunset');
    });

    it('should list resources', async () => {
      const resources = await resourceManager.listResources();

      expect(resources.length).toBeGreaterThan(0);

      // Check resource structure
      const resource = resources[0];
      expect(resource.uri).toMatch(/^file:\/\//);
      expect(resource.name).toBeDefined();
      expect(resource.mimeType).toMatch(/^image\//);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid arguments', async () => {
      const context = {
        provider,
        historyManager: historyDb,
        resourceManager
      };

      // Missing required prompt
      const result = await generateImage(context, {} as any);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error');
    });

    it('should handle provider errors gracefully', async () => {
      // Create a mock provider that throws
      const errorProvider = {
        ...provider,
        generateImage: async () => {
          throw new Error('Provider error');
        }
      };

      const context = {
        provider: errorProvider,
        historyManager: historyDb,
        resourceManager
      };

      const result = await generateImage(context, {
        prompt: 'This will fail'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Provider error');
    });
  });

  describe('Multiple Generations', () => {
    it('should handle batch generation', async () => {
      const context = {
        provider,
        historyManager: historyDb,
        resourceManager
      };

      const result = await generateImage(context, {
        prompt: 'Batch test',
        sample_count: 3
      });

      // Should have thumbnails for all images
      const images = result.content.filter(c => c.type === 'image');
      expect(images).toHaveLength(3);
    });

    it('should track all generations in history', async () => {
      const initialCount = historyDb.getStats().recordCount;

      const context = {
        provider,
        historyManager: historyDb,
        resourceManager
      };

      // Generate multiple images
      await generateImage(context, { prompt: 'Test 1' });
      await generateImage(context, { prompt: 'Test 2' });
      await generateImage(context, { prompt: 'Test 3' });

      const finalCount = historyDb.getStats().recordCount;

      expect(finalCount).toBe(initialCount + 3);
    });
  });
});
