# Rundeck — setup minimo (auto01)

Obiettivo: eseguire 2 job separati su `auto01`:
1) **Terraform** (solo infra)
2) **Ansible** (solo guest config)

## Prerequisiti su auto01
- Repo clonato in `/opt/automation`.
- Rundeck installato e raggiungibile su `http://<auto01>:4440`.
- Java 17 attivo come default (`java -version`).
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

## Permessi filesystem (importante)
I job Rundeck girano come utente `rundeck`. Terraform deve poter scrivere nella cartella di lavoro (`.terraform/*`, plan file), e Job 1 deve poter aggiornare l’inventory.

Su auto01 (una tantum):
```bash
sudo chgrp -R rundeck /opt/automation

# Assicura che rundeck possa leggere gli script anche dopo update del repo
sudo chmod -R g+rX /opt/automation

# Consenti a rundeck di scrivere dove serve
sudo chmod -R g+rwX /opt/automation/autodeploy/terraform
sudo chmod -R g+rwX /opt/automation/autodeploy/ansible/inventory
sudo chmod -R g+rX /opt/automation/autodeploy/rundeck/scripts

# (opzionale) mantiene il gruppo rundeck sui nuovi file/dir creati
sudo find /opt/automation/autodeploy -type d -exec chmod g+s {} +

# Riduci accesso per altri utenti locali
sudo chmod -R o-rwx /opt/automation
```

Nota: per evitare regressioni di permessi, fai gli aggiornamenti git come utente `rundeck` (consigliato):
```bash
sudo -u rundeck git -C /opt/automation pull
```

## Troubleshooting rapido
Se `rundeckd` è `active` ma non ascolta su `:4440`:
- `sudo ss -lntp | egrep ':4440|:4443' || true`
- verifica Java: `java -version` e imposta Java 17 con `sudo update-alternatives --config java`, poi `sudo systemctl restart rundeckd`.
