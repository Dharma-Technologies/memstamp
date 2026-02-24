// VCOT Schema validation

export const VCOT_SCHEMA_V1 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://github.com/Dharma-Technologies/memstamp/blob/main/schemas/vcot-v1.json',
  title: 'VCOT Event',
  type: 'object',
  required: [
    'version',
    'event_id',
    'event_type',
    'timestamp',
    'agent_id',
    'content_hash',
    'previous_hash',
    'framework',
    'signature',
  ],
  properties: {
    version: { const: 'vcot/0.1' },
    event_id: { type: 'string', format: 'uuid' },
    event_type: {
      type: 'string',
      enum: [
        'decision',
        'tool_call',
        'tool_result',
        'memory_write',
        'memory_read',
        'external_action',
        'state_change',
        'observation',
        'custom',
      ],
    },
    timestamp: { type: 'string', format: 'date-time' },
    agent_id: { type: 'string', minLength: 1 },
    content_hash: { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' },
    previous_hash: { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' },
    framework: { type: 'string', minLength: 1 },
    signature: { type: 'string', minLength: 1 },
    metadata: { type: 'object' },
  },
} as const;
