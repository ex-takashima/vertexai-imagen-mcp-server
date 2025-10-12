import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { ToolContext } from './types.js';
import type { CheckJobStatusArgs } from '../types/job.js';

export async function checkJobStatus(
  context: ToolContext,
  args: CheckJobStatusArgs,
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
    const job = jobManager.getJob(job_id);

    if (!job) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Job not found: ${job_id}`,
      );
    }

    const statusInfo = [
      `Job ID: ${job.id}`,
      `Type: ${job.type}`,
      `Status: ${job.status}`,
      `Created: ${job.createdAt.toISOString()}`,
    ];

    if (job.startedAt) {
      statusInfo.push(`Started: ${job.startedAt.toISOString()}`);
    }

    if (job.completedAt) {
      statusInfo.push(`Completed: ${job.completedAt.toISOString()}`);
    }

    if (job.error) {
      statusInfo.push(`Error: ${job.error}`);
    }

    if (job.status === 'completed') {
      statusInfo.push('\nJob completed successfully! Use get_job_result to retrieve the output.');
    } else if (job.status === 'running') {
      statusInfo.push('\nJob is currently running...');
    } else if (job.status === 'pending') {
      statusInfo.push('\nJob is pending execution...');
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: statusInfo.join('\n'),
        },
      ],
    };
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to check job status: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
