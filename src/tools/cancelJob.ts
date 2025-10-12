import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { ToolContext } from './types.js';
import type { CancelJobArgs } from '../types/job.js';

export async function cancelJob(
  context: ToolContext,
  args: CancelJobArgs,
) {
  const { job_id } = args;

  if (!job_id) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'job_id is required',
    );
  }

  const { jobManager } = context;

  try {
    const success = jobManager.cancelJob(job_id);

    if (!success) {
      const job = jobManager.getJob(job_id);
      if (!job) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Job not found: ${job_id}`,
        );
      }

      throw new McpError(
        ErrorCode.InvalidRequest,
        `Cannot cancel job in ${job.status} status. Only pending and running jobs can be cancelled.`,
      );
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `Job ${job_id} has been cancelled successfully.`,
        },
      ],
    };
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to cancel job: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
