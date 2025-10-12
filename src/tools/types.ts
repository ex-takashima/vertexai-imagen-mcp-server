import type { GoogleAuth } from 'google-auth-library';
import type { ImageResourceManager } from '../utils/resources.js';
import type { JobManager } from '../utils/jobManager.js';

export interface ToolContext {
  auth: GoogleAuth;
  resourceManager: ImageResourceManager;
  jobManager: JobManager;
}
