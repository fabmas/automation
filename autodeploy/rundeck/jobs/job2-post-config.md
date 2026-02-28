# Rundeck Job 2 — Post-Config (Ansible)

## Obiettivo
Eseguire **solo guest configuration** sulla VM Windows appena provisionata:
- set DNS verso DC1 (10.0.0.4)
- join dominio `fabmas.it`
- reboot + verify

## Input (options)
- `ANSIBLE_WORKDIR` (default: `autodeploy/ansible`)
- `ANSIBLE_INVENTORY` (default: `autodeploy/ansible/inventory/terraform.yml`)
- Credenziali (raccomandato via Rundeck Key Storage oppure Ansible Vault)

## Step (script: Bash)
```bash
set -euo pipefail

cd autodeploy/ansible

# Esempio: se usi Ansible Vault, fornisci la vault password via Rundeck Key Storage
# export ANSIBLE_VAULT_PASSWORD_FILE=/path/to/vault-pass.sh

ansible-playbook -i inventory/terraform.yml playbooks/join-domain.yml -v
```

## Output atteso
- Task `microsoft.ad.membership` in stato `changed` al primo run
- Reboot eseguito (se richiesto)
- Verify `PartOfDomain=true` e `Domain=fabmas.it`
