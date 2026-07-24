#!/usr/bin/env bash
# REQ-EVO-013: Initialize governance infrastructure (Ed25519 keypair + SQLite DB path)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MCP_DIR="$PROJECT_ROOT/claude-memory-mcp"

mkdir -p "$MCP_DIR/data" "$MCP_DIR/keys"

if [ -f "$MCP_DIR/keys/ed25519-private.pem" ]; then
  echo "Ed25519 keypair already exists. Skipping generation."
else
  echo "Generating Ed25519 keypair..."
  openssl genpkey -algorithm Ed25519 -out "$MCP_DIR/keys/ed25519-private.pem"
  openssl pkey -in "$MCP_DIR/keys/ed25519-private.pem" -pubout -out "$MCP_DIR/keys/ed25519-public.pem"
  chmod 600 "$MCP_DIR/keys/ed25519-private.pem"
  chmod 644 "$MCP_DIR/keys/ed25519-public.pem"
  echo "Keypair generated."
fi

echo "Public key fingerprint:"
openssl pkey -in "$MCP_DIR/keys/ed25519-public.pem" -pubin -outform DER 2>/dev/null | shasum -a 256

echo ""
echo "SQLite DB will be created at: $MCP_DIR/data/guardrail-proofs.db"
echo "Init complete."
