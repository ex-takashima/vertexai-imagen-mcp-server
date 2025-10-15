/**
 * MCP Resources Manager
 *
 * Manages image files as MCP resources with file:// URI support
 */

import { readdir, stat, readFile } from 'fs/promises';
import { join } from 'path';
import type { ImageResource } from '../types/index.js';

export class ResourceManager {
  constructor(private outputDir: string) {}

  /**
   * List all image resources in the output directory
   */
  async listResources(): Promise<ImageResource[]> {
    const resources: ImageResource[] = [];

    try {
      const files = await readdir(this.outputDir);

      for (const file of files) {
        if (this.isImageFile(file)) {
          const filePath = join(this.outputDir, file);
          const stats = await stat(filePath);

          resources.push({
            uri: `file://${filePath}`,
            name: file,
            mimeType: this.getMimeType(file),
            description: `Generated image: ${file}`,
            size: stats.size
          });
        }
      }
    } catch (error) {
      console.error('[ResourceManager] Failed to list resources:', error);
    }

    return resources;
  }

  /**
   * Read a resource by URI
   */
  async readResource(uri: string): Promise<Buffer> {
    // Extract file path from file:// URI
    const filePath = uri.replace('file://', '');

    // Security check: ensure path is within output directory
    if (!filePath.startsWith(this.outputDir)) {
      throw new Error('Access denied: file outside output directory');
    }

    return await readFile(filePath);
  }

  /**
   * Get metadata for a specific resource
   */
  async getResourceMetadata(uri: string): Promise<ImageResource | null> {
    const filePath = uri.replace('file://', '');

    try {
      const stats = await stat(filePath);
      const fileName = filePath.split('/').pop() || 'unknown';

      return {
        uri,
        name: fileName,
        mimeType: this.getMimeType(fileName),
        size: stats.size
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if file is an image
   */
  private isImageFile(filename: string): boolean {
    const ext = filename.toLowerCase().split('.').pop();
    return ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext || '');
  }

  /**
   * Get MIME type from filename
   */
  private getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();

    switch (ext) {
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      default:
        return 'application/octet-stream';
    }
  }
}
