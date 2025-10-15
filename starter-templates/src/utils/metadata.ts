/**
 * Image Metadata Management
 *
 * Handles embedding and extraction of metadata in image files (PNG, JPEG, WebP)
 */

import sharp from 'sharp';
import type { ImageMetadata, MetadataLevel } from '../types/index.js';

/**
 * Embed metadata into an image file
 */
export async function embedMetadata(
  imagePath: string,
  metadata: ImageMetadata,
  level: MetadataLevel = 'standard'
): Promise<void> {
  const filteredMetadata = filterMetadataByLevel(metadata, level);
  const metadataString = JSON.stringify(filteredMetadata);

  // Read the image
  const image = sharp(imagePath);
  const imageMetadata = await image.metadata();

  // Embed based on format
  if (imageMetadata.format === 'png') {
    await embedInPNG(imagePath, metadataString);
  } else if (imageMetadata.format === 'jpeg' || imageMetadata.format === 'jpg') {
    await embedInJPEG(imagePath, metadataString);
  } else if (imageMetadata.format === 'webp') {
    await embedInWebP(imagePath, metadataString);
  } else {
    throw new Error(`Unsupported format for metadata embedding: ${imageMetadata.format}`);
  }
}

/**
 * Extract metadata from an image file
 */
export async function extractMetadata(imagePath: string): Promise<ImageMetadata | null> {
  const image = sharp(imagePath);
  const metadata = await image.metadata();

  if (metadata.exif) {
    // For JPEG/WebP, metadata is in EXIF
    try {
      // Parse EXIF data (simplified - you may need piexifjs for full support)
      const exifBuffer = metadata.exif;
      const exifString = exifBuffer.toString('utf8');

      // Look for our JSON metadata
      const match = exifString.match(/\{.*"uuid".*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch (e) {
      console.error('[Metadata] Failed to parse EXIF:', e);
    }
  }

  // For PNG, check text chunks (requires custom parsing)
  // This is a simplified version - actual implementation would need png-metadata or similar
  if (metadata.format === 'png') {
    // Note: sharp doesn't expose PNG text chunks directly
    // You would need to use a library like pngjs for full PNG metadata support
    console.warn('[Metadata] PNG metadata extraction not fully implemented');
  }

  return null;
}

/**
 * Verify integrity by comparing embedded metadata with database record
 */
export async function verifyIntegrity(
  imagePath: string,
  dbRecord: {params_hash: string; uuid: string}
): Promise<{valid: boolean; details: string}> {
  try {
    const imageMetadata = await extractMetadata(imagePath);

    if (!imageMetadata) {
      return {valid: false, details: 'No metadata found in image'};
    }

    if (imageMetadata.uuid !== dbRecord.uuid) {
      return {valid: false, details: 'UUID mismatch'};
    }

    if (imageMetadata.params_hash !== dbRecord.params_hash) {
      return {valid: false, details: 'Parameters hash mismatch - possible tampering'};
    }

    return {valid: true, details: 'All checks passed'};
  } catch (error) {
    return {
      valid: false,
      details: `Verification failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// =============================================================================
// Private Helper Functions
// =============================================================================

/**
 * Filter metadata based on level
 */
function filterMetadataByLevel(metadata: ImageMetadata, level: MetadataLevel): Partial<ImageMetadata> {
  switch (level) {
    case 'minimal':
      return {
        uuid: metadata.uuid,
        params_hash: metadata.params_hash
      };

    case 'standard':
      return {
        uuid: metadata.uuid,
        params_hash: metadata.params_hash,
        tool_name: metadata.tool_name,
        model: metadata.model,
        provider: metadata.provider,
        created_at: metadata.created_at,
        aspect_ratio: metadata.aspect_ratio,
        sample_image_size: metadata.sample_image_size
      };

    case 'full':
      return metadata;
  }
}

/**
 * Embed metadata in PNG file
 */
async function embedInPNG(imagePath: string, metadataString: string): Promise<void> {
  // Note: sharp doesn't support writing PNG text chunks directly
  // For production use, you would need pngjs or png-metadata

  await sharp(imagePath)
    .withMetadata({
      exif: {
        IFD0: {
          ImageDescription: metadataString
        }
      }
    })
    .toFile(imagePath + '.tmp');

  // Replace original (in production, handle this more carefully)
  const fs = await import('fs/promises');
  await fs.rename(imagePath + '.tmp', imagePath);
}

/**
 * Embed metadata in JPEG file
 */
async function embedInJPEG(imagePath: string, metadataString: string): Promise<void> {
  await sharp(imagePath)
    .withMetadata({
      exif: {
        IFD0: {
          ImageDescription: metadataString
        }
      }
    })
    .toFile(imagePath + '.tmp');

  const fs = await import('fs/promises');
  await fs.rename(imagePath + '.tmp', imagePath);
}

/**
 * Embed metadata in WebP file
 */
async function embedInWebP(imagePath: string, metadataString: string): Promise<void> {
  await sharp(imagePath)
    .withMetadata({
      exif: {
        IFD0: {
          ImageDescription: metadataString
        }
      }
    })
    .toFile(imagePath + '.tmp');

  const fs = await import('fs/promises');
  await fs.rename(imagePath + '.tmp', imagePath);
}
