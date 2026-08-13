#!/usr/bin/env bash
# Apply customer chat RPC migration to Supabase (requires: supabase login once).
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_REF="${SUPABASE_PROJECT_REF:-zcrzxgzyptqibsajoece}"
MIGRATION="supabase/migrations/20260619120000_customer_chat_public_rpc.sql"

if ! command -v supabase >/dev/null 2>&1; then
  echo "Installing Supabase CLI via npx..."
  SUPABASE_CMD="npx supabase@latest"
else
  SUPABASE_CMD="supabase"
fi

echo "Applying chat RPC migration to project ${PROJECT_REF}..."
$SUPABASE_CMD db execute --project-ref "$PROJECT_REF" --file "$MIGRATION"
echo "Done. Redeploy Vercel if needed: npx vercel deploy --prod --yes"
