import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { getDefaultOutputDirectory, normalizeAndValidatePath, getDisplayPath } from './path.js';

describe('Path Utilities', () => {
  const originalEnv = process.env.VERTEXAI_IMAGEN_OUTPUT_DIR;

  beforeEach(() => {
    // Reset environment variable before each test
    delete process.env.VERTEXAI_IMAGEN_OUTPUT_DIR;
  });

  afterEach(() => {
    // Restore original environment variable
    if (originalEnv) {
      process.env.VERTEXAI_IMAGEN_OUTPUT_DIR = originalEnv;
    } else {
      delete process.env.VERTEXAI_IMAGEN_OUTPUT_DIR;
    }
  });

  describe('getDefaultOutputDirectory', () => {
    it('should return default Downloads directory when environment variable is not set', () => {
      const result = getDefaultOutputDirectory();
      const homeDir = os.homedir();
      const expected = path.join(homeDir, 'Downloads', 'vertexai-imagen-files');
      expect(result).toBe(expected);
    });

    it('should return environment variable path when set', () => {
      const customPath = '/custom/output/path';
      process.env.VERTEXAI_IMAGEN_OUTPUT_DIR = customPath;

      const result = getDefaultOutputDirectory();
      expect(result).toBe(path.resolve(customPath));
    });

    it('should resolve relative environment variable paths to absolute', () => {
      process.env.VERTEXAI_IMAGEN_OUTPUT_DIR = 'relative/path';

      const result = getDefaultOutputDirectory();
      expect(path.isAbsolute(result)).toBe(true);
    });
  });

  describe('normalizeAndValidatePath', () => {
    it('should keep absolute paths as-is', async () => {
      const absolutePath = path.join(os.tmpdir(), 'test-image.png');
      const result = await normalizeAndValidatePath(absolutePath);
      expect(result).toBe(absolutePath);
    });

    it('should resolve relative paths from default directory', async () => {
      const relativePath = 'test-image.png';
      const result = await normalizeAndValidatePath(relativePath);

      const homeDir = os.homedir();
      const expected = path.join(homeDir, 'Downloads', 'vertexai-imagen-files', relativePath);
      expect(result).toBe(expected);
    });

    it('should create parent directories if they do not exist', async () => {
      const testDir = path.join(os.tmpdir(), 'vertexai-test-' + Date.now(), 'nested', 'dir');
      const testFile = path.join(testDir, 'test.png');

      const result = await normalizeAndValidatePath(testFile);
      expect(result).toBe(testFile);

      // Verify directory was created
      const dirExists = await fs.stat(testDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);

      // Cleanup
      await fs.rm(path.join(os.tmpdir(), path.basename(path.dirname(path.dirname(testDir)))), { recursive: true, force: true });
    });

    it('should handle paths with subdirectories', async () => {
      const relativePath = 'animals/cats/image.png';
      const result = await normalizeAndValidatePath(relativePath);

      const homeDir = os.homedir();
      const expected = path.join(homeDir, 'Downloads', 'vertexai-imagen-files', relativePath);
      expect(result).toBe(expected);
    });

    it('should throw error if directory creation fails', async () => {
      // Try to create a file in a location that should fail (e.g., root without permissions)
      // This test may behave differently based on OS and permissions
      const invalidPath = path.join('/root', 'definitely-not-allowed', 'test.png');

      // Skip this test on Windows as it has different permission model
      if (os.platform() === 'win32') {
        return;
      }

      await expect(normalizeAndValidatePath(invalidPath)).rejects.toThrow();
    });
  });

  describe('getDisplayPath', () => {
    it('should convert home directory path to ~ notation', () => {
      const homeDir = os.homedir();
      const testPath = path.join(homeDir, 'Documents', 'image.png');

      const result = getDisplayPath(testPath);
      expect(result).toBe(path.join('~', 'Documents', 'image.png'));
    });

    it('should keep non-home paths unchanged', () => {
      const testPath = '/tmp/image.png';

      const result = getDisplayPath(testPath);
      expect(result).toBe(testPath);
    });

    it('should handle paths that partially match home directory', () => {
      const homeDir = os.homedir();
      const testPath = homeDir + '-other/image.png';

      const result = getDisplayPath(testPath);
      expect(result).toBe(testPath);
    });
  });

  describe('Integration tests', () => {
    it('should work end-to-end: relative path -> normalize -> display', async () => {
      const inputPath = 'my-images/test.png';
      const normalizedPath = await normalizeAndValidatePath(inputPath);
      const displayPath = getDisplayPath(normalizedPath);

      expect(displayPath).toContain('~');
      expect(displayPath).toContain('vertexai-imagen-files');
      expect(displayPath).toContain('my-images/test.png');
    });

    it('should respect custom output directory from environment', async () => {
      const customDir = path.join(os.tmpdir(), 'custom-output-' + Date.now());
      process.env.VERTEXAI_IMAGEN_OUTPUT_DIR = customDir;

      const relativePath = 'test.png';
      const result = await normalizeAndValidatePath(relativePath);

      expect(result).toBe(path.join(customDir, relativePath));

      // Cleanup
      await fs.rm(customDir, { recursive: true, force: true }).catch(() => {});
    });
  });
});
