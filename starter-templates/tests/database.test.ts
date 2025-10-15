/**
 * Database Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlinkSync } from 'fs';
import { HistoryDatabase } from '../src/utils/database.js';

const TEST_DB_PATH = './test-history.db';

describe('HistoryDatabase', () => {
  let db: HistoryDatabase;

  beforeEach(() => {
    // Clean up any existing test database
    try {
      unlinkSync(TEST_DB_PATH);
    } catch {}

    db = new HistoryDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();

    try {
      unlinkSync(TEST_DB_PATH);
      unlinkSync(TEST_DB_PATH + '-shm');
      unlinkSync(TEST_DB_PATH + '-wal');
    } catch {}
  });

  describe('createRecord', () => {
    it('should create a new history record', () => {
      const uuid = db.createRecord({
        tool_name: 'generate_image',
        model: 'test-model',
        provider: 'test-provider',
        prompt: 'A beautiful sunset',
        parameters: { prompt: 'A beautiful sunset' },
        output_paths: ['/path/to/image.png'],
        aspect_ratio: '16:9'
      });

      expect(uuid).toBeDefined();
      expect(typeof uuid).toBe('string');
      expect(uuid.length).toBeGreaterThan(0);
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = db.createRecord({
        tool_name: 'generate_image',
        model: 'test',
        provider: 'test',
        prompt: 'Test 1',
        parameters: {},
        output_paths: []
      });

      const uuid2 = db.createRecord({
        tool_name: 'generate_image',
        model: 'test',
        provider: 'test',
        prompt: 'Test 2',
        parameters: {},
        output_paths: []
      });

      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('getByUuid', () => {
    it('should retrieve record by UUID', () => {
      const uuid = db.createRecord({
        tool_name: 'generate_image',
        model: 'test-model',
        provider: 'test-provider',
        prompt: 'Test prompt',
        parameters: { test: 'data' },
        output_paths: ['/test.png']
      });

      const record = db.getByUuid(uuid);

      expect(record).toBeDefined();
      expect(record?.uuid).toBe(uuid);
      expect(record?.prompt).toBe('Test prompt');
      expect(record?.tool_name).toBe('generate_image');
      expect(record?.parameters).toEqual({ test: 'data' });
    });

    it('should return null for non-existent UUID', () => {
      const record = db.getByUuid('non-existent-uuid');

      expect(record).toBeNull();
    });
  });

  describe('list', () => {
    beforeEach(() => {
      // Insert test data
      for (let i = 0; i < 10; i++) {
        db.createRecord({
          tool_name: i % 2 === 0 ? 'generate_image' : 'edit_image',
          model: `model-${i % 3}`,
          provider: 'test-provider',
          prompt: `Test prompt ${i}`,
          parameters: { index: i },
          output_paths: [`/test-${i}.png`],
          aspect_ratio: i % 2 === 0 ? '16:9' : '1:1'
        });
      }
    });

    it('should list all records', () => {
      const records = db.list({});

      expect(records).toHaveLength(10);
    });

    it('should apply limit', () => {
      const records = db.list({ limit: 5 });

      expect(records).toHaveLength(5);
    });

    it('should filter by tool_name', () => {
      const records = db.list({
        filters: { tool_name: 'generate_image' }
      });

      expect(records).toHaveLength(5);
      records.forEach(r => {
        expect(r.tool_name).toBe('generate_image');
      });
    });

    it('should filter by aspect_ratio', () => {
      const records = db.list({
        filters: { aspect_ratio: '16:9' }
      });

      expect(records).toHaveLength(5);
      records.forEach(r => {
        expect(r.aspect_ratio).toBe('16:9');
      });
    });

    it('should sort by created_at descending', () => {
      const records = db.list({
        sort_by: 'created_at',
        sort_order: 'desc'
      });

      expect(records).toHaveLength(10);
      // Verify descending order
      for (let i = 0; i < records.length - 1; i++) {
        expect(new Date(records[i].created_at).getTime())
          .toBeGreaterThanOrEqual(new Date(records[i + 1].created_at).getTime());
      }
    });

    it('should apply offset for pagination', () => {
      const page1 = db.list({ limit: 5, offset: 0 });
      const page2 = db.list({ limit: 5, offset: 5 });

      expect(page1).toHaveLength(5);
      expect(page2).toHaveLength(5);
      expect(page1[0].uuid).not.toBe(page2[0].uuid);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      db.createRecord({
        tool_name: 'generate_image',
        model: 'test',
        provider: 'test',
        prompt: 'A beautiful sunset over mountains',
        parameters: {},
        output_paths: []
      });

      db.createRecord({
        tool_name: 'generate_image',
        model: 'test',
        provider: 'test',
        prompt: 'A portrait of a person',
        parameters: {},
        output_paths: []
      });

      db.createRecord({
        tool_name: 'generate_image',
        model: 'test',
        provider: 'test',
        prompt: 'Mountains in the distance',
        parameters: {},
        output_paths: []
      });
    });

    it('should find records by keyword', () => {
      const results = db.search({ query: 'mountains' });

      expect(results.length).toBeGreaterThan(0);
      results.forEach(r => {
        expect(r.prompt.toLowerCase()).toContain('mountain');
      });
    });

    it('should find records by phrase', () => {
      const results = db.search({ query: '"beautiful sunset"' });

      expect(results.length).toBeGreaterThan(0);
      results.forEach(r => {
        expect(r.prompt.toLowerCase()).toContain('beautiful sunset');
      });
    });

    it('should return empty array for no matches', () => {
      const results = db.search({ query: 'nonexistent' });

      expect(results).toHaveLength(0);
    });

    it('should apply limit to search results', () => {
      const results = db.search({ query: 'mountains', limit: 1 });

      expect(results).toHaveLength(1);
    });
  });

  describe('getStats', () => {
    it('should return database statistics', () => {
      // Insert some records
      for (let i = 0; i < 5; i++) {
        db.createRecord({
          tool_name: 'test',
          model: 'test',
          provider: 'test',
          prompt: `Test ${i}`,
          parameters: {},
          output_paths: []
        });
      }

      const stats = db.getStats();

      expect(stats.recordCount).toBe(5);
      expect(stats.dbPath).toBe(TEST_DB_PATH);
    });
  });
});
