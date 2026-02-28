#!/usr/bin/env bash
set -euo pipefail

# Ensure tools installed via pipx or custom paths are reachable
for p in /var/lib/rundeck/.local/bin /root/.local/bin /home/*/.local/bin /usr/local/bin; do
  [[ -d "$p" ]] && export PATH="$p:$PATH"
done

echo "[job2] starting ($(date -Is))"
echo "[job2] user=$(whoami) host=$(hostname -f 2>/dev/null || hostname)"

REPO_DIR="${REPO_DIR:-/opt/automation}"

AZ_SUBSCRIPTION_ID="${AZ_SUBSCRIPTION_ID:-9af59c0f-7661-48ec-ac0d-fc61688f01ea}"

ANSIBLE_WORKDIR="${ANSIBLE_WORKDIR:-${REPO_DIR}/autodeploy/ansible}"
ANSIBLE_INVENTORY="${ANSIBLE_INVENTORY:-${ANSIBLE_WORKDIR}/inventory/terraform.yml}"

echo "[job2] repo_dir=$REPO_DIR"
echo "[job2] ansible_workdir=$ANSIBLE_WORKDIR"
echo "[job2] inventory=$ANSIBLE_INVENTORY"

# Default secrets from Key Vault (can be overridden by Rundeck options/env)
KEYVAULT_NAME="${KEYVAULT_NAME:-fabmas-kv1}"
LOCALADMIN_SECRET_NAME="${LOCALADMIN_SECRET_NAME:-winproto01-localadmin}"
DOMAIN_JOIN_SECRET_NAME="${DOMAIN_JOIN_SECRET_NAME:-fabmas-joiner-password}"

# If set, uses these instead of Key Vault
LOCALADMIN_PASSWORD="${LOCALADMIN_PASSWORD:-}"
DOMAIN_JOIN_PASSWORD="${DOMAIN_JOIN_PASSWORD:-}"

az login --identity --output none || true
az account set --subscription "$AZ_SUBSCRIPTION_ID" >/dev/null

command -v az >/dev/null || { echo "[job2] ERROR: az not found"; exit 1; }
command -v ansible-playbook >/dev/null || { echo "[job2] ERROR: ansible-playbook not found"; exit 1; }
ansible-playbook --version | head -n 2 || true

cd "$ANSIBLE_WORKDIR"

test -f "$ANSIBLE_INVENTORY" || { echo "[job2] ERROR: inventory not found: $ANSIBLE_INVENTORY"; exit 1; }

TMPDIR=$(mktemp -d)
cleanup() {
  rm -rf "$TMPDIR"
}
trap cleanup EXIT

umask 077

if [[ -z "$LOCALADMIN_PASSWORD" ]]; then
  echo "[job2] reading localadmin password from Key Vault: $KEYVAULT_NAME/$LOCALADMIN_SECRET_NAME"
  LOCALADMIN_PASSWORD=$(az keyvault secret show --vault-name "$KEYVAULT_NAME" --name "$LOCALADMIN_SECRET_NAME" --query value -o tsv)
fi

if [[ -z "$DOMAIN_JOIN_PASSWORD" ]]; then
  echo "[job2] reading domain-join password from Key Vault (optional): $KEYVAULT_NAME/$DOMAIN_JOIN_SECRET_NAME"
  # Optional: if the secret doesn't exist, the job can still run if you provide Ansible Vault instead.
  set +e
  DOMAIN_JOIN_PASSWORD=$(az keyvault secret show --vault-name "$KEYVAULT_NAME" --name "$DOMAIN_JOIN_SECRET_NAME" --query value -o tsv 2>/dev/null)
  set -e
fi

# Build a runtime vars file for the join password if available.
VAULT_VARS_FILE=""
if [[ -n "$DOMAIN_JOIN_PASSWORD" ]]; then
  VAULT_VARS_FILE="$TMPDIR/vault.runtime.yml"
  printf '%s\n' "---" > "$VAULT_VARS_FILE"
  printf '%s\n' "ad_join_password: \"$DOMAIN_JOIN_PASSWORD\"" >> "$VAULT_VARS_FILE"
  echo "[job2] runtime vault vars file created"
else
  echo "[job2] no domain-join password available; playbook will use ansible/vars/vault.yml"
fi

# Create a runtime inventory with the localadmin password injected.
INVENTORY_RUNTIME="$TMPDIR/inventory.runtime.yml"

# Render by copying the file and replacing the placeholder line.
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

echo "[job2] runtime inventory created"

unset LOCALADMIN_PASSWORD
unset DOMAIN_JOIN_PASSWORD

EXTRA_ARGS=()
if [[ -n "$VAULT_VARS_FILE" ]]; then
  EXTRA_ARGS+=( -e "vault_vars_file=$VAULT_VARS_FILE" )
fi

ansible-playbook -i "$INVENTORY_RUNTIME" playbooks/join-domain.yml -v "${EXTRA_ARGS[@]}"

echo "[job2] done ($(date -Is))"
