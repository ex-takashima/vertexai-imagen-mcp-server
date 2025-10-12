/**
 * 画像メタデータ管理ユーティリティ
 */

import { randomUUID, createHash } from 'crypto';
import sharp from 'sharp';
import extract from 'png-chunks-extract';
import encode from 'png-chunks-encode';
import text from 'png-chunk-text';
import type { ImageMetadata, MetadataLevel } from '../types/history.js';

/**
 * 新しい画像UUIDを生成
 */
export function generateImageUUID(): string {
  return randomUUID();
}

/**
 * パラメータのSHA-256ハッシュを計算
 *
 * @param params パラメータオブジェクト
 * @returns SHA-256ハッシュ（16進数文字列）
 */
export function calculateParamsHash(params: Record<string, any>): string {
  // キーをソートして一貫性を保証
  const sortedKeys = Object.keys(params).sort();
  const sortedParams: Record<string, any> = {};

  for (const key of sortedKeys) {
    sortedParams[key] = params[key];
  }

  const paramsJson = JSON.stringify(sortedParams);
  return createHash('sha256').update(paramsJson, 'utf8').digest('hex');
}

/**
 * 画像バッファにメタデータを埋め込む
 *
 * @param imageBuffer 画像バッファ
 * @param metadata 埋め込むメタデータ
 * @param level メタデータレベル（環境変数から取得）
 * @returns メタデータが埋め込まれた画像バッファ
 */
export async function embedMetadata(
  imageBuffer: Buffer,
  metadata: ImageMetadata,
  level?: MetadataLevel
): Promise<Buffer> {
  const metadataLevel: MetadataLevel = level ||
    (process.env.VERTEXAI_IMAGEN_METADATA_LEVEL as MetadataLevel) ||
    'standard';

  // レベルに応じてメタデータをフィルタリング
  let filteredMetadata: ImageMetadata;

  switch (metadataLevel) {
    case 'minimal':
      // UUIDとハッシュのみ
      filteredMetadata = {
        vertexai_imagen_uuid: metadata.vertexai_imagen_uuid,
        params_hash: metadata.params_hash,
      };
      break;

    case 'standard':
      // UUID + ハッシュ + 基本パラメータ
      filteredMetadata = {
        vertexai_imagen_uuid: metadata.vertexai_imagen_uuid,
        params_hash: metadata.params_hash,
        tool_name: metadata.tool_name,
        model: metadata.model,
        created_at: metadata.created_at,
        aspect_ratio: metadata.aspect_ratio,
        sample_image_size: metadata.sample_image_size,
      };
      break;

    case 'full':
      // 全てのメタデータ
      filteredMetadata = metadata;
      break;

    default:
      filteredMetadata = metadata;
  }

  // メタデータをJSON文字列に変換
  const metadataJson = JSON.stringify(filteredMetadata);

  // 画像フォーマットを検出
  const image = sharp(imageBuffer);
  const imageMetadata = await image.metadata();

  try {
    if (imageMetadata.format === 'png') {
      // PNGの場合、tEXtチャンクに埋め込み
      // png-chunksを使用してtEXtチャンクを追加
      const chunks = extract(imageBuffer);

      // VertexAI Imagen用のtEXtチャンクを作成
      const textChunk = text.encode('vertexai_imagen_metadata', metadataJson);

      // IENDチャンクの前に挿入（IENDは最後のチャンクである必要がある）
      const iendIndex = chunks.findIndex(chunk => chunk.name === 'IEND');
      if (iendIndex !== -1) {
        chunks.splice(iendIndex, 0, textChunk);
      } else {
        chunks.push(textChunk);
      }

      // PNGバッファを再構築
      return Buffer.from(encode(chunks));
    } else if (imageMetadata.format === 'jpeg' || imageMetadata.format === 'jpg') {
      // JPEGの場合、EXIFのUserCommentに埋め込み
      return await image
        .jpeg({
          quality: 95,
        })
        .withMetadata({
          exif: {
            IFD0: {
              ImageDescription: metadataJson,
            },
          },
        })
        .toBuffer();
    } else if (imageMetadata.format === 'webp') {
      // WebPの場合、EXIFメタデータに埋め込み
      return await image
        .webp({
          quality: 95,
        })
        .withMetadata({
          exif: {
            IFD0: {
              ImageDescription: metadataJson,
            },
          },
        })
        .toBuffer();
    } else {
      // サポートされていないフォーマットの場合はそのまま返す
      if (process.env.DEBUG) {
        console.error(`[DEBUG] Unsupported image format for metadata embedding: ${imageMetadata.format}`);
      }
      return imageBuffer;
    }
  } catch (error) {
    // メタデータ埋め込みに失敗した場合は警告を出して元の画像を返す
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[WARNING] Failed to embed metadata: ${errorMessage}`);
    return imageBuffer;
  }
}

/**
 * 画像ファイルからメタデータを抽出
 *
 * @param imagePath 画像ファイルパス
 * @returns 抽出されたメタデータ、存在しない場合はnull
 */
export async function extractMetadataFromImage(
  imagePath: string
): Promise<ImageMetadata | null> {
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();

    // PNG形式の場合、tEXtチャンクから読み取り
    if (metadata.format === 'png') {
      const fs = await import('fs/promises');
      const fileBuffer = await fs.readFile(imagePath);
      const chunks = extract(fileBuffer);

      // vertexai_imagen_metadataチャンクを探す
      const metadataChunk = chunks.find(
        chunk => chunk.name === 'tEXt' && text.decode(chunk.data).keyword === 'vertexai_imagen_metadata'
      );

      if (metadataChunk) {
        const decoded = text.decode(metadataChunk.data);
        try {
          const extractedMetadata = JSON.parse(decoded.text) as ImageMetadata;
          return extractedMetadata;
        } catch (parseError) {
          if (process.env.DEBUG) {
            console.error(`[DEBUG] Failed to parse PNG metadata JSON: ${parseError}`);
          }
        }
      }
    } else {
      // JPEG/WebP形式の場合、EXIFメタデータから読み取り
      if (metadata.exif) {
        const exifBuffer = metadata.exif;
        const exifString = exifBuffer.toString('utf8', 0, Math.min(exifBuffer.length, 10000));
        const jsonMatch = exifString.match(/\{[^{}]*vertexai_imagen_uuid[^{}]*\}/);

        if (jsonMatch) {
          try {
            const extractedMetadata = JSON.parse(jsonMatch[0]) as ImageMetadata;
            return extractedMetadata;
          } catch (parseError) {
            if (process.env.DEBUG) {
              console.error(`[DEBUG] Failed to parse EXIF metadata JSON: ${parseError}`);
            }
          }
        }
      }
    }

    return null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[WARNING] Failed to extract metadata from ${imagePath}: ${errorMessage}`);
    return null;
  }
}

/**
 * 画像の整合性を検証（ハッシュ値の比較）
 *
 * @param imageMetadata 画像から抽出されたメタデータ
 * @param dbParams データベースに保存されているパラメータ
 * @returns 整合性検証結果
 */
export function verifyIntegrity(
  imageMetadata: ImageMetadata,
  dbParams: Record<string, any>
): { valid: boolean; message: string } {
  if (!imageMetadata.params_hash) {
    return {
      valid: false,
      message: 'Image metadata does not contain params_hash',
    };
  }

  const calculatedHash = calculateParamsHash(dbParams);

  if (imageMetadata.params_hash === calculatedHash) {
    return {
      valid: true,
      message: 'Image integrity verified: hash values match',
    };
  } else {
    return {
      valid: false,
      message: `Image integrity check failed: hash mismatch (image: ${imageMetadata.params_hash.substring(0, 8)}..., db: ${calculatedHash.substring(0, 8)}...)`,
    };
  }
}

/**
 * メタデータ埋め込みが有効かどうかを確認
 *
 * @returns メタデータ埋め込みが有効な場合 true
 */
export function isMetadataEmbeddingEnabled(): boolean {
  const envValue = process.env.VERTEXAI_IMAGEN_EMBED_METADATA;

  // デフォルトは true
  if (envValue === undefined || envValue === null || envValue === '') {
    return true;
  }

  // 'false' または '0' の場合は無効
  return envValue !== 'false' && envValue !== '0';
}

/**
 * メタデータレベルを取得
 *
 * @returns 現在のメタデータレベル
 */
export function getMetadataLevel(): MetadataLevel {
  const level = process.env.VERTEXAI_IMAGEN_METADATA_LEVEL as MetadataLevel;

  if (level === 'minimal' || level === 'standard' || level === 'full') {
    return level;
  }

  // デフォルトは standard
  return 'standard';
}
