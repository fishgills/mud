# PostgreSQL MCP Server Setup for GCP Cloud SQL

This guide explains how to connect the PostgreSQL MCP server to your GCP Cloud SQL instance.

## Overview

- **Database Instance**: `mud-postgres`
- **Database Name**: `mud`
- **Connection Method**: Cloud SQL Auth Proxy with IAM authentication
- **Local Port**: 5433 (to avoid conflicts with local PostgreSQL)

## Prerequisites

1. Authenticated with `gcloud` CLI (as `fishgills@fishgills.net`)
2. Docker installed and running
3. IAM permissions for Cloud SQL (already configured in Terraform)

## Setup Instructions

### Step 1: Start the Cloud SQL Auth Proxy

Run the helper script to start the proxy in a separate terminal:

```bash
./scripts/start-sql-proxy.sh
```

This script will:

- Download and install Cloud SQL Auth Proxy if needed
- Start the proxy on port 5433
- Use IAM authentication (no password needed)
- Keep running in the foreground

**Keep this terminal open** while using the MCP server.

### Step 2: Restart Claude Code

After starting the proxy, restart Claude Code to connect the MCP server:

```bash
# Exit current session
exit

# Start new session
codex
```

### Step 3: Test the Connection

Once Claude Code restarts, you can test the connection by asking:

```
Can you show me the tables in the mud database?
```

Claude should now be able to query your GCP PostgreSQL database!

## Configuration Files

### MCP Server Configuration

The MCP server is configured in two places:

1. **Project-specific** (VSCode): `.vscode/mcp.json`
2. **Global** (Claude Code): `~/.codex/config.toml`

Both use the following connection string:

```
postgresql://fishgills@fishgills.net@localhost:5433/mud?sslmode=disable
```

### Connection Details

- **Host**: `localhost` (via Cloud SQL Auth Proxy)
- **Port**: `5433`
- **Database**: `mud`
- **User**: `fishgills@fishgills.net` (IAM authentication)
- **Schema**: `mud` (as specified in your requirements)

## Troubleshooting

### Proxy won't start

```bash
# Check if port 5433 is already in use
lsof -i :5433

# Kill existing process if needed
kill $(lsof -t -i :5433)
```

### Connection refused

- Ensure the Cloud SQL Auth Proxy is running
- Check that you're authenticated: `gcloud auth list`
- Verify the instance exists: `gcloud sql instances describe mud-postgres`

### Permission denied

- Ensure your user (`fishgills@fishgills.net`) is in the IAM users list in Terraform
- Run: `cd infra/terraform && terraform apply` to sync IAM permissions

## Alternative: Background Service

If you want the proxy to run as a background service, create a systemd service:

```bash
sudo tee /etc/systemd/system/cloud-sql-proxy.service > /dev/null <<EOF
[Unit]
Description=Cloud SQL Auth Proxy
After=network.target

[Service]
Type=simple
User=$USER
ExecStart=/usr/local/bin/cloud-sql-proxy --port 5433 --auto-iam-authn battleforge-444008:us-central1:mud-postgres
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable cloud-sql-proxy
sudo systemctl start cloud-sql-proxy
```

## Security Notes

- The proxy uses IAM authentication, so no passwords are stored
- Connection is encrypted between your machine and GCP
- The MCP server has **read-only** access by default (using `crystaldba/postgres-mcp`)
- The database is on a private network (no public IP)

## References

- [Cloud SQL Auth Proxy Documentation](https://cloud.google.com/sql/docs/postgres/sql-proxy)
- [PostgreSQL MCP Server](https://github.com/crystaldba/postgres-mcp)
- [MCP Protocol](https://modelcontextprotocol.io/)
