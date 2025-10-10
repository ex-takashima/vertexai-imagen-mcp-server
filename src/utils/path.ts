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
 * Normalize and validate output path (cross-platform)
 *
 * - Absolute paths: used as-is
 * - Relative paths: resolved relative to default output directory
 * - Creates parent directory if it doesn't exist
 */
export async function normalizeAndValidatePath(outputPath: string): Promise<string> {
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
