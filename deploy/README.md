# memstamp Deployment

Production deployment for the memstamp API and worker services.

## Architecture

- **API** — Fastify REST server (port 8010)
- **Worker** — BullMQ background worker for chain anchoring
- **Database** — PostgreSQL (RDS)
- **Cache/Queue** — Redis (ElastiCache)

## Prerequisites

- AWS account with ECR, ECS, RDS, ElastiCache configured
- Docker installed locally for building images
- AWS CLI configured with appropriate credentials

## AWS Resources Required

| Resource | Service | Notes |
|----------|---------|-------|
| Container registry | ECR | `memstamp-api` and `memstamp-worker` repos |
| Database | RDS PostgreSQL 16 | Run `packages/api/init.sql` on first deploy |
| Cache/Queue | ElastiCache Redis 7 | Used for BullMQ job queue |
| Task execution role | IAM | Needs ECR pull + Secrets Manager read |
| Log groups | CloudWatch | `/ecs/memstamp-api` and `/ecs/memstamp-worker` |

## Secrets (AWS Secrets Manager)

Create these secrets in `us-west-2`:

| Secret Name | Value |
|-------------|-------|
| `memstamp/database-url` | `postgres://user:pass@rds-host:5432/memstamp` |
| `memstamp/redis-url` | `redis://elasticache-host:6379` |
| `memstamp/jwt-secret` | Random 256-bit secret |
| `memstamp/solana-rpc-url` | Helius or other Solana RPC endpoint |
| `memstamp/solana-private-key` | Base58-encoded Solana keypair |

## Build and Push Images

```bash
# Set variables
export AWS_ACCOUNT_ID=123456789012
export AWS_REGION=us-west-2
export ECR_REGISTRY=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY

# Build and push API
docker build -t memstamp-api -f packages/api/Dockerfile .
docker tag memstamp-api:latest $ECR_REGISTRY/memstamp-api:latest
docker push $ECR_REGISTRY/memstamp-api:latest

# Build and push worker
docker build -t memstamp-worker -f packages/worker/Dockerfile .
docker tag memstamp-worker:latest $ECR_REGISTRY/memstamp-worker:latest
docker push $ECR_REGISTRY/memstamp-worker:latest
```

## Database Init

On first deploy, run the schema against RDS:

```bash
psql $DATABASE_URL -f packages/api/init.sql
```

## Deploy to ECS

```bash
# Replace <AWS_ACCOUNT_ID> in task definitions
sed -i "s/<AWS_ACCOUNT_ID>/$AWS_ACCOUNT_ID/g" deploy/ecs-task-api.json deploy/ecs-task-worker.json

# Register task definitions
aws ecs register-task-definition --cli-input-json file://deploy/ecs-task-api.json
aws ecs register-task-definition --cli-input-json file://deploy/ecs-task-worker.json

# Create or update services
aws ecs create-service \
  --cluster memstamp \
  --service-name memstamp-api \
  --task-definition memstamp-api \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"

aws ecs create-service \
  --cluster memstamp \
  --service-name memstamp-worker \
  --task-definition memstamp-worker \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=DISABLED}"
```

## Deploy with Docker Compose (Alternative)

For simpler deployments (single EC2 instance):

```bash
# Copy .env with production values
export DATABASE_URL=postgres://...
export REDIS_URL=redis://...
export JWT_SECRET=...
export SOLANA_RPC_URL=...
export SOLANA_PRIVATE_KEY=...
export ECR_REGISTRY=123456789012.dkr.ecr.us-west-2.amazonaws.com
export IMAGE_TAG=latest

docker compose -f deploy/docker-compose.prod.yml up -d
```

## Health Check

```bash
curl http://your-alb-or-ip:8010/health
```

Expected response:
```json
{"status":"ok","timestamp":"2026-02-24T00:00:00.000Z"}
```

## Environment Variables Reference

| Variable | Required | Service | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | API, Worker | PostgreSQL connection string |
| `REDIS_URL` | Yes | API, Worker | Redis connection string |
| `PORT` | No | API | API port (default: 8010) |
| `JWT_SECRET` | Yes | API | JWT signing secret |
| `SOLANA_RPC_URL` | Yes | Worker | Solana RPC endpoint |
| `SOLANA_PRIVATE_KEY` | Yes | Worker | Solana signing key (base58) |
| `NODE_ENV` | No | Both | `production` in prod |
