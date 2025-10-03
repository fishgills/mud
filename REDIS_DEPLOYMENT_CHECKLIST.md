# Redis Event Bridge - Deployment Checklist

## ✅ Pre-Deployment Verification

### Infrastructure (Terraform)

- [x] Redis instance configured (`infra/terraform/redis.tf`)
- [x] REDIS_URL auto-injected to all Cloud Run services (`infra/terraform/cloudrun.tf`)
- [x] VPC networking configured for private Redis access
- [x] Redis authorized network set to VPC

### Code Implementation

- [x] `@mud/redis-client` library created with RedisEventBridge
- [x] DM service EventBridgeService integrated
- [x] Slack bot NotificationService integrated
- [x] All builds passing

### Environment Variables

#### DM Service (`apps/dm/src/env.ts`)

- [x] `REDIS_URL` - Default: `redis://localhost:6379`
- [x] `DATABASE_URL` - PostgreSQL connection
- [x] `WORLD_SERVICE_URL` - World service endpoint
- [x] `OPENAI_API_KEY` - From Secret Manager in GCP

#### Slack Bot (`apps/slack-bot/src/env.ts`)

- [x] `REDIS_URL` - Default: `redis://localhost:6379`
- [x] `SLACK_BOT_TOKEN` - From Secret Manager in GCP
- [x] `SLACK_SIGNING_SECRET` - From Secret Manager in GCP
- [x] `SLACK_APP_TOKEN` - From Secret Manager in GCP
- [x] `DM_GQL_ENDPOINT` - DM GraphQL endpoint
- [x] `WORLD_GQL_ENDPOINT` - World GraphQL endpoint

## 🚀 Deployment Steps

### 1. Local Testing (Optional but Recommended)

```bash
# Start Redis
docker-compose up redis

# Terminal 1: Start DM service
yarn turbo serve --filter=@mud/dm

# Terminal 2: Start Slack bot
yarn turbo serve --filter=@mud/slack-bot

# Verify logs show:
# DM: "✅ Event Bridge Service initialized"
# Slack: "✅ Notification Service started - listening for game events"

# Test combat to verify notifications work
# In Slack, send: /attack
```

### 2. Build Docker Images

```bash
# Build all services
yarn turbo build

# Build Docker images (if using custom deploy script)
cd /home/cdavis/Documents/mud
./scripts/ci/build-and-push-docker.sh
```

### 3. Deploy Infrastructure (if not already deployed)

```bash
cd infra/terraform

# Initialize Terraform (if first time)
terraform init

# Review changes
terraform plan

# Apply infrastructure
terraform apply

# Verify Redis instance created
gcloud redis instances describe mud-redis --region us-central1
```

### 4. Deploy Services

```bash
cd /home/cdavis/Documents/mud

# Deploy all services
yarn deploy

# Or deploy individually
yarn deploy dm
yarn deploy slack-bot
```

### 5. Verify Deployment

#### Check Cloud Run Services

```bash
# List services
gcloud run services list --region us-central1

# Check DM service
gcloud run services describe mud-dm --region us-central1

# Check environment variables
gcloud run services describe mud-dm \
  --region us-central1 \
  --format='get(spec.template.spec.containers[0].env)' | grep REDIS_URL
```

#### Check Redis Connection

```bash
# View Redis metrics
gcloud redis instances describe mud-redis --region us-central1

# Check connections (should show DM + Slack bot connections)
gcloud monitoring time-series list \
  --filter='metric.type="redis.googleapis.com/clients/connected"'
```

#### Test Functionality

1. Trigger combat in Slack (`/attack`)
2. Verify attacker receives combat result
3. Verify defender receives combat result
4. Move another player to same location
5. Trigger combat
6. Verify observer receives notification

### 6. Monitor Logs

```bash
# DM service logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=mud-dm" \
  --limit 50 \
  --format json

# Look for:
# "✅ Event Bridge Service initialized"
# "📤 Published event to game:combat:end"
# "📤 Published 3 notifications to notifications:slack"

# Slack bot logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=mud-slack-bot" \
  --limit 50 \
  --format json

# Look for:
# "✅ Notification Service started - listening for game events"
# "📨 Received combat notification for 3 recipients"
# "✅ Sent combat notification to U123456 (attacker)"
```

## 🔍 Post-Deployment Verification

### Health Checks

- [ ] DM service responding at `/health` (if implemented)
- [ ] Slack bot responding to commands
- [ ] Redis connection count increases when services start
- [ ] No connection errors in logs
- [ ] Combat notifications arriving in Slack

### Performance Checks

```bash
# Redis CPU usage (should be <20%)
gcloud monitoring time-series list \
  --filter='metric.type="redis.googleapis.com/stats/cpu_utilization"'

# Redis memory usage (should be <80%)
gcloud monitoring time-series list \
  --filter='metric.type="redis.googleapis.com/stats/memory/usage_ratio"'

# Connection count (should be 4-6: DM publisher/subscriber + Slack publisher/subscriber)
gcloud monitoring time-series list \
  --filter='metric.type="redis.googleapis.com/clients/connected"'
```

### Functional Testing

- [ ] Player vs Monster combat works
- [ ] Player vs Player combat works
- [ ] Observer notifications work
- [ ] Messages formatted correctly
- [ ] Role indicators correct (attacker/defender/observer)
- [ ] High-priority messages have proper formatting

## 🐛 Troubleshooting

### Services Won't Start

**Check**: Cloud Run logs for errors

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=mud-dm AND severity>=ERROR" --limit 20
```

**Common Issues**:

- Missing environment variable → Check Terraform env block
- Redis connection timeout → Check VPC connector
- Secret Manager access denied → Check IAM permissions

### No Notifications in Slack

**Check**:

1. DM service logs: Is EventBridge publishing?
2. Slack bot logs: Is NotificationService receiving?
3. Redis connection: Are both services connected?

**Debug**:

```bash
# SSH into Redis (if accessible)
redis-cli -h REDIS_PRIVATE_IP

# Monitor Pub/Sub
PSUBSCRIBE notifications:*

# Should see messages when combat occurs
```

### Observer Not Receiving Notifications

**Check**:

1. Observer at same location as combatants
2. Observer's `clientId` format correct: `slack:U123456`
3. Combat service generating observer messages

**Verify Database**:

```sql
SELECT name, x, y, z, clientId FROM Player WHERE x = 0 AND y = 0 AND z = 0;
```

## 📊 Monitoring & Alerts

### Recommended Alerts

1. **Redis Memory Usage > 80%**
   - Action: Scale up Redis memory

2. **Redis Connection Count > 60,000**
   - Action: Investigate connection leaks

3. **Cloud Run Service Errors > 5%**
   - Action: Check logs for errors

4. **Redis CPU > 80%**
   - Action: Upgrade to STANDARD_HA tier

### Cloud Monitoring Dashboard

Create dashboard with:

- Redis connections over time
- Pub/Sub messages per second
- Cloud Run request latency
- Error rates per service

## 🎉 Success Criteria

Deployment successful when:

- ✅ Both DM and Slack bot services running
- ✅ Redis instance in READY state
- ✅ Services showing Redis connection in logs
- ✅ Combat triggers notifications in Slack
- ✅ Observer notifications working
- ✅ No errors in Cloud Run logs
- ✅ Redis metrics healthy (<80% CPU, <80% memory)

## 📝 Rollback Plan

If issues occur:

```bash
# Rollback to previous revision
gcloud run services update-traffic mud-dm \
  --to-revisions=PREVIOUS_REVISION=100

gcloud run services update-traffic mud-slack-bot \
  --to-revisions=PREVIOUS_REVISION=100
```

## 🔐 Security Notes

- Redis is on private VPC (not internet-accessible)
- VPC connector provides secure access
- No Redis AUTH needed (network-level security)
- All secrets in Secret Manager, not environment variables
- TLS in transit between Cloud Run and Redis

## 📚 References

- [Redis GCP Configuration](./REDIS_GCP_CONFIGURATION.md)
- [Redis Event Bridge Implementation](./REDIS_EVENT_BRIDGE_IMPLEMENTATION.md)
- [Redis Event Bridge Testing](./REDIS_EVENT_BRIDGE_TESTING.md)
- [Combat System Refactor](./apps/dm/COMBAT_REFACTOR.md)

---

**Status**: Ready for deployment! All prerequisites met. ✅
