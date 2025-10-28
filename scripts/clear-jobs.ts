#!/usr/bin/env node
/**
 * データベース内の古いジョブをクリアするスクリプト
 */

import { JobDatabase } from '../src/utils/database.js';
import { getDefaultOutputDirectory } from '../src/utils/path.js';
import { join } from 'path';

const outputDir = process.env.VERTEXAI_IMAGEN_OUTPUT_DIR || getDefaultOutputDirectory();
const dbPath = process.env.VERTEXAI_IMAGEN_DB || join(outputDir, 'data', 'vertexai-imagen.db');

console.log(`Database path: ${dbPath}`);

const db = new JobDatabase(dbPath);

// 全てのジョブを取得
const allJobs = db.listJobs(undefined, 1000);
const pendingJobs = db.listJobs('pending', 1000);
const runningJobs = db.listJobs('running', 1000);
const failedJobs = db.listJobs('failed', 1000);
const completedJobs = db.listJobs('completed', 1000);

console.log('\n=== Current Job Status ===');
console.log(`Total jobs: ${allJobs.length}`);
console.log(`Pending: ${pendingJobs.length}`);
console.log(`Running: ${runningJobs.length}`);
console.log(`Failed: ${failedJobs.length}`);
console.log(`Completed: ${completedJobs.length}`);

// 最近のジョブを表示
console.log('\n=== Recent Jobs (last 10) ===');
allJobs.slice(0, 10).forEach((job, i) => {
  console.log(`${i + 1}. [${job.status}] ${job.id} - ${job.type} - ${job.createdAt.toISOString()}`);
  if (job.error) {
    console.log(`   Error: ${job.error.substring(0, 100)}`);
  }
});

// クリーンアップオプション
const args = process.argv.slice(2);

if (args.includes('--clear-pending')) {
  console.log('\n=== Clearing pending jobs ===');
  db.transaction(() => {
    pendingJobs.forEach(job => {
      db.updateJobError(job.id, 'Cleared by admin');
    });
  });
  console.log(`Cleared ${pendingJobs.length} pending jobs`);
}

if (args.includes('--clear-running')) {
  console.log('\n=== Clearing running jobs ===');
  db.transaction(() => {
    runningJobs.forEach(job => {
      db.updateJobError(job.id, 'Cleared by admin');
    });
  });
  console.log(`Cleared ${runningJobs.length} running jobs`);
}

if (args.includes('--clear-all')) {
  console.log('\n=== Clearing ALL jobs ===');
  const clearedCount = allJobs.length;
  db.transaction(() => {
    allJobs.forEach(job => {
      if (job.status === 'pending' || job.status === 'running') {
        db.updateJobError(job.id, 'Cleared by admin');
      }
    });
  });
  console.log(`Cleared all pending/running jobs (${clearedCount} total)`);
}

if (args.length === 0) {
  console.log('\n=== Usage ===');
  console.log('npm run clear-jobs               # Show job status');
  console.log('npm run clear-jobs --clear-pending  # Clear pending jobs');
  console.log('npm run clear-jobs --clear-running  # Clear running jobs');
  console.log('npm run clear-jobs --clear-all      # Clear all pending/running jobs');
}

db.close();
