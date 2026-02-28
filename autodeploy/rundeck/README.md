# Rundeck — setup minimo (auto01)

Obiettivo: eseguire 2 job separati su `auto01`:
1) **Terraform** (solo infra)
2) **Ansible** (solo guest config)

## Prerequisiti su auto01
- Repo clonato in `/opt/automation`.
- Rundeck installato e raggiungibile su `http://<auto01>:4440`.
- Azure CLI login con Managed Identity funzionante: `az login --identity`.
- RBAC già configurato per:
  - Storage backend state (Blob Data) su `fabmastorageaccount01`.
  - Key Vault secrets read su `fabmas-kv1`.

## Creare il Project
Nel UI di Rundeck:
- Create Project: `autodeploy`
- Execution: `Local` (comandi eseguiti su auto01)

## Import Job definitions
Nel Project `autodeploy`:
- Jobs → Upload Definition
- Carica (in ordine):
  - `autodeploy/rundeck/jobs/job1-provision-vm.yaml`
  - `autodeploy/rundeck/jobs/job2-post-config.yaml`

## Key Storage (consigliato)
Puoi evitare opzioni in chiaro salvando password in Key Storage.
- `keys/autodeploy/domain-join-password`

Il Job 2 può leggere la password dal Key Vault (default) oppure da Key Storage tramite option secure.

## Note operative
- Job 1 genera/aggiorna `autodeploy/ansible/inventory/terraform.yml` su auto01.
- Job 2 usa WinRM su 5985 (NSG limitato a auto01) e fa join dominio + reboot + verify.
