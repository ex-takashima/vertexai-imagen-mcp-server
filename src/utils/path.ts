import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Get default output directory (cross-platform)
 *
 * Priority:
 * 1. VERTEXAI_IMAGEN_OUTPUT_DIR environment variable
 * 2. ~/Downloads/vertexai-imagen-files (default)
 */
export function getDefaultOutputDirectory(): string {
  // Check environment variable first
  const envDir = process.env.VERTEXAI_IMAGEN_OUTPUT_DIR;
  if (envDir) {
    return path.resolve(envDir);
  }

  // Use os.homedir() for cross-platform home directory
  const homeDir = os.homedir();
  const defaultDir = path.join(homeDir, 'Downloads', 'vertexai-imagen-files');

  return defaultDir;
}

/**
 * Generate unique file path by adding number suffix if file exists
 *
 * Examples:
 * - image.png → image.png (if not exists)
 * - image.png → image_1.png (if image.png exists)
 * - image.png → image_2.png (if image.png and image_1.png exist)
 *
 * @param filePath Original file path
 * @returns Unique file path (may be the same as input if no conflict)
 */
export async function generateUniqueFilePath(filePath: string): Promise<string> {
  try {
    // Check if file exists
    await fs.access(filePath);
    // File exists, generate unique name
  } catch {
    // File doesn't exist, use original path
    return filePath;
  }

  const parsedPath = path.parse(filePath);
  let counter = 1;
  let uniquePath: string;

  while (true) {
    // Generate path with counter: basename_1.ext, basename_2.ext, ...
    uniquePath = path.join(
      parsedPath.dir,
      `${parsedPath.name}_${counter}${parsedPath.ext}`
    );

    try {
      await fs.access(uniquePath);
      // File exists, try next number
      counter++;
    } catch {
      // File doesn't exist, use this path
      return uniquePath;
    }

    // Safety limit to prevent infinite loop
    if (counter > 10000) {
      throw new Error(
        `Cannot generate unique file name after 10000 attempts for: ${filePath}`
      );
    }
  }
}

/**
 * Normalize and validate output path (cross-platform)
 *
 * - Absolute paths: used as-is
 * - Relative paths: resolved relative to default output directory
 * - Creates parent directory if it doesn't exist
 * - Optionally generates unique file name if file already exists
 *
 * @param outputPath Output file path
 * @param autoNumbering If true, automatically add number suffix to avoid overwriting (default: true)
 */
export async function normalizeAndValidatePath(
  outputPath: string,
  autoNumbering: boolean = true
): Promise<string> {
  let absolutePath: string;

  // If already absolute, use as-is
  if (path.isAbsolute(outputPath)) {
    absolutePath = outputPath;
  } else {
    // Relative path: resolve from default output directory
    const defaultDir = getDefaultOutputDirectory();
    absolutePath = path.join(defaultDir, outputPath);
  }

  // Ensure parent directory exists (create if needed)
  const dir = path.dirname(absolutePath);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to create output directory: ${dir}\n` +
      `Error: ${errorMessage}\n` +
      `\n` +
      `Troubleshooting:\n` +
      `  - Check write permissions for the directory\n` +
      `  - Ensure the path is valid for your operating system\n` +
      `  - Try using VERTEXAI_IMAGEN_OUTPUT_DIR environment variable to set a custom output directory\n` +
      `  - Default output directory: ${getDefaultOutputDirectory()}`
    );
  }

  // Generate unique file path if auto-numbering is enabled
  if (autoNumbering) {
    absolutePath = await generateUniqueFilePath(absolutePath);
  }

  return absolutePath;
}

/**
 * Get user-friendly display path
 * Converts absolute path to ~ notation for better readability
 */
export function getDisplayPath(absolutePath: string): string {
  const homeDir = os.homedir();
  if (absolutePath.startsWith(homeDir)) {
    return absolutePath.replace(homeDir, '~');
  }
  return absolutePath;
}
