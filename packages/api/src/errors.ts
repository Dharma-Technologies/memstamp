import type { FastifyReply } from 'fastify';

interface ProblemExtensions {
  errors?: string[];
  [key: string]: unknown;
}

/**
 * Send an RFC 7807 Problem Details response
 */
export function problemResponse(
  reply: FastifyReply,
  status: number,
  title: string,
  detail: string,
  extensions?: ProblemExtensions
): FastifyReply {
  return reply.status(status).header('content-type', 'application/problem+json').send({
    type: `https://memstamp.io/problems/${title.toLowerCase().replace(/\s+/g, '-')}`,
    title,
    status,
    detail,
    ...extensions,
  });
}
