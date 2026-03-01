#!/usr/bin/env bash
set -euo pipefail

# Ensure tools installed via pipx or custom paths are reachable
for p in /var/lib/rundeck/.local/bin /root/.local/bin /home/*/.local/bin /usr/local/bin; do
  [[ -d "$p" ]] && export PATH="$p:$PATH"
done

echo "[job3] starting — Install IIS ($(date -Is))"
echo "[job3] user=$(whoami) host=$(hostname -f 2>/dev/null || hostname)"

REPO_DIR="${REPO_DIR:-/opt/automation}"
AZ_SUBSCRIPTION_ID="${AZ_SUBSCRIPTION_ID:-9af59c0f-7661-48ec-ac0d-fc61688f01ea}"

ANSIBLE_WORKDIR="${ANSIBLE_WORKDIR:-${REPO_DIR}/autodeploy/ansible}"

KEYVAULT_NAME="${KEYVAULT_NAME:-fabmas-kv1}"
LOCALADMIN_SECRET_NAME="${LOCALADMIN_SECRET_NAME:-winproto01-localadmin}"

# Derive VM name from secret name (e.g. sql01-localadmin -> sql01)
VM_NAME="${VM_NAME:-${LOCALADMIN_SECRET_NAME%-localadmin}}"

echo "[job3] target VM: $VM_NAME"
echo "[job3] ansible_workdir=$ANSIBLE_WORKDIR"

# Source dynamic inventory helper (eliminates shared terraform.yml race condition)
source "${REPO_DIR}/autodeploy/rundeck/scripts/_inventory_helper.sh"

az login --identity --output none || true
az account set --subscription "$AZ_SUBSCRIPTION_ID" >/dev/null

command -v az >/dev/null || { echo "[job3] ERROR: az not found"; exit 1; }
command -v ansible-playbook >/dev/null || { echo "[job3] ERROR: ansible-playbook not found"; exit 1; }

cd "$ANSIBLE_WORKDIR"

TMPDIR=$(mktemp -d)
cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT
umask 077

echo "[job3] reading localadmin password from Key Vault: $KEYVAULT_NAME/$LOCALADMIN_SECRET_NAME"
LOCALADMIN_PASSWORD=$(az keyvault secret show --vault-name "$KEYVAULT_NAME" --name "$LOCALADMIN_SECRET_NAME" --query value -o tsv)

# Generate dynamic per-VM inventory (looks up private IP from Azure)
INVENTORY_RUNTIME="$TMPDIR/inventory.runtime.yml"
generate_vm_inventory "$VM_NAME" "$LOCALADMIN_PASSWORD" "$INVENTORY_RUNTIME"
unset LOCALADMIN_PASSWORD

ansible-playbook -i "$INVENTORY_RUNTIME" playbooks/install-iis.yml -v

echo "[job3] done ($(date -Is))"
