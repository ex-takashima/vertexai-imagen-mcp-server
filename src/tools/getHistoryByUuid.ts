import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { GetHistoryByUuidArgs } from '../types/history.js';
import type { ToolContext } from './types.js';

export async function getHistoryByUuid(
  context: ToolContext,
  args: GetHistoryByUuidArgs
) {
  const { uuid } = args;

  const { historyDb } = context;

  if (!uuid || typeof uuid !== 'string') {
    throw new McpError(
      ErrorCode.InvalidParams,
      'uuid is required and must be a string'
    );
  }

  try {
    const record = historyDb.getImageHistory(uuid);

    if (!record) {
      return {
        content: [
          {
            type: 'text',
            text: `No image history found for UUID: ${uuid}`,
          },
        ],
      };
    }

    // パラメータをパース
    let parameters: any = {};
    try {
      parameters = JSON.parse(record.parameters);
    } catch (parseError) {
      console.error(`[WARNING] Failed to parse parameters for ${uuid}`);
    }

    let responseText = `Image History Details:\n\n`;
    responseText += `UUID: ${record.uuid}\n`;
    responseText += `Tool: ${record.toolName}\n`;
    responseText += `File Path: ${record.filePath}\n`;
    responseText += `Created: ${record.createdAt.toISOString()}\n\n`;

    responseText += `Prompt:\n${record.prompt}\n\n`;

    responseText += `Generation Parameters:\n`;
    responseText += `  Model: ${record.model || 'N/A'}\n`;
    if (record.aspectRatio) {
      responseText += `  Aspect Ratio: ${record.aspectRatio}\n`;
    }
    if (record.sampleCount) {
      responseText += `  Sample Count: ${record.sampleCount}\n`;
    }
    if (record.sampleImageSize) {
      responseText += `  Resolution: ${record.sampleImageSize}\n`;
    }
    if (record.safetyLevel) {
      responseText += `  Safety Level: ${record.safetyLevel}\n`;
    }
    if (record.personGeneration) {
      responseText += `  Person Generation: ${record.personGeneration}\n`;
    }
    if (record.language) {
      responseText += `  Language: ${record.language}\n`;
    }

    responseText += `\nFile Information:\n`;
    responseText += `  Size: ${record.fileSize || 'N/A'} bytes\n`;
    responseText += `  MIME Type: ${record.mimeType || 'N/A'}\n`;
    responseText += `  Success: ${record.success ? 'Yes' : 'No'}\n`;
    if (record.errorMessage) {
      responseText += `  Error: ${record.errorMessage}\n`;
    }

    responseText += `\nIntegrity:\n`;
    responseText += `  Parameters Hash: ${record.paramsHash.substring(0, 16)}...\n`;

    responseText += `\nFull Parameters (JSON):\n${JSON.stringify(parameters, null, 2)}`;

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
      `Failed to get image history: ${errorMessage}`
    );
  }
}
