/**
 * サムネイル生成ユーティリティ
 */

import sharp from 'sharp';

export interface ThumbnailConfig {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  format: 'jpeg' | 'png' | 'webp';
}

export const DEFAULT_THUMBNAIL_CONFIG: ThumbnailConfig = {
  maxWidth: 128,
  maxHeight: 128,
  quality: 60,
  format: 'jpeg'
};

/**
 * 画像ファイルからサムネイルを生成
 *
 * @param imageBuffer 元画像のバッファ
 * @param config サムネイル設定（省略時はデフォルト）
 * @returns サムネイルのBase64データURI
 */
export async function generateThumbnail(
  imageBuffer: Buffer,
  config: ThumbnailConfig = DEFAULT_THUMBNAIL_CONFIG
): Promise<string> {
  try {
    // Sharpでリサイズ処理
    let sharpInstance = sharp(imageBuffer)
      .resize(config.maxWidth, config.maxHeight, {
        fit: 'inside',           // アスペクト比を維持
        withoutEnlargement: true // 元画像より大きくしない
      });

    // フォーマットに応じた圧縮処理を適用
    if (config.format === 'jpeg') {
      sharpInstance = sharpInstance.jpeg({
        quality: config.quality,
        progressive: true        // プログレッシブJPEG
      });
    } else if (config.format === 'png') {
      sharpInstance = sharpInstance.png({
        quality: config.quality
      });
    } else if (config.format === 'webp') {
      sharpInstance = sharpInstance.webp({
        quality: config.quality
      });
    }

    const thumbnailBuffer = await sharpInstance.toBuffer();

    // Base64 Data URIとして返却
    const base64 = thumbnailBuffer.toString('base64');
    const mimeType = `image/${config.format}`;
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    throw new Error(
      `Failed to generate thumbnail: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * ファイルパスから画像を読み込みサムネイルを生成
 *
 * @param filePath 画像ファイルパス
 * @param config サムネイル設定（省略時はデフォルト）
 * @returns サムネイルのBase64データURI
 */
export async function generateThumbnailFromFile(
  filePath: string,
  config: ThumbnailConfig = DEFAULT_THUMBNAIL_CONFIG
): Promise<string> {
  try {
    let sharpInstance = sharp(filePath)
      .resize(config.maxWidth, config.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });

    // フォーマットに応じた圧縮処理を適用
    if (config.format === 'jpeg') {
      sharpInstance = sharpInstance.jpeg({
        quality: config.quality,
        progressive: true
      });
    } else if (config.format === 'png') {
      sharpInstance = sharpInstance.png({
        quality: config.quality
      });
    } else if (config.format === 'webp') {
      sharpInstance = sharpInstance.webp({
        quality: config.quality
      });
    }

    const thumbnailBuffer = await sharpInstance.toBuffer();

    const base64 = thumbnailBuffer.toString('base64');
    const mimeType = `image/${config.format}`;
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    throw new Error(
      `Failed to generate thumbnail from file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
