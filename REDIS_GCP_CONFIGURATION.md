# Redis Configuration for GCP Cloud Run

## Overview

The Redis Event Bridge is fully configured for GCP Cloud Run deployments. All services automatically receive the `REDIS_URL` environment variable.

## Infrastructure Configuration

### Redis Instance (`infra/terraform/redis.tf`)

```terraform
resource "google_redis_instance" "redis" {
  name           = "mud-redis"
  tier           = "BASIC"
  memory_size_gb = var.redis_memory_size_gb
  region         = var.region
  authorized_network = google_compute_network.vpc.id
  redis_version = "REDIS_7_0"
  display_name  = "MUD Redis Instance"
}
```

**Key Features**:

- **Tier**: BASIC (single-zone, no replication)
- **Version**: Redis 7.0
- **Network**: Private VPC (authorized network)
- **Memory**: Configurable via `var.redis_memory_size_gb`

### Cloud Run Environment Variables (`infra/terraform/cloudrun.tf`)

All Cloud Run services automatically receive:

```terraform
env {
  name  = "REDIS_URL"
  value = "redis://${google_redis_instance.redis.host}:${google_redis_instance.redis.port}"
}
```

**Example**: `redis://10.0.0.3:6379`

### Services with Redis Access

| Service       | Redis Usage                               | Auto-configured    |
| ------------- | ----------------------------------------- | ------------------ |
| **dm**        | EventBridge publisher, coordination locks | ✅ Yes             |
| **slack-bot** | EventBridge subscriber (notifications)    | ✅ Yes             |
| **world**     | Not currently used                        | ✅ Yes (available) |
| **tick**      | Not currently used                        | ✅ Yes (available) |

## Network Configuration

### VPC Access

All Cloud Run services use VPC connector for private Redis access:

```terraform
vpc_access {
  connector = google_vpc_access_connector.connector.id
  egress    = "PRIVATE_RANGES_ONLY"
}
```

This ensures:

- ✅ Services can reach Redis on private network (10.x.x.x)
- ✅ No public Redis exposure
- ✅ Fast, low-latency connections
- ✅ Secure communication within VPC

### Authorized Network

Redis instance is bound to the VPC network:

```terraform
authorized_network = google_compute_network.vpc.id
```

Only services within the VPC can connect to Redis.

## Environment Variable Injection

### Automatic Injection (All Services)

```terraform
dynamic "env" {
  for_each = {
    for k, v in merge(each.value.env_vars, {
      DATABASE_URL   = "postgresql://..."
      REDIS_URL      = "redis://${google_redis_instance.redis.host}:${google_redis_instance.redis.port}"
      GCP_CLOUD_RUN  = "true"
      GCP_PROJECT_ID = var.project_id
      GCP_REGION     = var.region
    }) : k => v if k != "OPENAI_API_KEY"
  }
  content {
    name  = env.key
    value = env.value
  }
}
```

### Service-Specific Configuration

**DM Service** gets additional env vars:

- `OPENAI_API_KEY` (from Secret Manager)
- `WORLD_SERVICE_URL` (auto-injected)
- `DM_USE_VERTEX_AI` (feature flag)

**Slack Bot** gets additional env vars:

- `SLACK_BOT_TOKEN` (from Secret Manager)
- `SLACK_SIGNING_SECRET` (from Secret Manager)
- `SLACK_APP_TOKEN` (from Secret Manager)
- `DM_GQL_ENDPOINT`
- `WORLD_GQL_ENDPOINT`
- `WORLD_BASE_URL`

## Deployment

### Current Status

✅ **REDIS_URL is already configured** for all services in Cloud Run!

No additional Terraform changes needed. The Event Bridge will work automatically when deployed.

### Deploy Command

```bash
# Deploy all services (includes Redis URL)
yarn deploy

# Or deploy specific service
yarn deploy dm
yarn deploy slack-bot
```

### Verify Configuration

After deployment, check environment variables:

```bash
# Using gcloud CLI
gcloud run services describe mud-dm \
  --region us-central1 \
  --format='value(spec.template.spec.containers[0].env)'

# Should include:
# REDIS_URL=redis://10.x.x.x:6379
```

## Local Development

### Docker Compose

For local development, Redis runs via docker-compose:

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
```

### Environment Variables

Local `.env` files should include:

```bash
# apps/dm/.env
REDIS_URL=redis://localhost:6379

# apps/slack-bot/.env
REDIS_URL=redis://localhost:6379
```

## Scaling Considerations

### Current Setup (BASIC Tier)

- **Max Connections**: 65,000
- **Memory**: Configurable (default: 1GB)
- **Availability**: Single-zone (no replication)
- **Performance**: ~100k ops/second

### Upgrade Path (STANDARD_HA Tier)

For production scale:

```terraform
resource "google_redis_instance" "redis" {
  name           = "mud-redis"
  tier           = "STANDARD_HA"  # ← High Availability
  memory_size_gb = 5

  replica_count = 1  # Read replicas
  read_replicas_mode = "READ_REPLICAS_ENABLED"
}
```

**Benefits**:

- Multi-zone replication
- Automatic failover
- Read replicas for scaling
- 99.9% SLA

### Cost Comparison

| Tier        | Memory | Monthly Cost (us-central1) |
| ----------- | ------ | -------------------------- |
| BASIC       | 1GB    | ~$40                       |
| BASIC       | 5GB    | ~$200                      |
| STANDARD_HA | 1GB    | ~$80                       |
| STANDARD_HA | 5GB    | ~$400                      |

## Monitoring

### Metrics to Track

1. **Connection Count**
   - Monitor: `redis.googleapis.com/clients/connected`
   - Alert if approaching 65,000

2. **Memory Usage**
   - Monitor: `redis.googleapis.com/stats/memory/usage_ratio`
   - Alert if exceeding 80%

3. **CPU Utilization**
   - Monitor: `redis.googleapis.com/stats/cpu_utilization`
   - Alert if exceeding 80%

4. **Operations/Second**
   - Monitor: `redis.googleapis.com/commands/calls`
   - Track peak load

### Cloud Console

View Redis metrics:

```
https://console.cloud.google.com/memorystore/redis/instances
```

## Security

### Access Control

✅ **Private Network Only**: Redis not exposed to internet
✅ **VPC Authorization**: Only authorized networks can connect
✅ **No AUTH Required**: Uses network-level security (VPC)
✅ **TLS**: Can enable in-transit encryption if needed

### Optional: Enable AUTH

For additional security:

```terraform
resource "google_redis_instance" "redis" {
  auth_enabled = true

  # Use Secret Manager for password
  # AUTH token must be passed in REDIS_URL
}
```

Then update REDIS_URL:

```terraform
REDIS_URL = "redis://default:${google_secret_manager_secret_version.redis_password.secret_data}@${google_redis_instance.redis.host}:${google_redis_instance.redis.port}"
```

## Troubleshooting

### Issue: Service Can't Connect to Redis

**Check**:

1. VPC connector attached to service
2. Redis instance in same region
3. Authorized network configured

**Solution**:

```bash
# Verify VPC connector
gcloud compute networks vpc-access connectors describe CONNECTOR_NAME \
  --region us-central1

# Check Redis authorized networks
gcloud redis instances describe mud-redis --region us-central1
```

### Issue: Connection Timeout

**Check**:

1. Redis instance state (READY)
2. VPC egress mode (PRIVATE_RANGES_ONLY)
3. Firewall rules

**Solution**:

```bash
# Check Redis state
gcloud redis instances describe mud-redis --region us-central1 \
  --format='value(state)'
# Should output: READY
```

### Issue: Memory Pressure

**Symptoms**:

- Evictions occurring
- OOM errors
- Slow responses

**Solution**:

```terraform
# Increase memory
resource "google_redis_instance" "redis" {
  memory_size_gb = 5  # Increase from 1GB
}
```

## Performance Tuning

### Pub/Sub Optimization

For high-throughput event publishing:

```terraform
resource "google_redis_instance" "redis" {
  redis_configs = {
    # Increase max clients
    "maxclients" = "10000"

    # Optimize for Pub/Sub
    "notify-keyspace-events" = ""
  }
}
```

### Connection Pooling

Services already use connection pooling via redis client:

```typescript
const client = createClient({
  url: env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500),
  },
});
```

## Summary

✅ **REDIS_URL is already configured** for GCP Cloud Run deployments
✅ Redis instance provisioned with Terraform
✅ Private VPC networking configured
✅ All services have automatic access
✅ Event Bridge will work immediately upon deployment

**No additional configuration needed!** The Redis Event Bridge is production-ready for GCP deployment.
