import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { ListHistoryArgs } from '../types/history.js';
import type { ToolContext } from './types.js';

export async function listHistory(
  context: ToolContext,
  args: ListHistoryArgs
) {
  const {
    filters,
    sort_by = 'created_at',
    sort_order = 'desc',
    limit = 50,
    offset = 0,
  } = args;

  const { historyDb } = context;

  try {
    const records = historyDb.listImageHistory(
      filters,
      sort_by,
      sort_order,
      limit,
      offset
    );

    if (records.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No image history found matching the specified filters.',
          },
        ],
      };
    }

    let responseText = `Found ${records.length} image(s) in history:\n\n`;

    for (const record of records) {
      responseText += `UUID: ${record.uuid}\n`;
      responseText += `  Tool: ${record.toolName}\n`;
      responseText += `  Prompt: ${record.prompt.substring(0, 80)}${record.prompt.length > 80 ? '...' : ''}\n`;
      responseText += `  Model: ${record.model || 'N/A'}\n`;
      responseText += `  Created: ${record.createdAt.toISOString()}\n`;
      responseText += `  File: ${record.filePath}\n`;
      if (record.aspectRatio) {
        responseText += `  Aspect Ratio: ${record.aspectRatio}\n`;
      }
      if (record.sampleImageSize) {
        responseText += `  Resolution: ${record.sampleImageSize}\n`;
      }
      responseText += `  File Size: ${record.fileSize || 'N/A'} bytes\n`;
      responseText += `  Success: ${record.success ? 'Yes' : 'No'}\n`;
      if (record.errorMessage) {
        responseText += `  Error: ${record.errorMessage}\n`;
      }
      responseText += '\n';
    }

    if (records.length === limit) {
      responseText += `\nShowing first ${limit} results. Use offset parameter to see more.`;
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
      `Failed to list image history: ${errorMessage}`
    );
  }
}
