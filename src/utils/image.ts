/**
 * 画像処理ユーティリティ
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

/**
 * Base64文字列を正規化
 * Data URI形式の場合はBase64部分のみを抽出
 *
 * @param input 入力文字列
 * @returns 正規化されたBase64文字列
 */
export function normalizeBase64String(input: string): string {
  const trimmed = input.trim();
  const commaIndex = trimmed.indexOf(',');
  if (trimmed.startsWith('data:') && commaIndex !== -1) {
    return trimmed.slice(commaIndex + 1).replace(/\s/g, '');
  }
  return trimmed.replace(/\s/g, '');
}

/**
 * ファイルパスからMIMEタイプを検出
 *
 * @param filePath ファイルパス
 * @returns MIMEタイプ（不明な場合はundefined）
 */
export function detectMimeTypeFromPath(filePath: string): string | undefined {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".bmp":
      return "image/bmp";
    case ".gif":
      return "image/gif";
    case ".tif":
    case ".tiff":
      return "image/tiff";
    default:
      return undefined;
  }
}

/**
 * 画像ソースの解決結果
 */
export interface ResolvedImageSource {
  base64: string;
  mimeType?: string;
  source: "base64" | "data-uri" | "file";
  filePath?: string;
}

/**
 * 画像ソースを解決（Base64文字列またはファイルパスから）
 *
 * @param options 解決オプション
 * @returns 解決された画像ソース
 * @throws 必須パラメータが不足している場合、またはファイルの読み込みに失敗した場合
 */
export async function resolveImageSource({
  base64Value,
  pathValue,
  label,
  required,
}: {
  base64Value?: string;
  pathValue?: string;
  label: string;
  required?: boolean;
}): Promise<ResolvedImageSource | undefined> {
  if (base64Value && typeof base64Value === 'string' && base64Value.trim().length > 0) {
    const trimmed = base64Value.trim();
    if (trimmed.startsWith('data:')) {
      const commaIndex = trimmed.indexOf(',');
      if (commaIndex === -1) {
        throw new McpError(ErrorCode.InvalidParams, `${label} data URI is malformed`);
      }
      const header = trimmed.slice(5, commaIndex); // drop 'data:'
      const normalized = trimmed.slice(commaIndex + 1).replace(/\s/g, '');
      if (!normalized) {
        throw new McpError(ErrorCode.InvalidParams, `${label} data URI contains no base64 data`);
      }
      const mimeType = header.split(';')[0] || undefined;
      return {
        base64: normalized,
        mimeType,
        source: "data-uri",
      };
    }
    const normalized = normalizeBase64String(base64Value);
    if (!normalized) {
      throw new McpError(ErrorCode.InvalidParams, `${label} base64 string is empty`);
    }
    return {
      base64: normalized,
      source: "base64",
    };
  }

  if (pathValue && typeof pathValue === 'string' && pathValue.trim().length > 0) {
    const fullPath = path.resolve(pathValue);
    try {
      const buffer = await fs.readFile(fullPath);
      return {
        base64: buffer.toString('base64'),
        mimeType: detectMimeTypeFromPath(fullPath),
        source: "file",
        filePath: fullPath,
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `${label} file could not be read from path: ${fullPath} (${error instanceof Error ? error.message : String(error)})`
      );
    }
  }

  if (required) {
    throw new McpError(ErrorCode.InvalidParams, `${label} is required as base64 string or file path`);
  }

  return undefined;
}

/**
 * 画像レスポンスオプション
 */
export interface ImageResponseOptions {
  /** 画像をLLMコンテキストから除外するか（デフォルト: true） */
  excludeFromContext?: boolean;
  /** カスタムアノテーション（省略時は excludeFromContext に基づいて自動設定） */
  annotations?: {
    audience?: ("user" | "assistant")[];
    priority?: number;
  };
}

/**
 * 画像レスポンスを作成（MCPクライアント用）
 *
 * @param imageBuffer 画像バッファ
 * @param mimeType MIMEタイプ
 * @param filePath 保存先ファイルパス（省略可）
 * @param additionalInfo 追加情報テキスト（省略可）
 * @param options レスポンスオプション（省略可）
 * @returns MCPレスポンス形式
 */
export function createImageResponse(
  imageBuffer: Buffer,
  mimeType: string,
  filePath?: string,
  additionalInfo?: string,
  options?: ImageResponseOptions
) {
  const base64Data = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64Data}`;

  let responseText = additionalInfo || '';
  if (filePath) {
    responseText += `\nSaved to: ${filePath}`;
  }
  responseText += `\nFile size: ${imageBuffer.length} bytes\nMIME type: ${mimeType}`;

  // デフォルトでは画像をLLMコンテキストから除外
  const excludeFromContext = options?.excludeFromContext ?? true;

  // アノテーションの構築
  const annotations = options?.annotations || {
    audience: excludeFromContext ? ["user"] as const : ["user", "assistant"] as const,
  };

  return {
    content: [
      {
        type: "text",
        text: responseText
      },
      {
        type: "image",
        data: dataUrl,
        mimeType: mimeType,
        annotations: annotations
      }
    ],
  };
}
