/**
 * YAMLファイルから画像カスタマイズを実行するツール
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { ToolContext } from './types.js';
import type { CustomizeImageFromYamlArgs } from '../types/yamlConfig.js';
import { parseYamlToCustomizeArgs } from '../utils/yamlParser.js';
import { customizeImage } from './customizeImage.js';

/**
 * customize_image_from_yaml ツールの実装
 *
 * YAMLファイルから設定を読み込み、画像カスタマイズを実行します。
 * 内部的には既存の customizeImage 関数を呼び出します。
 *
 * @param context - ツールコンテキスト（認証、リソースマネージャーなど）
 * @param args - ツール引数（yaml_path）
 * @returns 画像生成結果
 */
export async function customizeImageFromYaml(
  context: ToolContext,
  args: CustomizeImageFromYamlArgs
) {
  const { yaml_path } = args;

  if (!yaml_path || typeof yaml_path !== 'string') {
    throw new McpError(
      ErrorCode.InvalidParams,
      'yaml_path is required and must be a string'
    );
  }

  if (process.env.DEBUG) {
    console.error(`[DEBUG] customize_image_from_yaml: Loading YAML from ${yaml_path}`);
  }

  try {
    // 1. YAMLファイルを解析して CustomizeImageArgs に変換
    const customizeArgs = await parseYamlToCustomizeArgs(yaml_path);

    if (process.env.DEBUG) {
      console.error('[DEBUG] customize_image_from_yaml: YAML parsed successfully');
      console.error('[DEBUG] Calling customizeImage with parsed arguments...');
    }

    // 2. 既存の customizeImage 関数を呼び出し
    const result = await customizeImage(context, customizeArgs);

    if (process.env.DEBUG) {
      console.error('[DEBUG] customize_image_from_yaml: Image generated successfully');
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
      console.error(`[DEBUG] customize_image_from_yaml error: ${errorMessage}`);
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Failed to process YAML configuration: ${errorMessage}`
    );
  }
}
