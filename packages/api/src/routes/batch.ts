import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { computeMerkleRoot } from '@memstamp/core';
import { db } from '../db/index.js';
import { stamps, anchors } from '../db/schema.js';
import { config } from '../config.js';
import { problemResponse } from '../errors.js';

interface BatchAnchorBody {
  stamp_ids: string[];
}

export async function batchRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/v1/batch/anchor',
    async (
      request: FastifyRequest<{ Body: BatchAnchorBody }>,
      reply: FastifyReply
    ) => {
      const { stamp_ids } = request.body;

      if (!stamp_ids || stamp_ids.length === 0) {
        return problemResponse(
          reply,
          422,
          'Validation Failed',
          'stamp_ids array is required and must not be empty'
        );
      }

      const matchedStamps = await db
        .select()
        .from(stamps)
        .where(inArray(stamps.id, stamp_ids));

      if (matchedStamps.length === 0) {
        return problemResponse(
          reply,
          404,
          'Not Found',
          'No stamps found for the given IDs'
        );
      }

      const contentHashes = matchedStamps.map((s) => s.contentHash);
      const merkleRoot = computeMerkleRoot(contentHashes);

      const anchorId = randomUUID();
      const chain = config.defaultChain as 'solana' | 'base' | 'bitcoin';

      const [anchor] = await db
        .insert(anchors)
        .values({
          id: anchorId,
          merkleRoot,
          eventCount: matchedStamps.length,
          chain,
          status: 'pending',
        })
        .returning();

      await db
        .update(stamps)
        .set({
          merkleRoot,
          anchorId: anchor.id,
          status: 'anchored',
          updatedAt: new Date(),
        })
        .where(inArray(stamps.id, stamp_ids));

      return reply.status(202).send({
        anchor_id: anchor.id,
        merkle_root: anchor.merkleRoot,
        event_count: anchor.eventCount,
        chain: anchor.chain,
        status: anchor.status,
        stamp_ids: matchedStamps.map((s) => s.id),
      });
    }
  );
}
