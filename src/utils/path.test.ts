import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { getDefaultOutputDirectory, normalizeAndValidatePath, getDisplayPath, validatePathWithinBase, resolveInputPath } from './path.js';

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
    it('should accept absolute paths within base directory', async () => {
      const defaultDir = getDefaultOutputDirectory();
      const absolutePath = path.join(defaultDir, 'test-image.png');
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
      const defaultDir = getDefaultOutputDirectory();
      const testDir = path.join(defaultDir, 'vertexai-test-' + Date.now(), 'nested', 'dir');
      const testFile = path.join(testDir, 'test.png');

      const result = await normalizeAndValidatePath(testFile);
      expect(result).toBe(testFile);

      // Verify directory was created
      const dirExists = await fs.stat(testDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);

      // Cleanup
      await fs.rm(path.join(defaultDir, path.basename(path.dirname(path.dirname(testDir)))), { recursive: true, force: true });
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
      // Note: Current implementation uses startsWith which will match paths
      // that start with homedir even if they're not actually within it
      // This is a known limitation but not related to security changes
      expect(result).toBe(testPath.replace(homeDir, '~'));
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

  describe('Security: validatePathWithinBase', () => {
    it('should allow paths within base directory', () => {
      const baseDir = '/home/user/images';
      const targetPath = '/home/user/images/photo.png';

      expect(() => validatePathWithinBase(targetPath, baseDir)).not.toThrow();
    });

    it('should allow subdirectories within base', () => {
      const baseDir = '/home/user/images';
      const targetPath = '/home/user/images/animals/cats/photo.png';

      expect(() => validatePathWithinBase(targetPath, baseDir)).not.toThrow();
    });

    it('should allow relative paths that resolve within base', () => {
      const baseDir = '/home/user/images';
      // When resolved from baseDir, this will be /home/user/images/photo.png
      const targetPath = path.join(baseDir, 'photo.png');

      expect(() => validatePathWithinBase(targetPath, baseDir)).not.toThrow();
    });

    it('should reject path traversal with ../ in relative path', () => {
      const baseDir = '/home/user/images';
      const targetPath = '../../../etc/passwd';

      expect(() => validatePathWithinBase(targetPath, baseDir)).toThrow('Path traversal detected');
    });

    it('should reject path traversal with ../ in absolute path', () => {
      const baseDir = '/home/user/images';
      const targetPath = '/home/user/images/../../../etc/passwd';

      expect(() => validatePathWithinBase(targetPath, baseDir)).toThrow('Path traversal detected');
    });

    it('should reject absolute paths outside base directory', () => {
      const baseDir = '/home/user/images';
      const targetPath = '/etc/passwd';

      expect(() => validatePathWithinBase(targetPath, baseDir)).toThrow('Path traversal detected');
    });

    it('should reject paths on different drive (Windows-style)', () => {
      if (os.platform() !== 'win32') {
        // Skip on non-Windows
        return;
      }

      const baseDir = 'C:\\Users\\user\\images';
      const targetPath = 'D:\\other\\path\\file.png';

      expect(() => validatePathWithinBase(targetPath, baseDir)).toThrow('Path traversal detected');
    });

    it('should normalize paths before comparison', () => {
      const baseDir = '/home/user/images';
      const targetPath = '/home/user/images/./subdir/../photo.png';

      // This should resolve to /home/user/images/photo.png which is valid
      expect(() => validatePathWithinBase(targetPath, baseDir)).not.toThrow();
    });
  });

  describe('Security: normalizeAndValidatePath', () => {
    it('should reject relative path with path traversal', async () => {
      const maliciousPath = '../../../etc/passwd';

      await expect(normalizeAndValidatePath(maliciousPath)).rejects.toThrow('Path traversal detected');
    });

    it('should reject absolute path outside base directory', async () => {
      const maliciousPath = '/etc/passwd';

      await expect(normalizeAndValidatePath(maliciousPath)).rejects.toThrow('Path traversal detected');
    });

    it('should reject nested path traversal attempts', async () => {
      const maliciousPath = 'images/../../../../../../etc/passwd';

      await expect(normalizeAndValidatePath(maliciousPath)).rejects.toThrow('Path traversal detected');
    });
  });

  describe('Security: resolveInputPath', () => {
    it('should reject relative path with path traversal', () => {
      const maliciousPath = '../../../etc/passwd';

      expect(() => resolveInputPath(maliciousPath)).toThrow('Path traversal detected');
    });

    it('should reject absolute path outside base directory', () => {
      const maliciousPath = '/etc/passwd';

      expect(() => resolveInputPath(maliciousPath)).toThrow('Path traversal detected');
    });

    it('should accept valid relative paths', () => {
      const validPath = 'images/photo.png';

      expect(() => resolveInputPath(validPath)).not.toThrow();
    });

    it('should accept valid absolute paths within base', () => {
      const defaultDir = getDefaultOutputDirectory();
      const validPath = path.join(defaultDir, 'photo.png');

      expect(() => resolveInputPath(validPath)).not.toThrow();
    });
  });
});
