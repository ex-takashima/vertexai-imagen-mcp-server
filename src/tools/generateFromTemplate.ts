import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { GenerateFromTemplateArgs } from '../types/template.js';
import type { ToolContext } from './types.js';
import { loadTemplate, substituteVariables, validateVariables } from '../utils/templateManager.js';
import { generateImage as handleGenerateImage } from './generateImage.js';
import type { GenerateImageArgs } from '../types/tools.js';

/**
 * テンプレートから画像を生成
 */
export async function generateFromTemplate(
  context: ToolContext,
  args: GenerateFromTemplateArgs
) {
  const { template_name, variable_values, override_params } = args;

  if (!template_name || typeof template_name !== 'string') {
    throw new McpError(
      ErrorCode.InvalidParams,
      'template_name is required and must be a string'
    );
  }

  if (!variable_values || typeof variable_values !== 'object') {
    throw new McpError(
      ErrorCode.InvalidParams,
      'variable_values is required and must be an object'
    );
  }

  try {
    // テンプレートを読み込み
    const template = await loadTemplate(template_name);

    if (!template) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Template "${template_name}" not found`
      );
    }

    // 変数のバリデーション
    const validation = validateVariables(template.template, variable_values);

    if (!validation.valid) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Missing required variables: ${validation.missing.join(', ')}`
      );
    }

    // プロンプトを生成
    const prompt = substituteVariables(template.template, variable_values);

    // パラメータをマージ（default_params + override_params）
    const mergedParams: any = {
      prompt,
      ...template.default_params,
      ...override_params,
    };

    // generate_image を呼び出し
    const result = await handleGenerateImage(context, mergedParams);

    // 結果にテンプレート情報を追加
    if (result.content && result.content.length > 0 && result.content[0].type === 'text') {
      const originalText = result.content[0].text;
      const templateInfo = `\n\n---\n\nGenerated from template: ${template.name}\n` +
                          `Variables used: ${Object.entries(variable_values).map(([k, v]) => `${k}="${v}"`).join(', ')}\n` +
                          `Final prompt: ${prompt}`;

      result.content[0].text = originalText + templateInfo;
    }

    return result;
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to generate from template: ${errorMessage}`
    );
  }
}
