import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { validateVCOTEvent, computeEventHash } from '@memstamp/core';
import { db } from '../db/index.js';
import { stamps, agents, anchors } from '../db/schema.js';
import { problemResponse } from '../errors.js';

interface CreateStampBody {
  version: string;
  event_id: string;
  event_type: string;
  timestamp: string;
  agent_id: string;
  content_hash: string;
  previous_hash: string;
  framework: string;
  signature: string;
  metadata?: Record<string, unknown>;
}

interface ListStampsQuery {
  limit?: string;
  offset?: string;
  agent_id?: string;
}

export async function stampRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/v1/stamps',
    async (
      request: FastifyRequest<{ Body: CreateStampBody }>,
      reply: FastifyReply
    ) => {
      const body = request.body;

      const validation = validateVCOTEvent(body);
      if (!validation.valid) {
        return problemResponse(reply, 422, 'Validation Failed', 'Event does not conform to VCOT schema', {
          errors: validation.errors,
        });
      }

      const id = randomUUID();

      const [stamp] = await db
        .insert(stamps)
        .values({
          id,
          eventId: body.event_id,
          eventType: body.event_type,
          agentId: body.agent_id,
          contentHash: body.content_hash,
          previousHash: body.previous_hash,
          framework: body.framework,
          signature: body.signature,
          metadata: body.metadata ?? null,
          status: 'pending',
        })
        .returning();

      await db
        .update(agents)
        .set({
          lastSeen: new Date(),
          stampCount: sql`${agents.stampCount} + 1`,
        })
        .where(eq(agents.id, body.agent_id));

      return reply.status(201).send({
        id: stamp.id,
        event_id: stamp.eventId,
        event_type: stamp.eventType,
        agent_id: stamp.agentId,
        content_hash: stamp.contentHash,
        previous_hash: stamp.previousHash,
        framework: stamp.framework,
        signature: stamp.signature,
        metadata: stamp.metadata,
        status: stamp.status,
        created_at: stamp.createdAt.toISOString(),
      });
    }
  );

  app.get(
    '/v1/stamps',
    async (
      request: FastifyRequest<{ Querystring: ListStampsQuery }>,
      reply: FastifyReply
    ) => {
      const limit = Math.min(
        Math.max(parseInt(request.query.limit ?? '50', 10) || 50, 1),
        1000
      );
      const offset = Math.max(
        parseInt(request.query.offset ?? '0', 10) || 0,
        0
      );
      const agentId = request.query.agent_id;

      const conditions = agentId ? eq(stamps.agentId, agentId) : undefined;

      const results = await db
        .select()
        .from(stamps)
        .where(conditions)
        .orderBy(desc(stamps.createdAt))
        .limit(limit)
        .offset(offset);

      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(stamps)
        .where(conditions);

      return reply.send({
        data: results.map(formatStamp),
        pagination: {
          limit,
          offset,
          total: countResult.count,
        },
      });
    }
  );

  app.get(
    '/v1/stamps/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const [stamp] = await db
        .select()
        .from(stamps)
        .where(eq(stamps.id, request.params.id))
        .limit(1);

      if (!stamp) {
        return problemResponse(reply, 404, 'Not Found', `Stamp ${request.params.id} not found`);
      }

      return reply.send(formatStamp(stamp));
    }
  );

  app.get(
    '/v1/stamps/:id/verify',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const [stamp] = await db
        .select()
        .from(stamps)
        .where(eq(stamps.id, request.params.id))
        .limit(1);

      if (!stamp) {
        return problemResponse(reply, 404, 'Not Found', `Stamp ${request.params.id} not found`);
      }

      const eventHash = computeEventHash(
        stamp.eventId,
        stamp.eventType,
        stamp.createdAt.toISOString(),
        stamp.agentId,
        stamp.contentHash,
        stamp.previousHash
      );

      let chainValid = true;
      if (stamp.previousHash !== 'sha256:' + '0'.repeat(64)) {
        const [previousStamp] = await db
          .select()
          .from(stamps)
          .where(eq(stamps.contentHash, stamp.previousHash))
          .limit(1);

        if (!previousStamp) {
          chainValid = false;
        }
      }

      let anchorRecord = null;
      if (stamp.anchorId) {
        const [anchor] = await db
          .select()
          .from(anchors)
          .where(eq(anchors.id, stamp.anchorId))
          .limit(1);

        if (anchor) {
          anchorRecord = {
            id: anchor.id,
            merkle_root: anchor.merkleRoot,
            chain: anchor.chain,
            tx_hash: anchor.txHash,
            block_number: anchor.blockNumber,
            status: anchor.status,
          };
        }
      }

      return reply.send({
        verified: chainValid,
        stamp_id: stamp.id,
        event_id: stamp.eventId,
        event_hash: eventHash,
        content_hash: stamp.contentHash,
        chain_valid: chainValid,
        anchor: anchorRecord,
        status: stamp.status,
      });
    }
  );
}

function formatStamp(stamp: typeof stamps.$inferSelect) {
  return {
    id: stamp.id,
    event_id: stamp.eventId,
    event_type: stamp.eventType,
    agent_id: stamp.agentId,
    content_hash: stamp.contentHash,
    previous_hash: stamp.previousHash,
    framework: stamp.framework,
    signature: stamp.signature,
    metadata: stamp.metadata,
    merkle_root: stamp.merkleRoot,
    anchor_id: stamp.anchorId,
    status: stamp.status,
    created_at: stamp.createdAt.toISOString(),
    updated_at: stamp.updatedAt.toISOString(),
  };
}
