import {
  createVCOTEvent,
  generateKeyPair,
  GENESIS_HASH,
  validateVCOTEvent,
} from '@memstamp/core';
import type { VCOTEvent, VCOTEventType } from '@memstamp/core';

const API_BASE = process.env.API_URL ?? 'http://localhost:8010';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function log(color: string, prefix: string, msg: string): void {
  console.log(`${color}${BOLD}[${prefix}]${RESET} ${msg}`);
}

function ok(msg: string): void {
  log(GREEN, '✓', msg);
}
function fail(msg: string): void {
  log(RED, '✗', msg);
}
function info(msg: string): void {
  log(CYAN, '→', msg);
}
function warn(msg: string): void {
  log(YELLOW, '!', msg);
}

async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: T }> {
  const url = `${API_BASE}${path}`;
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) {
    opts.body = JSON.stringify(body);
  }
  const response = await fetch(url, opts);
  const data = (await response.json()) as T;
  return { status: response.status, data };
}

async function main(): Promise<void> {
  console.log(`\n${BOLD}${CYAN}╔══════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${CYAN}║   memstamp End-to-End Live Test     ║${RESET}`);
  console.log(`${BOLD}${CYAN}╚══════════════════════════════════════╝${RESET}\n`);

  info(`API: ${API_BASE}`);

  // Health check
  info('Checking API health...');
  try {
    const health = await apiRequest<{ status: string }>('GET', '/health');
    if (health.data.status === 'ok') {
      ok('API is healthy');
    } else {
      fail(`Unexpected health response: ${JSON.stringify(health.data)}`);
      process.exit(1);
    }
  } catch (err) {
    fail(`API not reachable at ${API_BASE}`);
    console.error(err);
    process.exit(1);
  }

  // Generate keypair
  info('Generating Ed25519 keypair...');
  const keys = await generateKeyPair();
  ok(`Public key: ${DIM}${keys.publicKey.substring(0, 32)}...${RESET}`);

  // Register agent
  const agentId = `live-test-${Date.now()}`;
  info(`Registering agent: ${agentId}`);
  const agentResult = await apiRequest('POST', '/v1/agents', {
    id: agentId,
    public_key: keys.publicKey,
    framework: 'test/1.0',
  });

  if (agentResult.status === 201) {
    ok('Agent registered');
  } else {
    warn(`Agent registration returned ${agentResult.status}: ${JSON.stringify(agentResult.data)}`);
  }

  // Create 5 chained VCOT events
  info('Creating 5 chained VCOT events...');
  const events: VCOTEvent[] = [];
  const stampIds: string[] = [];
  let previousHash = GENESIS_HASH;

  const eventTypes: VCOTEventType[] = [
    'decision',
    'tool_call',
    'tool_result',
    'observation',
    'state_change',
  ];

  for (let i = 0; i < 5; i++) {
    const event = await createVCOTEvent(
      {
        event_type: eventTypes[i],
        agent_id: agentId,
        content: {
          step: i + 1,
          action: `test-action-${i + 1}`,
          data: `Sample content for event ${i + 1}`,
        },
        framework: 'test/1.0',
        metadata: { sequence: i + 1, total: 5 },
      },
      previousHash,
      keys.privateKey
    );

    const validation = validateVCOTEvent(event);
    if (!validation.valid) {
      fail(`Event ${i + 1} failed validation: ${validation.errors?.join(', ')}`);
      process.exit(1);
    }

    events.push(event);
    previousHash = event.content_hash;

    // POST to API
    const result = await apiRequest<{ id: string }>('POST', '/v1/stamps', event);
    if (result.status === 201) {
      stampIds.push(result.data.id);
      ok(`Event ${i + 1}/5 stamped: ${DIM}${result.data.id}${RESET} [${eventTypes[i]}]`);
    } else {
      fail(`Failed to stamp event ${i + 1}: ${JSON.stringify(result.data)}`);
      process.exit(1);
    }
  }

  ok(`All 5 events created and stamped`);

  // List stamps
  info('Listing stamps for agent...');
  const listResult = await apiRequest<{ data: unknown[]; pagination: { total: number } }>(
    'GET',
    `/v1/stamps?agent_id=${agentId}&limit=10`
  );
  ok(`Found ${listResult.data.pagination.total} stamps for agent`);

  // Trigger batch anchoring
  info('Triggering batch anchor...');
  const anchorResult = await apiRequest<{
    anchor_id: string;
    merkle_root: string;
    event_count: number;
    chain: string;
    status: string;
  }>('POST', '/v1/batch/anchor', { stamp_ids: stampIds });

  if (anchorResult.status === 202) {
    ok(`Anchor created: ${DIM}${anchorResult.data.anchor_id}${RESET}`);
    ok(`Merkle root: ${DIM}${anchorResult.data.merkle_root}${RESET}`);
    ok(`Chain: ${anchorResult.data.chain} | Events: ${anchorResult.data.event_count} | Status: ${anchorResult.data.status}`);
  } else {
    warn(`Anchor request returned ${anchorResult.status}: ${JSON.stringify(anchorResult.data)}`);
  }

  // Verify each stamp
  info('Verifying all stamps...');
  let allVerified = true;
  for (let i = 0; i < stampIds.length; i++) {
    const verifyResult = await apiRequest<{
      verified: boolean;
      chain_valid: boolean;
      status: string;
    }>('GET', `/v1/stamps/${stampIds[i]}/verify`);

    if (verifyResult.data.verified) {
      ok(`Stamp ${i + 1}/5 verified: chain=${verifyResult.data.chain_valid} status=${verifyResult.data.status}`);
    } else {
      fail(`Stamp ${i + 1}/5 verification failed`);
      allVerified = false;
    }
  }

  // Summary
  console.log(`\n${BOLD}${CYAN}═══ Results ═══${RESET}`);
  if (allVerified) {
    ok(`${BOLD}All 5 stamps created, anchored, and verified${RESET}`);
  } else {
    fail(`${BOLD}Some stamps failed verification${RESET}`);
  }

  console.log(`${DIM}Agent: ${agentId}${RESET}`);
  console.log(`${DIM}Stamps: ${stampIds.join(', ')}${RESET}`);
  console.log();
}

main().catch((err) => {
  fail(`Unhandled error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
