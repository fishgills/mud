#!/bin/bash
# Control script for Cloud SQL Auth Proxy

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/tmp/sql-proxy.log"
PORT=5433

case "$1" in
  start)
    if lsof -i :$PORT &> /dev/null; then
      echo "Cloud SQL Proxy is already running on port $PORT"
      exit 0
    fi

    echo "Starting Cloud SQL Proxy..."
    nohup "$SCRIPT_DIR/start-sql-proxy.sh" > "$LOG_FILE" 2>&1 &
    sleep 2

    if lsof -i :$PORT &> /dev/null; then
      echo "✓ Cloud SQL Proxy started successfully"
      echo "  Log file: $LOG_FILE"
      echo "  Port: $PORT"
      tail -3 "$LOG_FILE"
    else
      echo "✗ Failed to start Cloud SQL Proxy"
      echo "Check logs: cat $LOG_FILE"
      exit 1
    fi
    ;;

  stop)
    if ! pgrep -f cloud-sql-proxy > /dev/null; then
      echo "Cloud SQL Proxy is not running"
      exit 0
    fi

    echo "Stopping Cloud SQL Proxy..."
    pkill -f cloud-sql-proxy
    sleep 1

    if ! pgrep -f cloud-sql-proxy > /dev/null; then
      echo "✓ Cloud SQL Proxy stopped"
    else
      echo "✗ Failed to stop Cloud SQL Proxy"
      exit 1
    fi
    ;;

  restart)
    "$0" stop
    sleep 1
    "$0" start
    ;;

  status)
    if pgrep -f cloud-sql-proxy > /dev/null; then
      PID=$(pgrep -f cloud-sql-proxy)
      echo "✓ Cloud SQL Proxy is running (PID: $PID)"
      echo "  Port: $PORT"
      lsof -i :$PORT 2>/dev/null | grep LISTEN

      if [ -f "$LOG_FILE" ]; then
        echo ""
        echo "Recent logs:"
        tail -5 "$LOG_FILE"
      fi
    else
      echo "✗ Cloud SQL Proxy is not running"
      exit 1
    fi
    ;;

  logs)
    if [ -f "$LOG_FILE" ]; then
      tail -f "$LOG_FILE"
    else
      echo "No log file found at $LOG_FILE"
      exit 1
    fi
    ;;

  test)
    if ! lsof -i :$PORT &> /dev/null; then
      echo "✗ Cloud SQL Proxy is not running on port $PORT"
      echo "Run: $0 start"
      exit 1
    fi

    echo "Testing connection to Cloud SQL..."
    if command -v psql &> /dev/null; then
      psql "postgresql://fishgills@fishgills.net@localhost:5433/mud?sslmode=disable&connect_timeout=5" -c "SELECT version();" 2>&1 | head -1
    else
      echo "psql not installed. Checking if port is responding..."
      nc -zv localhost $PORT 2>&1
    fi
    ;;

  *)
    echo "Usage: $0 {start|stop|restart|status|logs|test}"
    echo ""
    echo "Commands:"
    echo "  start    - Start the Cloud SQL Auth Proxy"
    echo "  stop     - Stop the Cloud SQL Auth Proxy"
    echo "  restart  - Restart the Cloud SQL Auth Proxy"
    echo "  status   - Check if the proxy is running"
    echo "  logs     - Tail the proxy logs (Ctrl+C to exit)"
    echo "  test     - Test the database connection"
    exit 1
    ;;
esac
