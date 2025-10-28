#!/usr/bin/env node

/**
 * CLI バッチ処理エントリーポイント
 */

import { GoogleAuth } from 'google-auth-library';
import { JobDatabase } from './utils/database.js';
import { JobManager } from './utils/jobManager.js';
import { ImageResourceManager } from './utils/resources.js';
import { BatchProcessor } from './batch.js';
import { validateEnvironment } from './utils/envValidation.js';
import { getDefaultOutputDirectory } from './utils/path.js';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { version: PACKAGE_VERSION } = require('../package.json') as { version: string };

/**
 * ヘルプメッセージを表示
 */
function showHelp() {
  console.log(`
VertexAI Imagen Batch Image Generator v${PACKAGE_VERSION}

USAGE:
  vertexai-imagen-batch <batch-config.json> [OPTIONS]

OPTIONS:
  --output-dir <path>      Output directory for generated images
                           (default: VERTEXAI_IMAGEN_OUTPUT_DIR or ~/Downloads/vertexai-imagen-files)
  --format <text|json>     Output format (default: text)
  --timeout <ms>           Timeout in milliseconds (default: 600000)
  --help, -h               Show this help message
  --version, -v            Show version

BATCH CONFIG JSON FORMAT:
  {
    "jobs": [
      {
        "prompt": "A beautiful sunset",
        "output_filename": "sunset.png",
        "aspect_ratio": "16:9",
        "safety_level": "BLOCK_MEDIUM_AND_ABOVE",
        "person_generation": "ALLOW_ADULT"
      }
    ],
    "output_dir": "./output",  // Optional, overrides --output-dir
    "max_concurrent": 2,       // Optional, overrides VERTEXAI_IMAGEN_MAX_CONCURRENT_JOBS
    "timeout": 600000          // Optional, overrides --timeout
  }

ENVIRONMENT VARIABLES:
  GOOGLE_API_KEY                        Google Cloud API Key (required)
  GOOGLE_PROJECT_ID                     Google Cloud Project ID (required when using API key)
  GOOGLE_SERVICE_ACCOUNT_KEY            Service account key JSON (alternative to GOOGLE_API_KEY)
  VERTEXAI_IMAGEN_OUTPUT_DIR            Default output directory
  VERTEXAI_IMAGEN_MAX_CONCURRENT_JOBS   Max concurrent jobs (default: 2)
  VERTEXAI_IMAGEN_DB                    Database path
  DEBUG                                  Enable debug logging

EXAMPLES:
  # Basic usage
  vertexai-imagen-batch batch.json

  # Specify output directory
  vertexai-imagen-batch batch.json --output-dir ./my-images

  # JSON output format
  vertexai-imagen-batch batch.json --format json > result.json

  # Custom timeout
  vertexai-imagen-batch batch.json --timeout 1200000

For more information, visit:
https://github.com/ex-takashima/vertexai-imagen-mcp-server
`);
}

/**
 * バージョン情報を表示
 */
function showVersion() {
  console.log(`vertexai-imagen-batch v${PACKAGE_VERSION}`);
}

/**
 * コマンドライン引数を解析
 */
function parseArgs(args: string[]): {
  configPath?: string;
  outputDir?: string;
  format: 'text' | 'json';
  timeout?: number;
  help: boolean;
  version: boolean;
} {
  const result: {
    configPath?: string;
    outputDir?: string;
    format: 'text' | 'json';
    timeout?: number;
    help: boolean;
    version: boolean;
  } = {
    help: false,
    version: false,
    format: 'text' as 'text' | 'json',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--version' || arg === '-v') {
      result.version = true;
    } else if (arg === '--output-dir') {
      result.outputDir = args[++i];
    } else if (arg === '--format') {
      const format = args[++i];
      if (format !== 'text' && format !== 'json') {
        throw new Error(`Invalid format: ${format}. Must be 'text' or 'json'`);
      }
      result.format = format;
    } else if (arg === '--timeout') {
      result.timeout = parseInt(args[++i], 10);
      if (isNaN(result.timeout) || result.timeout <= 0) {
        throw new Error(`Invalid timeout: ${args[i]}. Must be a positive number`);
      }
    } else if (!arg.startsWith('-')) {
      result.configPath = arg;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return result;
}

/**
 * メイン処理
 */
async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));

    if (args.help) {
      showHelp();
      process.exit(0);
    }

    if (args.version) {
      showVersion();
      process.exit(0);
    }

    if (!args.configPath) {
      console.error('Error: Batch config file is required\n');
      showHelp();
      process.exit(1);
    }

    // 環境変数の検証
    console.error('[CLI] Validating environment variables...');
    validateEnvironment();

    // 出力ディレクトリの決定
    const outputDir = args.outputDir || getDefaultOutputDirectory();
    console.error(`[CLI] Output directory: ${outputDir}`);

    // データベース初期化
    const dbPath = process.env.VERTEXAI_IMAGEN_DB ||
      join(outputDir, 'data', 'vertexai-imagen.db');
    console.error(`[CLI] Database path: ${dbPath}`);
    const jobDatabase = new JobDatabase(dbPath);

    // Google認証
    console.error('[CLI] Initializing Google Auth...');
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    // リソースマネージャー初期化
    const resourceManager = new ImageResourceManager(outputDir);

    // ジョブマネージャー初期化
    const maxConcurrentJobs = parseInt(
      process.env.VERTEXAI_IMAGEN_MAX_CONCURRENT_JOBS || '2',
      10
    );
    console.error(`[CLI] Max concurrent jobs: ${maxConcurrentJobs}`);
    const jobManager = new JobManager(
      jobDatabase,
      auth,
      resourceManager,
      maxConcurrentJobs
    );

    // バッチプロセッサー初期化
    const batchProcessor = new BatchProcessor(
      jobManager,
      jobDatabase,
      outputDir
    );

    // バッチ設定読み込み
    console.error(`[CLI] Loading batch config from: ${args.configPath}`);
    const config = await batchProcessor.loadBatchConfig(args.configPath);

    // 設定のオーバーライド
    if (args.outputDir) {
      config.output_dir = args.outputDir;
    }
    if (args.timeout) {
      config.timeout = args.timeout;
    }

    // バッチ実行
    const result = await batchProcessor.executeBatch(config);

    // 結果出力
    if (args.format === 'json') {
      console.log(batchProcessor.formatResultAsJson(result));
    } else {
      console.log(batchProcessor.formatResultAsText(result));
    }

    // クリーンアップ
    console.error('[CLI] Cleaning up...');
    jobManager.destroy();
    jobDatabase.close();

    // 終了コード設定
    const exitCode = result.failed > 0 ? 1 : 0;
    process.exit(exitCode);

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

// グレースフルシャットダウン
process.on('SIGINT', () => {
  console.error('\n[CLI] Received SIGINT, shutting down...');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.error('\n[CLI] Received SIGTERM, shutting down...');
  process.exit(143);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
