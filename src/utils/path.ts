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
 * - Absolute paths: used as-is (must be within configured base directory)
 * - Relative paths: resolved relative to default output directory
 * - Creates parent directory if it doesn't exist
 * - Optionally generates unique file name if file already exists
 * - Validates path is within base directory (prevents path traversal attacks)
 *
 * @param outputPath Output file path
 * @param autoNumbering If true, automatically add number suffix to avoid overwriting (default: true)
 * @throws Error if path traversal is detected or directory creation fails
 */
export async function normalizeAndValidatePath(
  outputPath: string,
  autoNumbering: boolean = true
): Promise<string> {
  const defaultDir = getDefaultOutputDirectory();
  let absolutePath: string;

  // If already absolute, use as-is
  if (path.isAbsolute(outputPath)) {
    absolutePath = outputPath;
  } else {
    // Relative path: resolve from default output directory
    absolutePath = path.join(defaultDir, outputPath);
  }

  // Security: Validate path is within base directory (prevent path traversal)
  validatePathWithinBase(absolutePath, defaultDir);

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
 * Convert WSL path to Windows path
 * Examples:
 * - /mnt/c/Users/... → C:\Users\...
 * - /mnt/d/Data/... → D:\Data\...
 *
 * @param wslPath WSL-style path
 * @returns Windows path if WSL path detected, otherwise original path
 */
function convertWslPathToWindows(wslPath: string): string {
  // Check if this is a WSL path: /mnt/{drive_letter}/...
  const wslPattern = /^\/mnt\/([a-z])\//i;
  const match = wslPath.match(wslPattern);

  if (match) {
    const driveLetter = match[1].toUpperCase();
    // Replace /mnt/c/ with C:\ (and handle forward slashes)
    const windowsPath = wslPath.replace(wslPattern, `${driveLetter}:\\`).replace(/\//g, '\\');
    return windowsPath;
  }

  return wslPath;
}

/**
 * Resolve input file path (for reading existing files)
 *
 * - Absolute paths: used as-is (with WSL path conversion if needed, must be within configured base directory)
 * - Relative paths: resolved relative to default output directory
 *   (assuming the file was generated by this tool and saved to output directory)
 * - Validates path is within base directory (prevents path traversal attacks)
 *
 * @param inputPath Input file path
 * @returns Absolute path
 * @throws Error if path traversal is detected
 */
export function resolveInputPath(inputPath: string): string {
  const defaultDir = getDefaultOutputDirectory();

  // Convert WSL paths to Windows paths if needed
  const convertedPath = convertWslPathToWindows(inputPath);

  let absolutePath: string;

  // If already absolute, use as-is
  if (path.isAbsolute(convertedPath)) {
    absolutePath = convertedPath;
  } else {
    // Relative path: resolve from default output directory
    absolutePath = path.join(defaultDir, convertedPath);
  }

  // Security: Validate path is within base directory (prevent path traversal)
  validatePathWithinBase(absolutePath, defaultDir);

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

/**
 * Generate multiple file paths with numbered suffixes for multi-sample generation
 *
 * Examples:
 * - generateMultipleFilePaths("image.png", 3) → ["image_1.png", "image_2.png", "image_3.png"]
 * - generateMultipleFilePaths("output.jpg", 1) → ["output_1.jpg"]
 *
 * Each path is checked for uniqueness using generateUniqueFilePath to avoid overwriting.
 *
 * @param baseOutputPath Base output file path
 * @param sampleCount Number of files to generate paths for
 * @param autoNumbering If true, automatically add number suffix to avoid overwriting (default: true)
 * @returns Array of unique file paths
 */
export async function generateMultipleFilePaths(
  baseOutputPath: string,
  sampleCount: number,
  autoNumbering: boolean = true
): Promise<string[]> {
  if (sampleCount < 1) {
    throw new Error(`sampleCount must be at least 1, got: ${sampleCount}`);
  }

  // If only one sample, return single path (with optional auto-numbering)
  if (sampleCount === 1) {
    if (autoNumbering) {
      return [await generateUniqueFilePath(baseOutputPath)];
    }
    return [baseOutputPath];
  }

  // For multiple samples, add numbered suffixes
  const parsedPath = path.parse(baseOutputPath);
  const filePaths: string[] = [];

  for (let i = 1; i <= sampleCount; i++) {
    // Generate path with counter: basename_1.ext, basename_2.ext, ...
    const numberedPath = path.join(
      parsedPath.dir,
      `${parsedPath.name}_${i}${parsedPath.ext}`
    );

    // Apply auto-numbering if enabled (to avoid overwriting existing files)
    if (autoNumbering) {
      filePaths.push(await generateUniqueFilePath(numberedPath));
    } else {
      filePaths.push(numberedPath);
    }
  }

  return filePaths;
}

/**
 * Validate that a resolved path is within a base directory
 * Prevents path traversal attacks (CWE-22)
 *
 * @param targetPath - The path to validate (will be resolved to absolute path)
 * @param basePath - The base directory path (will be resolved to absolute path)
 * @throws Error if targetPath is outside basePath
 *
 * @example
 * // Valid: path within base directory
 * validatePathWithinBase('/home/user/images/photo.png', '/home/user/images');
 *
 * @example
 * // Invalid: path traversal detected
 * validatePathWithinBase('/home/user/images/../../../etc/passwd', '/home/user/images');
 * // throws Error: Security Error: Path traversal detected
 */
export function validatePathWithinBase(targetPath: string, basePath: string): void {
  // Resolve both paths to absolute paths to normalize them
  const resolvedTarget = path.resolve(targetPath);
  const resolvedBase = path.resolve(basePath);

  // Calculate relative path from base to target
  const relative = path.relative(resolvedBase, resolvedTarget);

  // If relative path starts with '..' or is absolute, target is outside base
  // Note: path.relative returns absolute path if paths are on different drives (Windows)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(
      `Security Error: Path traversal detected.\n` +
      `Attempted path: ${targetPath}\n` +
      `Resolved to: ${resolvedTarget}\n` +
      `Must be within: ${resolvedBase}\n` +
      `\n` +
      `Path traversal (using ../) to access parent directories is not allowed for security reasons.\n` +
      `Please specify a path within the configured directory.`
    );
  }
}
