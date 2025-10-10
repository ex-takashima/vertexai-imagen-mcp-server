/**
 * MCP Resources API 用の画像リソース管理クラス
 *
 * 出力ディレクトリ内の画像ファイルをリソースとして管理し、
 * file:// URI経由でのアクセスを提供します。
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { detectMimeTypeFromPath } from './image.js';

/**
 * リソース情報
 */
export interface ResourceInfo {
  uri: string;
  name: string;
  mimeType: string;
  description?: string;
  size?: number;
}

/**
 * 画像リソースマネージャー
 */
export class ImageResourceManager {
  private outputDir: string;

  /**
   * @param outputDir 出力ディレクトリの絶対パス
   */
  constructor(outputDir: string) {
    this.outputDir = path.resolve(outputDir);
  }

  /**
   * 出力ディレクトリを取得
   */
  getOutputDir(): string {
    return this.outputDir;
  }

  /**
   * ファイルパスからfile:// URIを生成
   *
   * @param filePath ファイルの絶対パス
   * @returns file:// URI
   * @throws パスが出力ディレクトリ外の場合
   */
  getFileUri(filePath: string): string {
    const resolvedPath = path.resolve(filePath);

    // セキュリティチェック: 出力ディレクトリ内かを確認
    if (!this.isPathInOutputDir(resolvedPath)) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `File path is outside the output directory: ${filePath}`
      );
    }

    // file:// URI に変換
    return pathToFileURL(resolvedPath).href;
  }

  /**
   * file:// URI からファイルパスを解決
   *
   * @param uri file:// URI
   * @returns ファイルの絶対パス、またはnull（無効なURIの場合）
   * @throws URIが出力ディレクトリ外を指す場合
   */
  resolveUri(uri: string): string | null {
    // file:// スキームのチェック
    if (!uri.startsWith('file://')) {
      return null;
    }

    try {
      const filePath = fileURLToPath(uri);
      const resolvedPath = path.resolve(filePath);

      // セキュリティチェック: 出力ディレクトリ内かを確認
      if (!this.isPathInOutputDir(resolvedPath)) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `URI points to a file outside the output directory: ${uri}`
        );
      }

      return resolvedPath;
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      // URI解析エラー
      return null;
    }
  }

  /**
   * パスが出力ディレクトリ内かをチェック
   *
   * @param targetPath チェック対象のパス
   * @returns true: ディレクトリ内、false: ディレクトリ外
   */
  private isPathInOutputDir(targetPath: string): boolean {
    const resolvedTarget = path.resolve(targetPath);
    const resolvedOutput = path.resolve(this.outputDir);

    // パストラバーサル攻撃を防ぐため、正規化されたパスで比較
    return resolvedTarget.startsWith(resolvedOutput + path.sep) ||
           resolvedTarget === resolvedOutput;
  }

  /**
   * 出力ディレクトリ内のすべての画像リソースを一覧取得
   *
   * @returns リソース情報の配列
   */
  async listResources(): Promise<ResourceInfo[]> {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff', '.tif'];
    const resources: ResourceInfo[] = [];

    try {
      // 出力ディレクトリが存在するか確認
      await fs.access(this.outputDir);
    } catch (error) {
      // ディレクトリが存在しない場合は空配列を返す
      if (process.env.DEBUG) {
        console.error(`[DEBUG] Output directory does not exist: ${this.outputDir}`);
      }
      return resources;
    }

    try {
      const files = await fs.readdir(this.outputDir);

      for (const file of files) {
        const ext = path.extname(file).toLowerCase();

        // 画像ファイルのみを対象
        if (!imageExtensions.includes(ext)) {
          continue;
        }

        const filePath = path.join(this.outputDir, file);

        try {
          const stats = await fs.stat(filePath);

          // ディレクトリはスキップ
          if (!stats.isFile()) {
            continue;
          }

          const uri = this.getFileUri(filePath);
          const mimeType = detectMimeTypeFromPath(filePath) || 'application/octet-stream';

          resources.push({
            uri,
            name: file,
            mimeType,
            description: `Generated image: ${file}`,
            size: stats.size
          });
        } catch (error) {
          // 個別ファイルのエラーは無視して続行
          if (process.env.DEBUG) {
            console.error(`[DEBUG] Failed to process file ${file}: ${error}`);
          }
          continue;
        }
      }

      if (process.env.DEBUG) {
        console.error(`[DEBUG] Found ${resources.length} image resources in ${this.outputDir}`);
      }

      return resources;
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list resources: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 指定されたURIのリソースを読み込み
   *
   * @param uri file:// URI
   * @returns 画像データのバッファ
   * @throws ファイルが見つからない、または読み込みに失敗した場合
   */
  async readResource(uri: string): Promise<Buffer> {
    const filePath = this.resolveUri(uri);

    if (!filePath) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Invalid resource URI: ${uri}`
      );
    }

    try {
      const buffer = await fs.readFile(filePath);

      if (process.env.DEBUG) {
        console.error(`[DEBUG] Read resource: ${uri} (${buffer.length} bytes)`);
      }

      return buffer;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Resource not found: ${uri}`
        );
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to read resource: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * MCP Resource形式でリソース情報を返す
   *
   * @param uri file:// URI
   * @returns MCP Resource形式のオブジェクト
   */
  async getResourceMetadata(uri: string): Promise<ResourceInfo | null> {
    const filePath = this.resolveUri(uri);

    if (!filePath) {
      return null;
    }

    try {
      const stats = await fs.stat(filePath);
      const fileName = path.basename(filePath);
      const mimeType = detectMimeTypeFromPath(filePath) || 'application/octet-stream';

      return {
        uri,
        name: fileName,
        mimeType,
        description: `Generated image: ${fileName}`,
        size: stats.size
      };
    } catch (error) {
      return null;
    }
  }
}
