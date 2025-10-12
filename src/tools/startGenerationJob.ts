import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { ToolContext } from './types.js';
import type { StartJobArgs } from '../types/job.js';

export async function startGenerationJob(
  context: ToolContext,
  args: StartJobArgs,
) {
  const { tool_type, params } = args;

  if (!tool_type) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'tool_type is required (generate|edit|customize|upscale|generate_and_upscale)',
    );
  }

  if (!params) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'params is required',
    );
  }

  const { jobManager } = context;

  try {
    const jobId = jobManager.createJob(tool_type, params);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Job created successfully!\n\nJob ID: ${jobId}\nType: ${tool_type}\nStatus: pending\n\nUse check_job_status to monitor progress and get_job_result to retrieve the output when completed.`,
        },
      ],
    };
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to create job: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
