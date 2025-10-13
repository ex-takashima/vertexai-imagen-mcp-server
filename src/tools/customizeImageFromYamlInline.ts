/**
 * YAML文字列から画像カスタマイズを実行するツール（インライン版）
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { ToolContext } from './types.js';
import { parseYamlStringToCustomizeArgs } from '../utils/yamlParser.js';
import { customizeImage } from './customizeImage.js';

/**
 * customize_image_from_yaml_inline ツールの引数
 */
export interface CustomizeImageFromYamlInlineArgs {
  yaml_content: string;  // YAML文字列
}

/**
 * customize_image_from_yaml_inline ツールの実装
 *
 * YAML文字列（チャットに貼り付けた内容）から設定を読み込み、画像カスタマイズを実行します。
 * 内部的には既存の customizeImage 関数を呼び出します。
 *
 * @param context - ツールコンテキスト（認証、リソースマネージャーなど）
 * @param args - ツール引数（yaml_content）
 * @returns 画像生成結果
 */
export async function customizeImageFromYamlInline(
  context: ToolContext,
  args: CustomizeImageFromYamlInlineArgs
) {
  const { yaml_content } = args;

  if (!yaml_content || typeof yaml_content !== 'string') {
    throw new McpError(
      ErrorCode.InvalidParams,
      'yaml_content is required and must be a string'
    );
  }

  if (process.env.DEBUG) {
    console.error('[DEBUG] customize_image_from_yaml_inline: Parsing YAML content');
    console.error('[DEBUG] YAML content length:', yaml_content.length);
  }

  try {
    // 1. YAML文字列を解析して CustomizeImageArgs に変換
    const customizeArgs = await parseYamlStringToCustomizeArgs(yaml_content);

    if (process.env.DEBUG) {
      console.error('[DEBUG] customize_image_from_yaml_inline: YAML parsed successfully');
      console.error('[DEBUG] Calling customizeImage with parsed arguments...');
    }

    // 2. 既存の customizeImage 関数を呼び出し
    const result = await customizeImage(context, customizeArgs);

    if (process.env.DEBUG) {
      console.error('[DEBUG] customize_image_from_yaml_inline: Image generated successfully');
    }

    return result;
  } catch (error) {
    // McpError はそのまま throw
    if (error instanceof McpError) {
      throw error;
    }

    // その他のエラーは適切な McpError に変換
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (process.env.DEBUG) {
      console.error(`[DEBUG] customize_image_from_yaml_inline error: ${errorMessage}`);
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Failed to process YAML content: ${errorMessage}`
    );
  }
}
