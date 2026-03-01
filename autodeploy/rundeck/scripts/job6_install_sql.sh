#!/usr/bin/env bash
set -euo pipefail

# Ensure tools installed via pipx or custom paths are reachable
for p in /var/lib/rundeck/.local/bin /root/.local/bin /home/*/.local/bin /usr/local/bin; do
  [[ -d "$p" ]] && export PATH="$p:$PATH"
done

echo "[job6] starting — Install SQL Server ($(date -Is))"
echo "[job6] user=$(whoami) host=$(hostname -f 2>/dev/null || hostname)"

REPO_DIR="${REPO_DIR:-/opt/automation}"
AZ_SUBSCRIPTION_ID="${AZ_SUBSCRIPTION_ID:-9af59c0f-7661-48ec-ac0d-fc61688f01ea}"

ANSIBLE_WORKDIR="${ANSIBLE_WORKDIR:-${REPO_DIR}/autodeploy/ansible}"

KEYVAULT_NAME="${KEYVAULT_NAME:-fabmas-kv1}"
LOCALADMIN_SECRET_NAME="${LOCALADMIN_SECRET_NAME:-winproto01-localadmin}"

# Storage account che ospita la ISO di SQL Server
STORAGE_ACCOUNT="${STORAGE_ACCOUNT:-fabmastorageaccount01}"
ISO_CONTAINER="${ISO_CONTAINER:-software}"
ISO_BLOB="${ISO_BLOB:-SQLServer2025-x64-ENU.iso}"

# Derive VM name from secret name (e.g. sql01-localadmin -> sql01)
VM_NAME="${VM_NAME:-${LOCALADMIN_SECRET_NAME%-localadmin}}"

echo "[job6] target VM: $VM_NAME"
echo "[job6] ansible_workdir=$ANSIBLE_WORKDIR"
echo "[job6] storage=$STORAGE_ACCOUNT/$ISO_CONTAINER/$ISO_BLOB"

# Source dynamic inventory helper (eliminates shared terraform.yml race condition)
source "${REPO_DIR}/autodeploy/rundeck/scripts/_inventory_helper.sh"

az login --identity --output none || true
az account set --subscription "$AZ_SUBSCRIPTION_ID" >/dev/null

command -v az >/dev/null || { echo "[job6] ERROR: az not found"; exit 1; }
command -v ansible-playbook >/dev/null || { echo "[job6] ERROR: ansible-playbook not found"; exit 1; }

cd "$ANSIBLE_WORKDIR"

# ── Genera SAS URL temporanea (1h) per la ISO su storage account ──
echo "[job6] generating temporary SAS URL for SQL Server ISO..."
SAS_EXPIRY=$(date -u -d '+1 hour' +%Y-%m-%dT%H:%MZ)
SAS_TOKEN=$(az storage blob generate-sas \
  --account-name "$STORAGE_ACCOUNT" \
  --container-name "$ISO_CONTAINER" \
  --name "$ISO_BLOB" \
  --permissions r \
  --expiry "$SAS_EXPIRY" \
  --auth-mode login \
  --as-user \
  --output tsv)

if [[ -z "$SAS_TOKEN" ]]; then
  echo "[job6] ERROR: failed to generate SAS token"
  exit 1
fi

SQL_ISO_URL="https://${STORAGE_ACCOUNT}.blob.core.windows.net/${ISO_CONTAINER}/${ISO_BLOB}?${SAS_TOKEN}"
echo "[job6] SAS URL generated (expires: $SAS_EXPIRY)"

TMPDIR=$(mktemp -d)
cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT
umask 077

echo "[job6] reading localadmin password from Key Vault: $KEYVAULT_NAME/$LOCALADMIN_SECRET_NAME"
LOCALADMIN_PASSWORD=$(az keyvault secret show --vault-name "$KEYVAULT_NAME" --name "$LOCALADMIN_SECRET_NAME" --query value -o tsv)

# Generate dynamic per-VM inventory (looks up private IP from Azure)
INVENTORY_RUNTIME="$TMPDIR/inventory.runtime.yml"
generate_vm_inventory "$VM_NAME" "$LOCALADMIN_PASSWORD" "$INVENTORY_RUNTIME"
unset LOCALADMIN_PASSWORD

ansible-playbook -i "$INVENTORY_RUNTIME" playbooks/install-sql-server.yml \
  -e "sql_iso_url=$SQL_ISO_URL" -v

echo "[job6] done ($(date -Is))"
