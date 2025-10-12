import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { SavePromptTemplateArgs } from '../types/template.js';
import type { ToolContext } from './types.js';
import { saveTemplate, extractVariables, loadTemplate } from '../utils/templateManager.js';
import type { PromptTemplate } from '../types/template.js';

/**
 * プロンプトテンプレートを保存
 */
export async function savePromptTemplate(
  context: ToolContext,
  args: SavePromptTemplateArgs
) {
  const { name, description, template, variables, default_params, tags } = args;

  if (!name || typeof name !== 'string') {
    throw new McpError(
      ErrorCode.InvalidParams,
      'name is required and must be a string'
    );
  }

  if (!description || typeof description !== 'string') {
    throw new McpError(
      ErrorCode.InvalidParams,
      'description is required and must be a string'
    );
  }

  if (!template || typeof template !== 'string') {
    throw new McpError(
      ErrorCode.InvalidParams,
      'template is required and must be a string'
    );
  }

  try {
    // 既存のテンプレートをチェック
    const existing = await loadTemplate(name);

    // 変数を抽出（省略時は自動抽出）
    const extractedVariables = variables || extractVariables(template);

    // テンプレートオブジェクトを作成
    const promptTemplate: PromptTemplate = {
      name,
      description,
      template,
      variables: extractedVariables,
      default_params,
      tags,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 保存
    await saveTemplate(promptTemplate);

    let responseText = '';

    if (existing) {
      responseText += `✓ Template "${name}" updated successfully\n\n`;
    } else {
      responseText += `✓ Template "${name}" created successfully\n\n`;
    }

    responseText += `Description: ${description}\n`;
    responseText += `Template: ${template}\n`;
    responseText += `Variables: ${extractedVariables.length > 0 ? extractedVariables.join(', ') : 'none'}\n`;

    if (default_params && Object.keys(default_params).length > 0) {
      responseText += `Default Parameters:\n${JSON.stringify(default_params, null, 2)}\n`;
    }

    if (tags && tags.length > 0) {
      responseText += `Tags: ${tags.join(', ')}\n`;
    }

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to save template: ${errorMessage}`
    );
  }
}
