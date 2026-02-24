import { Worker, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import { computeMerkleRoot } from '@memstamp/core';
import { anchorToSolana } from './solana.js';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
}) as unknown as ConnectionOptions;

interface AnchorJobData {
  stampIds: string[];
  contentHashes: string[];
}

const worker = new Worker<AnchorJobData>(
  'anchor',
  async (job) => {
    console.log(`Processing anchor job: ${job.id}`);
    const { stampIds, contentHashes } = job.data;

    if (!contentHashes || contentHashes.length === 0) {
      throw new Error('No content hashes provided');
    }

    console.log(
      `Building Merkle tree from ${contentHashes.length} hashes for ${stampIds.length} stamps`
    );
    const merkleRoot = computeMerkleRoot(contentHashes);
    console.log(`Merkle root: ${merkleRoot}`);

    await job.updateProgress(50);

    console.log('Anchoring to Solana devnet...');
    const result = await anchorToSolana(merkleRoot, JSON.stringify({
      stamp_count: stampIds.length,
      job_id: job.id,
    }));

    console.log(`Anchored: tx=${result.txHash} slot=${result.slot}`);
    await job.updateProgress(100);

    return {
      merkleRoot,
      txHash: result.txHash,
      slot: result.slot,
      stampIds,
      anchoredAt: new Date().toISOString(),
    };
  },
  {
    connection,
    concurrency: 3,
  }
);

worker.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed: tx=${result.txHash}`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

console.log('memstamp worker started — listening for anchor jobs');
