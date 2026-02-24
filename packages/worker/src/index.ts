// @memstamp/worker — Background chain anchoring worker

import { Worker, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
}) as unknown as ConnectionOptions;

// Worker to process anchor jobs
const worker = new Worker(
  'anchor',
  async (job) => {
    console.log(`Processing anchor job: ${job.id}`);
    console.log(`Data:`, job.data);

    // Chain anchoring pipeline:
    // 1. Get pending stamps from batch
    // 2. Build Merkle tree from content hashes
    // 3. Submit Merkle root to blockchain (Solana/EVM/Bitcoin)
    // 4. Update stamp records with anchor tx info

    return { success: true, jobId: job.id };
  },
  { connection },
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

console.log('memstamp worker started');
