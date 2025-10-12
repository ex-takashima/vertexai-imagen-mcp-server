import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { ToolContext } from './types.js';
import type { GetJobResultArgs } from '../types/job.js';

export async function getJobResult(
  context: ToolContext,
  args: GetJobResultArgs,
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

    if (job.status === 'pending') {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Job is still pending. Current status: ${job.status}`,
      );
    }

    if (job.status === 'running') {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Job is still running. Current status: ${job.status}`,
      );
    }

    if (job.status === 'failed') {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Job failed: ${job.error || 'Unknown error'}`,
      );
    }

    if (!job.result) {
      throw new McpError(
        ErrorCode.InternalError,
        'Job completed but no result found',
      );
    }

    // 結果をフォーマット
    const resultInfo = [
      `Job completed successfully!`,
      `\nJob ID: ${job.id}`,
      `Type: ${job.type}`,
      `Completed: ${job.completedAt?.toISOString()}`,
      `\nResult:`,
    ];

    const result = job.result as any;

    if (result.outputPath) {
      resultInfo.push(`Output: ${result.outputPath}`);
      resultInfo.push(`URI: ${result.uri}`);
      resultInfo.push(`MIME Type: ${result.mimeType}`);
    } else if (result.outputPaths) {
      resultInfo.push(`Generated ${result.outputPaths.length} image(s):`);
      result.outputPaths.forEach((path: string, idx: number) => {
        resultInfo.push(`  ${idx + 1}. ${path}`);
      });
    } else if (result.message) {
      resultInfo.push(result.message);
    } else {
      resultInfo.push(JSON.stringify(result, null, 2));
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: resultInfo.join('\n'),
        },
      ],
    };
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get job result: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
