import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { ToolContext } from './types.js';
import type { ListJobsArgs } from '../types/job.js';

export async function listJobs(
  context: ToolContext,
  args: ListJobsArgs,
) {
  const { status, limit = 50 } = args;

  const { jobManager } = context;

  try {
    const jobs = jobManager.listJobs(status, limit);

    if (jobs.length === 0) {
      const statusFilter = status ? ` with status '${status}'` : '';
      return {
        content: [
          {
            type: 'text' as const,
            text: `No jobs found${statusFilter}.`,
          },
        ],
      };
    }

    const jobsList = ['Jobs:\n'];

    jobs.forEach((job, idx) => {
      jobsList.push(`${idx + 1}. Job ID: ${job.id}`);
      jobsList.push(`   Type: ${job.type}`);
      jobsList.push(`   Status: ${job.status}`);
      jobsList.push(`   Created: ${job.createdAt.toISOString()}`);

      if (job.startedAt) {
        jobsList.push(`   Started: ${job.startedAt.toISOString()}`);
      }

      if (job.completedAt) {
        jobsList.push(`   Completed: ${job.completedAt.toISOString()}`);
      }

      if (job.error) {
        jobsList.push(`   Error: ${job.error}`);
      }

      jobsList.push('');
    });

    jobsList.push(`Total: ${jobs.length} job(s)`);

    if (status) {
      jobsList.push(`Filter: status = ${status}`);
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: jobsList.join('\n'),
        },
      ],
    };
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to list jobs: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
