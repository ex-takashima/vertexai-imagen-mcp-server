import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { UpdateTemplateArgs } from '../types/template.js';
import type { ToolContext } from './types.js';
import { updateTemplate as updateTemplateUtil } from '../utils/templateManager.js';

/**
 * プロンプトテンプレートを更新
 */
export async function updateTemplate(
  context: ToolContext,
  args: UpdateTemplateArgs
) {
  const { template_name, description, template, variables, default_params, tags } = args;

  if (!template_name || typeof template_name !== 'string') {
    throw new McpError(
      ErrorCode.InvalidParams,
      'template_name is required and must be a string'
    );
  }

  // 少なくとも1つの更新フィールドが必要
  if (!description && !template && !variables && !default_params && !tags) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'At least one field must be provided for update'
    );
  }

  try {
    // 更新するフィールドを集約
    const updates: any = {};

    if (description !== undefined) updates.description = description;
    if (template !== undefined) updates.template = template;
    if (variables !== undefined) updates.variables = variables;
    if (default_params !== undefined) updates.default_params = default_params;
    if (tags !== undefined) updates.tags = tags;

    const updated = await updateTemplateUtil(template_name, updates);

    let responseText = `✓ Template "${template_name}" updated successfully\n\n`;
    responseText += `Description: ${updated.description}\n`;
    responseText += `Template: ${updated.template}\n`;
    responseText += `Variables: ${updated.variables.length > 0 ? updated.variables.join(', ') : 'none'}\n`;

    if (updated.default_params && Object.keys(updated.default_params).length > 0) {
      responseText += `Default Parameters:\n${JSON.stringify(updated.default_params, null, 2)}\n`;
    }

    if (updated.tags && updated.tags.length > 0) {
      responseText += `Tags: ${updated.tags.join(', ')}\n`;
    }

    responseText += `\nUpdated: ${updated.updated_at}`;

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
      `Failed to update template: ${errorMessage}`
    );
  }
}
