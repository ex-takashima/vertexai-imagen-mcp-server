import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { ListPromptTemplatesArgs } from '../types/template.js';
import type { ToolContext } from './types.js';
import { listTemplates } from '../utils/templateManager.js';

/**
 * プロンプトテンプレート一覧を取得
 */
export async function listPromptTemplates(
  context: ToolContext,
  args: ListPromptTemplatesArgs
) {
  const { tags, search } = args;

  try {
    const templates = await listTemplates({ tags, search });

    if (templates.length === 0) {
      let message = 'No templates found';

      if (tags && tags.length > 0) {
        message += ` with tags: ${tags.join(', ')}`;
      }

      if (search) {
        message += ` matching search: "${search}"`;
      }

      return {
        content: [
          {
            type: 'text',
            text: message + '.\n\nUse save_prompt_template to create a new template.',
          },
        ],
      };
    }

    let responseText = `Found ${templates.length} template(s):\n\n`;

    for (const template of templates) {
      responseText += `📝 ${template.name}\n`;
      responseText += `   Description: ${template.description}\n`;
      responseText += `   Variables: ${template.variables.length > 0 ? template.variables.join(', ') : 'none'}\n`;

      if (template.tags && template.tags.length > 0) {
        responseText += `   Tags: ${template.tags.join(', ')}\n`;
      }

      if (template.default_params && Object.keys(template.default_params).length > 0) {
        const paramKeys = Object.keys(template.default_params);
        responseText += `   Default Params: ${paramKeys.join(', ')}\n`;
      }

      if (template.created_at) {
        responseText += `   Created: ${template.created_at}\n`;
      }

      responseText += '\n';
    }

    responseText += 'Use get_template_detail to view full template details.';

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
      `Failed to list templates: ${errorMessage}`
    );
  }
}
