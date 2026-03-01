#!/usr/bin/env bash
set -euo pipefail

# Ensure tools installed via pipx or custom paths are reachable
for p in /var/lib/rundeck/.local/bin /root/.local/bin /home/*/.local/bin /usr/local/bin; do
  [[ -d "$p" ]] && export PATH="$p:$PATH"
done

echo "[job1] starting ($(date -Is))"
echo "[job1] user=$(whoami) host=$(hostname -f 2>/dev/null || hostname)"

REPO_DIR="${REPO_DIR:-/opt/automation}"

AZ_TENANT_ID="${AZ_TENANT_ID:-MngEnvMCAP655724.onmicrosoft.com}"
AZ_SUBSCRIPTION_ID="${AZ_SUBSCRIPTION_ID:-9af59c0f-7661-48ec-ac0d-fc61688f01ea}"

BACKEND_RG="${BACKEND_RG:-RG-Automation}"
STATE_STORAGE_ACCOUNT="${STATE_STORAGE_ACCOUNT:-fabmastorageaccount01}"
STATE_CONTAINER="${STATE_CONTAINER:-tfstate}"
STATE_KEY="${STATE_KEY:-autodeploy/windows-prototype.tfstate}"

TF_WORKDIR="${TF_WORKDIR:-${REPO_DIR}/autodeploy/terraform}"
ANSIBLE_INVENTORY_PATH="${ANSIBLE_INVENTORY_PATH:-${REPO_DIR}/autodeploy/ansible/inventory/terraform.yml}"

# ── Dynamic VM name from webapp / Rundeck option ──
VM_NAME_INPUT="${VM_NAME_INPUT:-}"
ADMIN_PASSWORD_SECRET_NAME="${ADMIN_PASSWORD_SECRET_NAME:-}"

if [[ -n "$VM_NAME_INPUT" ]]; then
  export TF_VAR_vm_name="$VM_NAME_INPUT"
  export TF_VAR_computer_name="$(echo "$VM_NAME_INPUT" | tr '[:lower:]' '[:upper:]')"
  echo "[job1] vm_name override: $VM_NAME_INPUT (computer_name: $TF_VAR_computer_name)"
fi

if [[ -n "$ADMIN_PASSWORD_SECRET_NAME" ]]; then
  export TF_VAR_admin_password_secret_name="$ADMIN_PASSWORD_SECRET_NAME"
  echo "[job1] admin_password_secret_name override: $ADMIN_PASSWORD_SECRET_NAME"
fi

echo "[job1] repo_dir=$REPO_DIR"
echo "[job1] tf_workdir=$TF_WORKDIR"
echo "[job1] inventory_path=$ANSIBLE_INVENTORY_PATH"

cd "$REPO_DIR"

test -d "$TF_WORKDIR" || { echo "[job1] ERROR: tf_workdir not found: $TF_WORKDIR"; exit 1; }
test -w "$TF_WORKDIR" || { echo "[job1] ERROR: tf_workdir not writable by $(whoami): $TF_WORKDIR"; echo "[job1] Hint: chgrp -R rundeck /opt/automation && chmod -R g+rwX /opt/automation/autodeploy/terraform"; exit 1; }

# ── Isolate each parallel run in its own temp working directory ──
# This prevents two concurrent terraform runs from conflicting on .terraform/ locks.
_VM_SAFE="${VM_NAME_INPUT:-default}"
TF_RUN_DIR=$(mktemp -d "/tmp/tf-${_VM_SAFE}-XXXXXX")
cp "$TF_WORKDIR"/*.tf "$TF_RUN_DIR/"
echo "[job1] isolated tf working dir: $TF_RUN_DIR"

# Cleanup on exit
_cleanup_tf() { rm -rf "$TF_RUN_DIR"; }
trap _cleanup_tf EXIT

command -v az >/dev/null || { echo "[job1] ERROR: az not found"; exit 1; }
command -v terraform >/dev/null || { echo "[job1] ERROR: terraform not found"; exit 1; }
terraform version | head -n 2 || true

az login --identity --output none || true
az account set --subscription "$AZ_SUBSCRIPTION_ID" >/dev/null

# ── Ensure Key Vault secret exists for the local admin password ──
# If vm_name was overridden, the secret name is <vm_name>-localadmin.
# If it doesn't exist yet, generate a random password and store it.
KV_NAME="${KV_NAME:-fabmas-kv1}"
_SECRET_NAME="${TF_VAR_admin_password_secret_name:-winproto01-localadmin}"
if ! az keyvault secret show --vault-name "$KV_NAME" --name "$_SECRET_NAME" --query id -o tsv &>/dev/null; then
  echo "[job1] Secret '$_SECRET_NAME' not found in $KV_NAME — creating with random password"
  _GEN_PASS="$(openssl rand -base64 24 | tr -d '=+/' | head -c 20)A1b!"
  az keyvault secret set --vault-name "$KV_NAME" --name "$_SECRET_NAME" --value "$_GEN_PASS" --output none
  echo "[job1] Secret '$_SECRET_NAME' created"
else
  echo "[job1] Secret '$_SECRET_NAME' already exists in $KV_NAME"
fi

# Una tantum: container state
az storage container create \
  --account-name "$STATE_STORAGE_ACCOUNT" \
  --name "$STATE_CONTAINER" \
  --auth-mode login \
  --public-access off \
  --output none || true

terraform -chdir="$TF_RUN_DIR" init -reconfigure -input=false \
  -backend-config="resource_group_name=$BACKEND_RG" \
  -backend-config="storage_account_name=$STATE_STORAGE_ACCOUNT" \
  -backend-config="container_name=$STATE_CONTAINER" \
  -backend-config="key=$STATE_KEY" \
  -backend-config="use_azuread_auth=true" \
  -backend-config="subscription_id=$AZ_SUBSCRIPTION_ID" \
  -backend-config="tenant_id=$AZ_TENANT_ID"

terraform -chdir="$TF_RUN_DIR" validate
terraform -chdir="$TF_RUN_DIR" plan -out tfplan
terraform -chdir="$TF_RUN_DIR" apply -auto-approve tfplan

VM_NAME=$(terraform -chdir="$TF_RUN_DIR" output -raw vm_name)
VM_IP=$(terraform -chdir="$TF_RUN_DIR" output -raw vm_private_ip)

umask 077
cat > "$ANSIBLE_INVENTORY_PATH" <<EOF
all:
  children:
    windows:
      hosts:
        ${VM_NAME}:
          ansible_host: ${VM_IP}
      vars:
        ansible_connection: winrm
        ansible_winrm_transport: ntlm
        ansible_winrm_scheme: http
        ansible_port: 5985
        ansible_winrm_server_cert_validation: ignore

        ansible_user: localadmin
        ansible_password: "__SET_ME_VIA_RUNDECK_OR_KEYVAULT__"
EOF

echo "VM_NAME=${VM_NAME}"
echo "VM_IP=${VM_IP}"
echo "Inventory updated: ${ANSIBLE_INVENTORY_PATH}"

echo "[job1] done ($(date -Is))"
