import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const stampStatusEnum = pgEnum('stamp_status', [
  'pending',
  'anchored',
  'verified',
]);

export const anchorStatusEnum = pgEnum('anchor_status', [
  'pending',
  'submitted',
  'confirmed',
  'finalized',
]);

export const chainEnum = pgEnum('chain', ['solana', 'base', 'bitcoin']);

export const stamps = pgTable('stamps', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: varchar('event_id', { length: 255 }).notNull(),
  eventType: varchar('event_type', { length: 64 }).notNull(),
  agentId: varchar('agent_id', { length: 255 }).notNull(),
  contentHash: varchar('content_hash', { length: 128 }).notNull(),
  previousHash: varchar('previous_hash', { length: 128 }).notNull(),
  framework: varchar('framework', { length: 128 }).notNull(),
  signature: text('signature').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  merkleRoot: varchar('merkle_root', { length: 128 }),
  anchorId: uuid('anchor_id'),
  status: stampStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const anchors = pgTable('anchors', {
  id: uuid('id').primaryKey().defaultRandom(),
  merkleRoot: varchar('merkle_root', { length: 128 }).notNull(),
  eventCount: integer('event_count').notNull(),
  chain: chainEnum('chain').notNull(),
  txHash: varchar('tx_hash', { length: 128 }),
  blockNumber: integer('block_number'),
  status: anchorStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
});

export const agents = pgTable('agents', {
  id: varchar('id', { length: 255 }).primaryKey(),
  publicKey: text('public_key').notNull(),
  framework: varchar('framework', { length: 128 }).notNull(),
  firstSeen: timestamp('first_seen', { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeen: timestamp('last_seen', { withTimezone: true })
    .notNull()
    .defaultNow(),
  stampCount: integer('stamp_count').notNull().default(0),
});

export type Stamp = typeof stamps.$inferSelect;
export type NewStamp = typeof stamps.$inferInsert;
export type Anchor = typeof anchors.$inferSelect;
export type NewAnchor = typeof anchors.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
