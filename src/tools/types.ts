import type { GoogleAuth } from 'google-auth-library';
import type { ImageResourceManager } from '../utils/resources.js';
import type { JobManager } from '../utils/jobManager.js';
import type { JobDatabase } from '../utils/database.js';

export interface ToolContext {
  auth: GoogleAuth;
  resourceManager: ImageResourceManager;
  jobManager: JobManager;
  historyDb: JobDatabase;
}
