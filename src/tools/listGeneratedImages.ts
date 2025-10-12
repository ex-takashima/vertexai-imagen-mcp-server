import fs from 'fs/promises';
import path from 'path';
import type { ListGeneratedImagesArgs } from '../types/tools.js';
import type { ToolContext } from './types.js';

export async function listGeneratedImages(
  _context: ToolContext,
  args: ListGeneratedImagesArgs,
) {
  const { directory = '.' } = args;

  try {
    const files = await fs.readdir(directory);
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

    const imageFiles = files.filter((file) =>
      imageExtensions.some((ext) => file.toLowerCase().endsWith(ext)),
    );

    if (imageFiles.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No image files found in directory: ${path.resolve(directory)}`,
          },
        ],
      };
    }

    const fileDetails = await Promise.all(
      imageFiles.map(async (file) => {
        const filePath = path.join(directory, file);
        const stats = await fs.stat(filePath);
        return {
          name: file,
          path: path.resolve(filePath),
          size: stats.size,
          modified: stats.mtime.toISOString(),
        };
      }),
    );

    const fileList = fileDetails
      .map(
        (file) => `• ${file.name} (${file.size} bytes, modified: ${file.modified})`,
      )
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Found ${imageFiles.length} image file(s) in ${path.resolve(directory)}:\n\n${fileList}`,
        },
      ],
    };
  } catch (error) {
    throw new Error(
      `Failed to list images: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
