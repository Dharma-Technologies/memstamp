// API Configuration


export const config = {
  port: parseInt(process.env.PORT ?? '8010', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',

  // Chain configuration
  heliusApiKey: process.env.HELIUS_API_KEY ?? '',
  alchemyApiKey: process.env.ALCHEMY_API_KEY ?? '',
  solanaRpcUrl:
    process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
  baseRpcUrl: process.env.BASE_RPC_URL ?? 'https://mainnet.base.org',

  // Anchoring
  anchorBatchSize: parseInt(process.env.ANCHOR_BATCH_SIZE ?? '1000', 10),
  anchorTimeWindowMs: parseInt(
    process.env.ANCHOR_TIME_WINDOW_MS ?? '300000',
    10
  ),
  defaultChain: process.env.DEFAULT_CHAIN ?? 'solana',
} as const;
