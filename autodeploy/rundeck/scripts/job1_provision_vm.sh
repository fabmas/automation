#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/automation}"

AZ_TENANT_ID="${AZ_TENANT_ID:-MngEnvMCAP655724.onmicrosoft.com}"
AZ_SUBSCRIPTION_ID="${AZ_SUBSCRIPTION_ID:-9af59c0f-7661-48ec-ac0d-fc61688f01ea}"

BACKEND_RG="${BACKEND_RG:-RG-Automation}"
STATE_STORAGE_ACCOUNT="${STATE_STORAGE_ACCOUNT:-fabmastorageaccount01}"
STATE_CONTAINER="${STATE_CONTAINER:-tfstate}"
STATE_KEY="${STATE_KEY:-autodeploy/windows-prototype.tfstate}"

TF_WORKDIR="${TF_WORKDIR:-${REPO_DIR}/autodeploy/terraform}"
ANSIBLE_INVENTORY_PATH="${ANSIBLE_INVENTORY_PATH:-${REPO_DIR}/autodeploy/ansible/inventory/terraform.yml}"

cd "$REPO_DIR"

az account set --subscription "$AZ_SUBSCRIPTION_ID" >/dev/null

# Una tantum: container state
az storage container create \
  --account-name "$STATE_STORAGE_ACCOUNT" \
  --name "$STATE_CONTAINER" \
  --auth-mode login \
  --public-access off \
  --output none || true

terraform -chdir="$TF_WORKDIR" init -reconfigure -input=false \
  -backend-config="resource_group_name=$BACKEND_RG" \
  -backend-config="storage_account_name=$STATE_STORAGE_ACCOUNT" \
  -backend-config="container_name=$STATE_CONTAINER" \
  -backend-config="key=$STATE_KEY" \
  -backend-config="use_azuread_auth=true" \
  -backend-config="subscription_id=$AZ_SUBSCRIPTION_ID" \
  -backend-config="tenant_id=$AZ_TENANT_ID"

terraform -chdir="$TF_WORKDIR" validate
terraform -chdir="$TF_WORKDIR" plan -out tfplan
terraform -chdir="$TF_WORKDIR" apply -auto-approve tfplan

VM_NAME=$(terraform -chdir="$TF_WORKDIR" output -raw vm_name)
VM_IP=$(terraform -chdir="$TF_WORKDIR" output -raw vm_private_ip)

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
