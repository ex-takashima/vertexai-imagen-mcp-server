import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { GetTemplateDetailArgs } from '../types/template.js';
import type { ToolContext } from './types.js';
import { loadTemplate } from '../utils/templateManager.js';

/**
 * プロンプトテンプレートの詳細を取得
 */
export async function getTemplateDetail(
  context: ToolContext,
  args: GetTemplateDetailArgs
) {
  const { template_name } = args;

  if (!template_name || typeof template_name !== 'string') {
    throw new McpError(
      ErrorCode.InvalidParams,
      'template_name is required and must be a string'
    );
  }

  try {
    const template = await loadTemplate(template_name);

    if (!template) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Template "${template_name}" not found`
      );
    }

    let responseText = `📝 Template: ${template.name}\n\n`;
    responseText += `Description: ${template.description}\n\n`;
    responseText += `Template:\n${template.template}\n\n`;
    responseText += `Variables: ${template.variables.length > 0 ? template.variables.join(', ') : 'none'}\n\n`;

    if (template.default_params && Object.keys(template.default_params).length > 0) {
      responseText += `Default Parameters:\n${JSON.stringify(template.default_params, null, 2)}\n\n`;
    }

    if (template.tags && template.tags.length > 0) {
      responseText += `Tags: ${template.tags.join(', ')}\n\n`;
    }

    if (template.created_at) {
      responseText += `Created: ${template.created_at}\n`;
    }

    if (template.updated_at) {
      responseText += `Updated: ${template.updated_at}\n`;
    }

    // 使用例を表示
    if (template.variables.length > 0) {
      responseText += `\n\n---\n\nUsage Example:\n\n`;
      responseText += `generate_from_template(\n`;
      responseText += `  template_name: "${template.name}",\n`;
      responseText += `  variable_values: {\n`;

      for (const varName of template.variables) {
        responseText += `    ${varName}: "your_value_here",\n`;
      }

      responseText += `  }\n`;
      responseText += `)`;
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
    if (error instanceof McpError) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get template details: ${errorMessage}`
    );
  }
}
