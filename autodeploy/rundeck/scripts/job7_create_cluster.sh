#!/usr/bin/env bash
set -euo pipefail

# Ensure tools installed via pipx or custom paths are reachable
for p in /var/lib/rundeck/.local/bin /root/.local/bin /home/*/.local/bin /usr/local/bin; do
  [[ -d "$p" ]] && export PATH="$p:$PATH"
done

echo "[job7] starting — Create Cluster + AG ($(date -Is))"
echo "[job7] user=$(whoami) host=$(hostname -f 2>/dev/null || hostname)"

REPO_DIR="${REPO_DIR:-/opt/automation}"
AZ_SUBSCRIPTION_ID="${AZ_SUBSCRIPTION_ID:-9af59c0f-7661-48ec-ac0d-fc61688f01ea}"

ANSIBLE_WORKDIR="${ANSIBLE_WORKDIR:-${REPO_DIR}/autodeploy/ansible}"

KEYVAULT_NAME="${KEYVAULT_NAME:-fabmas-kv1}"
LOCALADMIN_SECRET_NAME="${LOCALADMIN_SECRET_NAME:-winproto01-localadmin}"

# Storage account per Cloud Witness (quorum)
STORAGE_ACCOUNT="${STORAGE_ACCOUNT:-fabmastorageaccount01}"

NODE1_NAME="${NODE1_NAME:?NODE1_NAME is required}"
NODE2_NAME="${NODE2_NAME:?NODE2_NAME is required}"
CLUSTER_NAME="${CLUSTER_NAME:?CLUSTER_NAME is required}"
CLUSTER_IP="${CLUSTER_IP:?CLUSTER_IP is required}"
AG_NAME="${AG_NAME:?AG_NAME is required}"
LISTENER_NAME="${LISTENER_NAME:?LISTENER_NAME is required}"

# Derive target VM from secret name (should be node1)
VM_NAME="${VM_NAME:-${LOCALADMIN_SECRET_NAME%-localadmin}}"

echo "[job7] target VM (inventory): $VM_NAME"
echo "[job7] node1=$NODE1_NAME  node2=$NODE2_NAME"
echo "[job7] cluster=$CLUSTER_NAME ($CLUSTER_IP)"
echo "[job7] ag=$AG_NAME  listener(DNN)=$LISTENER_NAME"
echo "[job7] cloud witness storage=$STORAGE_ACCOUNT"

# Source dynamic inventory helper (eliminates shared terraform.yml race condition)
source "${REPO_DIR}/autodeploy/rundeck/scripts/_inventory_helper.sh"

az login --identity --output none || true
az account set --subscription "$AZ_SUBSCRIPTION_ID" >/dev/null

command -v az >/dev/null || { echo "[job7] ERROR: az not found"; exit 1; }
command -v ansible-playbook >/dev/null || { echo "[job7] ERROR: ansible-playbook not found"; exit 1; }

cd "$ANSIBLE_WORKDIR"

TMPDIR=$(mktemp -d)
cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT
umask 077

echo "[job7] reading localadmin password from Key Vault: $KEYVAULT_NAME/$LOCALADMIN_SECRET_NAME"
LOCALADMIN_PASSWORD=$(az keyvault secret show --vault-name "$KEYVAULT_NAME" --name "$LOCALADMIN_SECRET_NAME" --query value -o tsv)

# Generate dynamic inventory targeting node1 (which orchestrates cluster creation)
INVENTORY_RUNTIME="$TMPDIR/inventory.runtime.yml"
generate_vm_inventory "$VM_NAME" "$LOCALADMIN_PASSWORD" "$INVENTORY_RUNTIME"
unset LOCALADMIN_PASSWORD

# Recupera la access key dello storage account per il Cloud Witness
echo "[job7] reading storage account key for Cloud Witness..."
STORAGE_KEY=$(az storage account keys list \
  --account-name "$STORAGE_ACCOUNT" \
  --query "[0].value" -o tsv)

if [[ -z "$STORAGE_KEY" ]]; then
  echo "[job7] WARNING: could not read storage key — Cloud Witness will be skipped"
  STORAGE_KEY=""
fi

ansible-playbook -i "$INVENTORY_RUNTIME" playbooks/create-cluster.yml \
  -e "node1_name=$NODE1_NAME" \
  -e "node2_name=$NODE2_NAME" \
  -e "cluster_name=$CLUSTER_NAME" \
  -e "cluster_ip=$CLUSTER_IP" \
  -e "ag_name=$AG_NAME" \
  -e "listener_name=$LISTENER_NAME" \
  -e "storage_account_name=$STORAGE_ACCOUNT" \
  -e "storage_account_key=$STORAGE_KEY" \
  -v

echo "[job7] done ($(date -Is))"
