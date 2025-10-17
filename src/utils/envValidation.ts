/**
 * Environment variable validation utilities
 * Validates configuration on server startup to catch issues early
 */

import { z } from 'zod';

/**
 * Environment variable schema
 * Note: All environment variables are optional strings from process.env,
 * but we validate the business logic requirements
 */
const EnvSchema = z.object({
  // Authentication (at least one required)
  GOOGLE_SERVICE_ACCOUNT_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  GOOGLE_PROJECT_ID: z.string().optional(),

  // Optional configuration with defaults
  GOOGLE_REGION: z.string().optional(),
  GOOGLE_IMAGEN_MODEL: z.string().optional(),
  GOOGLE_IMAGEN_UPSCALE_MODEL: z.string().optional(),
  GOOGLE_IMAGEN_EDIT_MODEL: z.string().optional(),

  // Storage configuration
  VERTEXAI_IMAGEN_OUTPUT_DIR: z.string().optional(),
  VERTEXAI_IMAGEN_DB: z.string().optional(),

  // Thumbnail settings
  VERTEXAI_IMAGEN_THUMBNAIL: z.enum(['true', 'false']).optional(),
  VERTEXAI_IMAGEN_THUMBNAIL_SIZE: z.string().regex(/^\d+$/).optional(),
  VERTEXAI_IMAGEN_THUMBNAIL_QUALITY: z.string().regex(/^\d+$/).optional(),

  // Metadata settings
  VERTEXAI_IMAGEN_EMBED_METADATA: z.enum(['true', 'false']).optional(),
  VERTEXAI_IMAGEN_METADATA_LEVEL: z.enum(['minimal', 'standard', 'full']).optional(),

  // Template settings
  VERTEXAI_IMAGEN_TEMPLATES_DIR: z.string().optional(),

  // Job management
  VERTEXAI_IMAGEN_MAX_CONCURRENT_JOBS: z.string().regex(/^\d+$/).optional(),

  // Rate limiting
  VERTEXAI_RATE_LIMIT_MAX_CALLS: z.string().regex(/^\d+$/).optional(),
  VERTEXAI_RATE_LIMIT_WINDOW_MS: z.string().regex(/^\d+$/).optional(),

  // Debug mode
  DEBUG: z.string().optional(),
}).refine(
  (data) => {
    // Must have at least one authentication method
    return !!(data.GOOGLE_SERVICE_ACCOUNT_KEY || data.GOOGLE_API_KEY || data.GOOGLE_APPLICATION_CREDENTIALS);
  },
  {
    message: 'At least one authentication method must be set: GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_API_KEY, or GOOGLE_APPLICATION_CREDENTIALS',
    path: ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  }
).refine(
  (data) => {
    // If using API key auth, GOOGLE_PROJECT_ID is required
    if (data.GOOGLE_API_KEY && !data.GOOGLE_SERVICE_ACCOUNT_KEY) {
      return !!data.GOOGLE_PROJECT_ID;
    }
    return true;
  },
  {
    message: 'GOOGLE_PROJECT_ID is required when using GOOGLE_API_KEY authentication',
    path: ['GOOGLE_PROJECT_ID'],
  }
).refine(
  (data) => {
    // Validate GOOGLE_SERVICE_ACCOUNT_KEY is valid JSON if provided
    if (data.GOOGLE_SERVICE_ACCOUNT_KEY) {
      try {
        JSON.parse(data.GOOGLE_SERVICE_ACCOUNT_KEY);
        return true;
      } catch {
        return false;
      }
    }
    return true;
  },
  {
    message: 'GOOGLE_SERVICE_ACCOUNT_KEY must be valid JSON',
    path: ['GOOGLE_SERVICE_ACCOUNT_KEY'],
  }
).refine(
  (data) => {
    // Validate thumbnail size is reasonable (0-1000)
    if (data.VERTEXAI_IMAGEN_THUMBNAIL_SIZE) {
      const size = parseInt(data.VERTEXAI_IMAGEN_THUMBNAIL_SIZE, 10);
      return size >= 0 && size <= 1000;
    }
    return true;
  },
  {
    message: 'VERTEXAI_IMAGEN_THUMBNAIL_SIZE must be between 0 and 1000',
    path: ['VERTEXAI_IMAGEN_THUMBNAIL_SIZE'],
  }
).refine(
  (data) => {
    // Validate thumbnail quality is 0-100
    if (data.VERTEXAI_IMAGEN_THUMBNAIL_QUALITY) {
      const quality = parseInt(data.VERTEXAI_IMAGEN_THUMBNAIL_QUALITY, 10);
      return quality >= 0 && quality <= 100;
    }
    return true;
  },
  {
    message: 'VERTEXAI_IMAGEN_THUMBNAIL_QUALITY must be between 0 and 100',
    path: ['VERTEXAI_IMAGEN_THUMBNAIL_QUALITY'],
  }
).refine(
  (data) => {
    // Validate max concurrent jobs is reasonable (1-10)
    if (data.VERTEXAI_IMAGEN_MAX_CONCURRENT_JOBS) {
      const jobs = parseInt(data.VERTEXAI_IMAGEN_MAX_CONCURRENT_JOBS, 10);
      return jobs >= 1 && jobs <= 10;
    }
    return true;
  },
  {
    message: 'VERTEXAI_IMAGEN_MAX_CONCURRENT_JOBS must be between 1 and 10',
    path: ['VERTEXAI_IMAGEN_MAX_CONCURRENT_JOBS'],
  }
).refine(
  (data) => {
    // Validate rate limit max calls is reasonable (1-1000)
    if (data.VERTEXAI_RATE_LIMIT_MAX_CALLS) {
      const calls = parseInt(data.VERTEXAI_RATE_LIMIT_MAX_CALLS, 10);
      return calls >= 1 && calls <= 1000;
    }
    return true;
  },
  {
    message: 'VERTEXAI_RATE_LIMIT_MAX_CALLS must be between 1 and 1000',
    path: ['VERTEXAI_RATE_LIMIT_MAX_CALLS'],
  }
).refine(
  (data) => {
    // Validate rate limit window is reasonable (1000-3600000 = 1s to 1 hour)
    if (data.VERTEXAI_RATE_LIMIT_WINDOW_MS) {
      const ms = parseInt(data.VERTEXAI_RATE_LIMIT_WINDOW_MS, 10);
      return ms >= 1000 && ms <= 3600000;
    }
    return true;
  },
  {
    message: 'VERTEXAI_RATE_LIMIT_WINDOW_MS must be between 1000 and 3600000 (1 second to 1 hour)',
    path: ['VERTEXAI_RATE_LIMIT_WINDOW_MS'],
  }
);

/**
 * Validation error with helpful messages
 */
export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvValidationError';
  }
}

/**
 * Validate environment variables on startup
 * Throws EnvValidationError with helpful messages if validation fails
 */
export function validateEnvironment(): void {
  const env = {
    GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    GOOGLE_PROJECT_ID: process.env.GOOGLE_PROJECT_ID,
    GOOGLE_REGION: process.env.GOOGLE_REGION,
    GOOGLE_IMAGEN_MODEL: process.env.GOOGLE_IMAGEN_MODEL,
    GOOGLE_IMAGEN_UPSCALE_MODEL: process.env.GOOGLE_IMAGEN_UPSCALE_MODEL,
    GOOGLE_IMAGEN_EDIT_MODEL: process.env.GOOGLE_IMAGEN_EDIT_MODEL,
    VERTEXAI_IMAGEN_OUTPUT_DIR: process.env.VERTEXAI_IMAGEN_OUTPUT_DIR,
    VERTEXAI_IMAGEN_DB: process.env.VERTEXAI_IMAGEN_DB,
    VERTEXAI_IMAGEN_THUMBNAIL: process.env.VERTEXAI_IMAGEN_THUMBNAIL,
    VERTEXAI_IMAGEN_THUMBNAIL_SIZE: process.env.VERTEXAI_IMAGEN_THUMBNAIL_SIZE,
    VERTEXAI_IMAGEN_THUMBNAIL_QUALITY: process.env.VERTEXAI_IMAGEN_THUMBNAIL_QUALITY,
    VERTEXAI_IMAGEN_EMBED_METADATA: process.env.VERTEXAI_IMAGEN_EMBED_METADATA,
    VERTEXAI_IMAGEN_METADATA_LEVEL: process.env.VERTEXAI_IMAGEN_METADATA_LEVEL,
    VERTEXAI_IMAGEN_TEMPLATES_DIR: process.env.VERTEXAI_IMAGEN_TEMPLATES_DIR,
    VERTEXAI_IMAGEN_MAX_CONCURRENT_JOBS: process.env.VERTEXAI_IMAGEN_MAX_CONCURRENT_JOBS,
    VERTEXAI_RATE_LIMIT_MAX_CALLS: process.env.VERTEXAI_RATE_LIMIT_MAX_CALLS,
    VERTEXAI_RATE_LIMIT_WINDOW_MS: process.env.VERTEXAI_RATE_LIMIT_WINDOW_MS,
    DEBUG: process.env.DEBUG,
  };

  const result = EnvSchema.safeParse(env);

  if (!result.success) {
    const errors = result.error.issues.map((issue: any) => {
      const path = issue.path.join('.');
      return `  - ${path}: ${issue.message}`;
    });

    const errorMessage = [
      'Environment variable validation failed:',
      ...errors,
      '',
      'When using this MCP server with Claude Desktop or other MCP clients,',
      'you need to set environment variables in the MCP configuration file.',
      '',
      'For Claude Desktop on Windows:',
      '  Edit: %APPDATA%\\Claude\\claude_desktop_config.json',
      '',
      'For Claude Desktop on macOS:',
      '  Edit: ~/Library/Application Support/Claude/claude_desktop_config.json',
      '',
      'Example configuration (API Key):',
      '  {',
      '    "mcpServers": {',
      '      "vertexai-imagen": {',
      '        "command": "npx",',
      '        "args": ["-y", "@dondonudonjp/vertexai-imagen-mcp-server"],',
      '        "env": {',
      '          "GOOGLE_API_KEY": "your-api-key-here",',
      '          "GOOGLE_PROJECT_ID": "your-project-id"',
      '        }',
      '      }',
      '    }',
      '  }',
      '',
      'Example configuration (Service Account File):',
      '  {',
      '    "mcpServers": {',
      '      "vertexai-imagen": {',
      '        "command": "vertexai-imagen-mcp-server",',
      '        "env": {',
      '          "GOOGLE_APPLICATION_CREDENTIALS": "C:\\\\path\\\\to\\\\service-account.json",',
      '          "GOOGLE_PROJECT_ID": "your-project-id"',
      '        }',
      '      }',
      '    }',
      '  }',
      '',
      'See README.md for complete setup instructions.',
    ].join('\n');

    throw new EnvValidationError(errorMessage);
  }

  if (process.env.DEBUG) {
    console.error('[DEBUG] Environment validation passed');
    const authMode = env.GOOGLE_API_KEY
      ? 'API Key'
      : env.GOOGLE_SERVICE_ACCOUNT_KEY
        ? 'Service Account (JSON)'
        : 'Service Account (File)';
    console.error(`[DEBUG] Auth mode: ${authMode}`);
    if (env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.error(`[DEBUG] Credentials file: ${env.GOOGLE_APPLICATION_CREDENTIALS}`);
    }
    console.error(`[DEBUG] Project ID: ${env.GOOGLE_PROJECT_ID || '(auto-detect)'}`);
    console.error(`[DEBUG] Region: ${env.GOOGLE_REGION || 'us-central1'}`);
    console.error(`[DEBUG] Rate limit: ${env.VERTEXAI_RATE_LIMIT_MAX_CALLS || '60'} calls per ${env.VERTEXAI_RATE_LIMIT_WINDOW_MS || '60000'}ms`);
    console.error(`[DEBUG] Max concurrent jobs: ${env.VERTEXAI_IMAGEN_MAX_CONCURRENT_JOBS || '2'}`);
    console.error(`[DEBUG] Metadata embedding: ${env.VERTEXAI_IMAGEN_EMBED_METADATA || 'true'}`);
    console.error(`[DEBUG] Thumbnail generation: ${env.VERTEXAI_IMAGEN_THUMBNAIL || 'false'}`);
  }
}
