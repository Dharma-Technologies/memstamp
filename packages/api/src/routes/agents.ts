import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { agents } from '../db/schema.js';
import { problemResponse } from '../errors.js';

interface RegisterAgentBody {
  id: string;
  public_key: string;
  framework: string;
}

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/v1/agents',
    async (
      request: FastifyRequest<{ Body: RegisterAgentBody }>,
      reply: FastifyReply
    ) => {
      const body = request.body;

      if (!body.id || !body.public_key || !body.framework) {
        return problemResponse(
          reply,
          422,
          'Validation Failed',
          'Missing required fields: id, public_key, framework'
        );
      }

      const [existing] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, body.id))
        .limit(1);

      if (existing) {
        return problemResponse(
          reply,
          409,
          'Conflict',
          `Agent ${body.id} is already registered`
        );
      }

      const [agent] = await db
        .insert(agents)
        .values({
          id: body.id,
          publicKey: body.public_key,
          framework: body.framework,
        })
        .returning();

      return reply.status(201).send({
        id: agent.id,
        public_key: agent.publicKey,
        framework: agent.framework,
        first_seen: agent.firstSeen.toISOString(),
        stamp_count: agent.stampCount,
      });
    }
  );
}
