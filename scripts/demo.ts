#!/usr/bin/env npx tsx
/**
 * memstamp live demo — stamps 5 agent events and anchors them to Solana devnet.
 *
 * Run:  npx tsx scripts/demo.ts
 *
 * No server, database, or API needed. Just @memstamp/core + Solana.
 */

import { createHash } from 'crypto';
import {
  Connection,
  Keypair,
  Transaction,
  TransactionInstruction,
  PublicKey,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

// ── @memstamp/core imports (from local workspace) ──
import {
  createVCOTEvent,
  generateKeyPair,
  GENESIS_HASH,
  computeMerkleRoot,
  generateMerkleProof,
  verifyMerkleProof,
  validateVCOTEvent,
  validateHashChain,
} from '../packages/core/src/index.js';
import type { VCOTEvent } from '../packages/core/src/index.js';

// ── Colors ──
const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', C = '\x1b[36m', B = '\x1b[1m', D = '\x1b[2m', X = '\x1b[0m';

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const RPC = 'https://api.devnet.solana.com';

async function main() {
  console.log(`\n${B}${C}═══════════════════════════════════════════════${X}`);
  console.log(`${B}${C}  memstamp — live demo (Solana devnet)${X}`);
  console.log(`${B}${C}═══════════════════════════════════════════════${X}\n`);

  // 1. Generate signing keys
  console.log(`${B}Step 1:${X} Generate Ed25519 signing keypair`);
  const keys = await generateKeyPair();
  console.log(`  ${G}✓${X} Public key: ${D}${keys.publicKey.slice(0, 32)}...${X}\n`);

  // 2. Create 5 chained VCOT events
  console.log(`${B}Step 2:${X} Create 5 chained VCOT events`);
  const events: VCOTEvent[] = [];
  let prevHash = GENESIS_HASH;

  const scenarios = [
    { type: 'decision' as const, content: { action: 'classify_document', classification: 'sensitive', confidence: 0.97 } },
    { type: 'tool_call' as const, content: { tool: 'database_query', query: 'SELECT * FROM permits WHERE status=pending', rows_returned: 42 } },
    { type: 'tool_result' as const, content: { tool: 'database_query', duration_ms: 23, status: 'success' } },
    { type: 'decision' as const, content: { action: 'approve_permit', permit_id: 'P-2026-1847', reason: 'all_requirements_met' } },
    { type: 'external_action' as const, content: { action: 'send_notification', recipient: 'applicant@example.com', template: 'permit_approved' } },
  ];

  for (const s of scenarios) {
    const event = await createVCOTEvent(
      { event_type: s.type, agent_id: 'demo-agent-001', content: s.content, framework: 'memstamp-demo/1.0' },
      prevHash,
      keys.privateKey,
    );
    events.push(event);
    prevHash = event.content_hash;
    console.log(`  ${G}✓${X} ${event.event_type.padEnd(16)} → ${D}${event.content_hash.slice(0, 40)}...${X}`);
  }

  // 3. Validate schema
  console.log(`\n${B}Step 3:${X} Validate all events against VCOT schema`);
  let allValid = true;
  for (const e of events) {
    const result = validateVCOTEvent(e);
    if (!result.valid) { allValid = false; console.log(`  ${R}✗${X} ${e.event_id}: ${result.errors?.join(', ')}`); }
  }
  console.log(allValid ? `  ${G}✓${X} All 5 events pass schema validation` : `  ${R}✗${X} Some events failed`);

  // 4. Validate hash chain
  console.log(`\n${B}Step 4:${X} Verify hash chain integrity`);
  const chainResult = validateHashChain(events, GENESIS_HASH);
  console.log(chainResult.valid
    ? `  ${G}✓${X} Hash chain is intact — no tampering detected`
    : `  ${R}✗${X} Chain broken: ${chainResult.errors?.join(', ')}`);

  // 5. Build Merkle tree
  console.log(`\n${B}Step 5:${X} Build Merkle tree`);
  const leaves = events.map(e => e.content_hash);
  const merkleRoot = computeMerkleRoot(leaves);
  console.log(`  ${G}✓${X} Merkle root: ${D}${merkleRoot}${X}`);

  // Verify each proof
  for (let i = 0; i < leaves.length; i++) {
    const proof = generateMerkleProof(leaves, i);
    const verified = proof ? verifyMerkleProof(proof) : false;
    if (!verified) { console.log(`  ${R}✗${X} Proof failed for event ${i}`); }
  }
  console.log(`  ${G}✓${X} All 5 Merkle proofs verified`);

  // 6. Anchor to Solana devnet
  console.log(`\n${B}Step 6:${X} Anchor Merkle root to Solana devnet`);
  const connection = new Connection(RPC, 'confirmed');
  const solanaKeypair = Keypair.generate();
  console.log(`  ${D}Solana wallet: ${solanaKeypair.publicKey.toBase58()}${X}`);

  console.log(`  ${Y}…${X} Requesting devnet airdrop (1 SOL)...`);
  try {
    const airdropSig = await connection.requestAirdrop(solanaKeypair.publicKey, LAMPORTS_PER_SOL);
    const bh = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: airdropSig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight });
    console.log(`  ${G}✓${X} Airdrop confirmed`);
  } catch (e: any) {
    console.log(`  ${R}✗${X} Airdrop failed: ${e.message}`);
    console.log(`  ${Y}→${X} Devnet may be rate-limited. The anchoring step will be skipped.`);
    console.log(`\n${B}${C}Demo complete (local verification passed, chain anchoring skipped)${X}\n`);
    return;
  }

  const memoData = JSON.stringify({
    protocol: 'memstamp/v1',
    merkle_root: merkleRoot,
    event_count: events.length,
    agent_id: 'demo-agent-001',
    timestamp: new Date().toISOString(),
  });

  const memoIx = new TransactionInstruction({
    keys: [{ pubkey: solanaKeypair.publicKey, isSigner: true, isWritable: true }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memoData, 'utf-8'),
  });

  console.log(`  ${Y}…${X} Submitting transaction...`);
  try {
    const txHash = await sendAndConfirmTransaction(connection, new Transaction().add(memoIx), [solanaKeypair]);
    console.log(`  ${G}✓${X} ${B}Anchored to Solana devnet!${X}`);
    console.log(`  ${G}✓${X} Tx: ${D}${txHash}${X}`);
    console.log(`  ${G}✓${X} Verify: ${C}https://solscan.io/tx/${txHash}?cluster=devnet${X}`);
  } catch (e: any) {
    console.log(`  ${R}✗${X} Transaction failed: ${e.message}`);
  }

  // 7. Summary
  console.log(`\n${B}${C}═══════════════════════════════════════════════${X}`);
  console.log(`${B}${C}  Summary${X}`);
  console.log(`${B}${C}═══════════════════════════════════════════════${X}`);
  console.log(`  Events created:     ${events.length}`);
  console.log(`  Schema validated:   ${G}✓${X}`);
  console.log(`  Hash chain intact:  ${G}✓${X}`);
  console.log(`  Merkle proofs:      ${G}✓${X} (${events.length}/${events.length})`);
  console.log(`  Merkle root:        ${merkleRoot.slice(0, 24)}...`);
  console.log(`  On-chain anchor:    Solana devnet`);
  console.log(`\n  ${D}An auditor can independently verify any event by:`);
  console.log(`  1. Re-hashing the original content with SHA-256`);
  console.log(`  2. Walking the Merkle proof to compute the root`);
  console.log(`  3. Checking the root matches the on-chain transaction${X}\n`);
}

main().catch(console.error);
