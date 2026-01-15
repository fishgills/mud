#!/bin/bash
# Start Cloud SQL Auth Proxy for MCP server connection

set -e

# Configuration
INSTANCE_CONNECTION_NAME="battleforge-444008:us-central1:mud-postgres"
LOCAL_PORT=5433  # Using 5433 to avoid conflicts with local postgres on 5432
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROXY_PATH="$SCRIPT_DIR/cloud-sql-proxy"

# Check if cloud-sql-proxy is installed locally or globally
if [ ! -f "$PROXY_PATH" ] && ! command -v cloud-sql-proxy &> /dev/null; then
    echo "Cloud SQL Auth Proxy not found. Installing to $PROXY_PATH..."

    # Download the latest version
    curl -o "$PROXY_PATH" https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.15.0/cloud-sql-proxy.linux.amd64
    chmod +x "$PROXY_PATH"

    echo "Cloud SQL Auth Proxy installed successfully!"
fi

# Use local proxy if it exists, otherwise use system-wide
if [ -f "$PROXY_PATH" ]; then
    CLOUD_SQL_PROXY="$PROXY_PATH"
else
    CLOUD_SQL_PROXY="cloud-sql-proxy"
fi

# Check if proxy is already running
if lsof -i :$LOCAL_PORT &> /dev/null; then
    echo "Cloud SQL Proxy is already running on port $LOCAL_PORT"
    exit 0
fi

echo "Starting Cloud SQL Auth Proxy..."
echo "Instance: $INSTANCE_CONNECTION_NAME"
echo "Local port: $LOCAL_PORT"
echo ""
echo "The proxy will run in the foreground. Press Ctrl+C to stop."
echo "Keep this terminal open while using the MCP server."
echo ""

# Start the proxy with IAM authentication
# Uses public IP by default (more reliable for local development)
exec "$CLOUD_SQL_PROXY" \
  --port $LOCAL_PORT \
  --auto-iam-authn \
  $INSTANCE_CONNECTION_NAME
