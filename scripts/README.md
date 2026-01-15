# Database Scripts

## Cloud SQL Proxy for MCP Server

### Quick Start

```bash
# Start the Cloud SQL Auth Proxy (run in a separate terminal)
./scripts/start-sql-proxy.sh

# Or run in background
nohup ./scripts/start-sql-proxy.sh > /tmp/sql-proxy.log 2>&1 &
```

### Check Status

```bash
# Check if proxy is running
ps aux | grep cloud-sql-proxy | grep -v grep

# Check proxy logs
tail -f /tmp/sql-proxy.log

# Verify port is listening
lsof -i :5433
```

### Stop Proxy

```bash
# Find and kill the process
pkill cloud-sql-proxy

# Or if you know the PID
kill $(pgrep cloud-sql-proxy)
```

### Test Connection

```bash
# Using psql (if installed)
PGPASSWORD=$(gcloud sql generate-login-token) psql \
  -h localhost \
  -p 5433 \
  -U fishgills@fishgills.net \
  -d mud

# Quick test
psql "postgresql://fishgills@fishgills.net@localhost:5433/mud?sslmode=disable"
```

### MCP Server

Once the proxy is running, restart Claude Code to connect the PostgreSQL MCP server:

```bash
exit  # Exit current session
codex # Start new session
```

Then you can ask Claude to query the database:

- "Show me all tables in the mud schema"
- "What's the structure of the users table?"
- "Count all records in the characters table"

### Troubleshooting

**Port already in use:**

```bash
lsof -i :5433
kill $(lsof -t -i :5433)
```

**Authentication issues:**

```bash
gcloud auth list
gcloud auth login  # If needed
```

**Connection refused:**

- Ensure the proxy is running: `ps aux | grep cloud-sql-proxy`
- Check logs: `tail -f /tmp/sql-proxy.log`
- Verify GCP connectivity: `gcloud sql instances describe mud-postgres`

### Configuration

- **Instance**: `battleforge-444008:us-central1:mud-postgres`
- **Local Port**: `5433`
- **Database**: `mud`
- **User**: `fishgills@fishgills.net` (IAM)
- **Auth**: Automatic IAM authentication (no password needed)

See [docs/postgres-mcp-setup.md](../docs/postgres-mcp-setup.md) for detailed setup instructions.
