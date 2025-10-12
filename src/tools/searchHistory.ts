import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { SearchHistoryArgs } from '../types/history.js';
import type { ToolContext } from './types.js';

export async function searchHistory(
  context: ToolContext,
  args: SearchHistoryArgs
) {
  const {
    query,
    limit = 50,
    filters,
  } = args;

  const { historyDb } = context;

  if (!query || typeof query !== 'string') {
    throw new McpError(
      ErrorCode.InvalidParams,
      'query is required and must be a string'
    );
  }

  try {
    const records = historyDb.searchImageHistory(query, filters, limit);

    if (records.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No images found matching the search query: "${query}"`,
          },
        ],
      };
    }

    let responseText = `Found ${records.length} image(s) matching "${query}":\n\n`;

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
      responseText += '\n';
    }

    if (records.length === limit) {
      responseText += `\nShowing first ${limit} results. Refine your search query to see more specific results.`;
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
      `Failed to search image history: ${errorMessage}`
    );
  }
}
