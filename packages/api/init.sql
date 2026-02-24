-- memstamp database schema

DO $$ BEGIN
  CREATE TYPE stamp_status AS ENUM ('pending', 'anchored', 'verified');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE anchor_status AS ENUM ('pending', 'submitted', 'confirmed', 'finalized');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE chain AS ENUM ('solana', 'base', 'bitcoin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS stamps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  content_hash VARCHAR(128) NOT NULL,
  previous_hash VARCHAR(128) NOT NULL,
  framework VARCHAR(128) NOT NULL,
  signature TEXT NOT NULL,
  metadata JSONB,
  merkle_root VARCHAR(128),
  anchor_id UUID,
  status stamp_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merkle_root VARCHAR(128) NOT NULL,
  event_count INTEGER NOT NULL,
  chain chain NOT NULL,
  tx_hash VARCHAR(128),
  block_number INTEGER,
  status anchor_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agents (
  id VARCHAR(255) PRIMARY KEY,
  public_key TEXT NOT NULL,
  framework VARCHAR(128) NOT NULL,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stamp_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_stamps_agent_id ON stamps(agent_id);
CREATE INDEX IF NOT EXISTS idx_stamps_content_hash ON stamps(content_hash);
CREATE INDEX IF NOT EXISTS idx_stamps_status ON stamps(status);
CREATE INDEX IF NOT EXISTS idx_stamps_created_at ON stamps(created_at DESC);
