#!/usr/bin/env bash
# _inventory_helper.sh — Shared helper: dynamic per-VM Ansible inventory.
#
# Source this from any job script:
#   source "${REPO_DIR}/autodeploy/rundeck/scripts/_inventory_helper.sh"
#
# Then call:
#   generate_vm_inventory VM_NAME PASSWORD OUTPUT_FILE [RESOURCE_GROUP]
#
# The function queries Azure for the VM's private IP and writes a single-host
# Ansible inventory YAML with WinRM/NTLM connection settings.
# This eliminates the race condition when two Job 1 runs write to the same
# shared terraform.yml inventory file.

generate_vm_inventory() {
  local vm_name="$1"
  local password="$2"
  local output_file="$3"
  local rg="${4:-RG-AutoDeploy}"

  echo "[inventory] resolving private IP for VM '${vm_name}' (RG: ${rg})..."

  local vm_ip
  vm_ip=$(az vm list-ip-addresses \
    --resource-group "$rg" \
    --name "$vm_name" \
    --query "[0].virtualMachine.network.privateIpAddresses[0]" \
    -o tsv 2>/dev/null)

  if [[ -z "$vm_ip" ]]; then
    echo "[inventory] ERROR: could not resolve private IP for VM '${vm_name}' in RG '${rg}'"
    return 1
  fi

  echo "[inventory] ${vm_name} -> ${vm_ip}"

  cat > "$output_file" <<EOINV
all:
  children:
    windows:
      hosts:
        ${vm_name}:
          ansible_host: ${vm_ip}
      vars:
        ansible_connection: winrm
        ansible_winrm_transport: ntlm
        ansible_winrm_scheme: http
        ansible_port: 5985
        ansible_winrm_server_cert_validation: ignore
        ansible_user: localadmin
        ansible_password: "${password}"
EOINV

  echo "[inventory] dynamic inventory written to ${output_file}"
}
