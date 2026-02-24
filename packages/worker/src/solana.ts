import {
  Connection,
  Keypair,
  Transaction,
  TransactionInstruction,
  PublicKey,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

const MEMO_PROGRAM_ID = new PublicKey(
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
);

interface AnchorResult {
  txHash: string;
  slot: number;
}

function getConnection(): Connection {
  const rpcUrl =
    process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

function decodeBase58(encoded: string): Uint8Array {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = BigInt(0);
  for (const char of encoded) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error(`Invalid base58 character: ${char}`);
    result = result * BigInt(58) + BigInt(index);
  }

  const hex = result.toString(16).padStart(2, '0');
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substring(i, i + 2), 16));
  }

  let leadingZeros = 0;
  for (const char of encoded) {
    if (char === '1') leadingZeros++;
    else break;
  }

  const zeroPadding = new Array(leadingZeros).fill(0);
  return new Uint8Array([...zeroPadding, ...bytes]);
}

function getKeypair(): Keypair {
  const privateKeyEnv = process.env.SOLANA_PRIVATE_KEY;
  if (privateKeyEnv) {
    const decoded = decodeBase58(privateKeyEnv);
    return Keypair.fromSecretKey(decoded);
  }
  console.log('No SOLANA_PRIVATE_KEY set, generating ephemeral keypair for devnet');
  return Keypair.generate();
}

export async function anchorToSolana(
  merkleRoot: string,
  metadata: string
): Promise<AnchorResult> {
  const connection = getConnection();
  const payer = getKeypair();

  const balance = await connection.getBalance(payer.publicKey);
  if (balance < 10000) {
    console.log(
      `Low balance (${balance} lamports) for ${payer.publicKey.toBase58()}, requesting airdrop`
    );
    await requestDevnetAirdrop(connection, payer.publicKey);
  }

  const memoData = JSON.stringify({
    protocol: 'memstamp/v1',
    merkle_root: merkleRoot,
    metadata,
    timestamp: new Date().toISOString(),
  });

  const memoInstruction = new TransactionInstruction({
    keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: true }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memoData, 'utf-8'),
  });

  const transaction = new Transaction().add(memoInstruction);

  const txHash = await sendAndConfirmTransaction(connection, transaction, [
    payer,
  ]);

  const txInfo = await connection.getTransaction(txHash, {
    commitment: 'confirmed',
  });

  return {
    txHash,
    slot: txInfo?.slot ?? 0,
  };
}

export async function requestDevnetAirdrop(
  connection: Connection,
  publicKey: PublicKey,
  amount: number = LAMPORTS_PER_SOL
): Promise<string> {
  const signature = await connection.requestAirdrop(publicKey, amount);
  const latestBlockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    signature,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  });
  console.log(
    `Airdrop confirmed: ${amount / LAMPORTS_PER_SOL} SOL to ${publicKey.toBase58()}`
  );
  return signature;
}
