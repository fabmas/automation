# Rundeck Job 1 — Provision VM (Terraform)

## Obiettivo
Provisioning **solo infrastruttura** (VM Windows + NIC + NSG WinRM ristretto) in `RG-AutoDeploy`.

## Input (options)
- `TF_WORKDIR` (default: `autodeploy/terraform`)
- `TF_VAR_vm_name` (default: `winproto01`)
- `TF_VAR_computer_name` (default: `WINPROTO01`)

Backend state (passati a `terraform init` come backend-config):
- `resource_group_name=RG-Automation`
- `storage_account_name=fabmastorageaccount01`
- `container_name=tfstate`
- `key=autodeploy/windows-prototype.tfstate`
- `subscription_id=9af59c0f-7661-48ec-ac0d-fc61688f01ea`
- `tenant_id=MngEnvMCAP655724.onmicrosoft.com`

## Step (script: Bash)
1) Init
```bash
set -euo pipefail
terraform -chdir=autodeploy/terraform init -input=false \
  -backend-config="resource_group_name=RG-Automation" \
  -backend-config="storage_account_name=fabmastorageaccount01" \
  -backend-config="container_name=tfstate" \
  -backend-config="key=autodeploy/windows-prototype.tfstate" \
  -backend-config="use_azuread_auth=true" \
  -backend-config="subscription_id=9af59c0f-7661-48ec-ac0d-fc61688f01ea" \
  -backend-config="tenant_id=MngEnvMCAP655724.onmicrosoft.com"
```

2) Validate + Plan
```bash
terraform -chdir=autodeploy/terraform validate
terraform -chdir=autodeploy/terraform plan -out tfplan
```

3) Apply
```bash
terraform -chdir=autodeploy/terraform apply -auto-approve tfplan
```

4) Genera inventory Ansible (`ansible/inventory/terraform.yml`) dagli output
```bash
VM_NAME=$(terraform -chdir=autodeploy/terraform output -raw vm_name)
VM_IP=$(terraform -chdir=autodeploy/terraform output -raw vm_private_ip)

cat > autodeploy/ansible/inventory/terraform.yml <<EOF
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
        ansible_password: "__SET_ME_VIA_VAULT_OR_RUNDECK__"
EOF

echo "VM_NAME=${VM_NAME}"
echo "VM_IP=${VM_IP}"
```

## Output atteso (log Rundeck)
- `VM_NAME=...`
- `VM_IP=...`
