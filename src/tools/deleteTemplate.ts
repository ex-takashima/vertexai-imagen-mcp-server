import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { DeleteTemplateArgs } from '../types/template.js';
import type { ToolContext } from './types.js';
import { deleteTemplate as deleteTemplateUtil } from '../utils/templateManager.js';

/**
 * プロンプトテンプレートを削除
 */
export async function deleteTemplate(
  context: ToolContext,
  args: DeleteTemplateArgs
) {
  const { template_name } = args;

  if (!template_name || typeof template_name !== 'string') {
    throw new McpError(
      ErrorCode.InvalidParams,
      'template_name is required and must be a string'
    );
  }

  try {
    const deleted = await deleteTemplateUtil(template_name);

    if (!deleted) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Template "${template_name}" not found`
      );
    }

    return {
      content: [
        {
          type: 'text',
          text: `✓ Template "${template_name}" deleted successfully`,
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
      `Failed to delete template: ${errorMessage}`
    );
  }
}
