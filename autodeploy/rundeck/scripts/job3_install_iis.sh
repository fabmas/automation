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
export ANSIBLE_INVENTORY="${ANSIBLE_INVENTORY:-${ANSIBLE_WORKDIR}/inventory/terraform.yml}"

KEYVAULT_NAME="${KEYVAULT_NAME:-fabmas-kv1}"
LOCALADMIN_SECRET_NAME="${LOCALADMIN_SECRET_NAME:-winproto01-localadmin}"

echo "[job3] ansible_workdir=$ANSIBLE_WORKDIR"
echo "[job3] inventory=$ANSIBLE_INVENTORY"

az login --identity --output none || true
az account set --subscription "$AZ_SUBSCRIPTION_ID" >/dev/null

command -v az >/dev/null || { echo "[job3] ERROR: az not found"; exit 1; }
command -v ansible-playbook >/dev/null || { echo "[job3] ERROR: ansible-playbook not found"; exit 1; }

cd "$ANSIBLE_WORKDIR"
test -f "$ANSIBLE_INVENTORY" || { echo "[job3] ERROR: inventory not found: $ANSIBLE_INVENTORY"; exit 1; }

TMPDIR=$(mktemp -d)
cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT
umask 077

echo "[job3] reading localadmin password from Key Vault: $KEYVAULT_NAME/$LOCALADMIN_SECRET_NAME"
LOCALADMIN_PASSWORD=$(az keyvault secret show --vault-name "$KEYVAULT_NAME" --name "$LOCALADMIN_SECRET_NAME" --query value -o tsv)

# Build runtime inventory with real password
export INVENTORY_RUNTIME="$TMPDIR/inventory.runtime.yml"
export LOCALADMIN_PASSWORD

python3 - <<'PY'
import os
from pathlib import Path

src = Path(os.environ['ANSIBLE_INVENTORY'])
dst = Path(os.environ['INVENTORY_RUNTIME'])
pwd = os.environ['LOCALADMIN_PASSWORD']

data = src.read_text(encoding='utf-8')
if '__SET_ME_VIA_RUNDECK_OR_KEYVAULT__' in data:
    data = data.replace('__SET_ME_VIA_RUNDECK_OR_KEYVAULT__', pwd)
dst.write_text(data, encoding='utf-8')
PY

echo "[job3] runtime inventory created"
unset LOCALADMIN_PASSWORD

ansible-playbook -i "$INVENTORY_RUNTIME" playbooks/install-iis.yml -v

echo "[job3] done ($(date -Is))"
