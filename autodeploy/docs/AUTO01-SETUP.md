# Setup auto01 (Ubuntu Server 24.04 LTS) — comandi

Obiettivo: preparare `auto01` come control plane per eseguire:
- Terraform (solo infra Azure)
- Ansible (guest config: DNS + domain join + reboot + verify)
- Rundeck (orchestrazione job 1/2)
- PowerShell (pwsh) e Java (per Rundeck)

> Nota: esegui i comandi come utente con sudo. Se sei già in `sudo su -`, puoi copiare/incollare direttamente.

---

## 0) Variabili ambiente (Azure)

```bash
export AZ_TENANT_ID='MngEnvMCAP655724.onmicrosoft.com'
export AZ_SUBSCRIPTION_ID='9af59c0f-7661-48ec-ac0d-fc61688f01ea'
```

---

## 1) Base OS

```bash
apt-get update
apt-get -y upgrade
apt-get install -y \
  ca-certificates curl gnupg lsb-release apt-transport-https \
  unzip git jq \
  python3 python3-pip python3-venv pipx \
  openjdk-17-jre-headless

# abilita pipx per tutti gli utenti
python3 -m pipx ensurepath
```

Apri una nuova shell (o fai `source ~/.bashrc`) per rendere disponibile `pipx` nel PATH.

Verifica:
```bash
pipx --version
```

---

## 2) Azure CLI (Microsoft repo)

```bash
mkdir -p /etc/apt/keyrings
curl -sLS https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > /etc/apt/keyrings/microsoft.gpg
chmod go+r /etc/apt/keyrings/microsoft.gpg

AZ_REPO=$(lsb_release -cs)
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/microsoft.gpg] https://packages.microsoft.com/repos/azure-cli/ $AZ_REPO main" \
  > /etc/apt/sources.list.d/azure-cli.list

apt-get update
apt-get install -y azure-cli

az version
```

## 2b) Azure login

Login consigliato (Managed Identity su VM Azure):
```bash
az login --identity
az account set --subscription "$AZ_SUBSCRIPTION_ID"
```

In alternativa (interactive):
```bash
az login --tenant "$AZ_TENANT_ID"
az account set --subscription "$AZ_SUBSCRIPTION_ID"
```

---

## 3) Terraform (HashiCorp repo)

```bash
curl -fsSL https://apt.releases.hashicorp.com/gpg | gpg --dearmor > /etc/apt/keyrings/hashicorp.gpg
chmod go+r /etc/apt/keyrings/hashicorp.gpg

echo "deb [signed-by=/etc/apt/keyrings/hashicorp.gpg] https://apt.releases.hashicorp.com $AZ_REPO main" \
  > /etc/apt/sources.list.d/hashicorp.list

apt-get update
apt-get install -y terraform

terraform version
```

---

## 4) PowerShell (pwsh)

```bash

# Su Ubuntu 24.04 (noble) il path "ubuntu/noble/prod" può non esistere.
# Usa invece il bootstrap ufficiale che configura il repo "ubuntu/24.04/prod".
rm -f /etc/apt/sources.list.d/microsoft-prod.list

curl -fsSL https://packages.microsoft.com/config/ubuntu/24.04/packages-microsoft-prod.deb -o /tmp/packages-microsoft-prod.deb
dpkg -i /tmp/packages-microsoft-prod.deb

apt-get update
apt-get install -y powershell

pwsh -NoLogo -NoProfile -Command '$PSVersionTable.PSVersion'
```

---

## 5) Ansible (via pipx) + dipendenze WinRM

Scelta consigliata: usare `pipx` per avere Ansible aggiornabile senza sporcare i pacchetti di sistema.

```bash
pipx install --include-deps ansible-core

# WinRM dependency per Ansible su Windows
pipx inject ansible-core pywinrm

ansible --version
```

Install collezioni richieste (VINCOLANTI):
```bash
ansible-galaxy collection install ansible.windows microsoft.ad
```

Suggerito: verifica collezioni
```bash
ansible-galaxy collection list | egrep 'ansible.windows|microsoft.ad'
```

---

## 6) Rundeck

Rundeck richiede Java (già installato sopra) e un servizio.

> Nota: i package/repo possono variare per versione; la via più semplice e stabile in enterprise è usare i package ufficiali Rundeck.

Comandi (repo ufficiale):
```bash
curl -L https://packages.rundeck.com/pagerduty/rundeck/gpgkey | gpg --dearmor > /etc/apt/keyrings/rundeck.gpg
chmod go+r /etc/apt/keyrings/rundeck.gpg

echo "deb [signed-by=/etc/apt/keyrings/rundeck.gpg] https://packages.rundeck.com/pagerduty/rundeck/any/ any main" \
  > /etc/apt/sources.list.d/rundeck.list

apt-get update
apt-get install -y rundeck

systemctl enable --now rundeckd
systemctl status rundeckd --no-pager
```

Se `rundeckd` risulta `active (running)` ma **non ascolta** su `:4440`, su Ubuntu 24.04 verifica che Rundeck stia usando **Java 17** (non Java 21):
```bash
java -version
sudo update-alternatives --list java || true
sudo update-alternatives --config java

sudo systemctl restart rundeckd
sudo ss -lntp | egrep ':4440|:4443' || true
```

Default UI: `http://<auto01>:4440` (apri NSG solo da IP amministrativi).

Permessi: i job girano come utente `rundeck`. Se il repo è in `/opt/automation`, Terraform deve poter scrivere in `autodeploy/terraform` e Job 1 deve poter aggiornare l’inventory Ansible.

```bash
sudo chgrp -R rundeck /opt/automation
sudo chmod -R g+rX /opt/automation
sudo chmod -R g+rwX /opt/automation/autodeploy/terraform
sudo chmod -R g+rwX /opt/automation/autodeploy/ansible/inventory
sudo chmod -R g+rX /opt/automation/autodeploy/rundeck/scripts
sudo chmod -R o-rwx /opt/automation
```

Se fai `git pull` come `root`, a seconda della `umask` i file aggiornati possono diventare **non leggibili** dall’utente `rundeck` (errore tipico: `bash: ... Permission denied`).

Scelta consigliata: aggiorna il repo come utente `rundeck`:
```bash
sudo -u rundeck git -C /opt/automation pull
```

Opzionale (ma utile): mantieni il gruppo `rundeck` sui nuovi file/dir creati sotto `autodeploy/`:
```bash
sudo find /opt/automation/autodeploy -type d -exec chmod g+s {} +
```

---

## 7) Repo e struttura locale

Su auto01 clona il repo e usa la struttura già pronta:

```bash
mkdir -p /opt
cd /opt

# esempio (sostituisci URL con il tuo)
# git clone <URL_GIT> autodeploy-repo
# cd autodeploy-repo

# la directory attesa è: autodeploy/
ls -la autodeploy
```

---

## 8) Verifica preflight accessi (RBAC)

Key Vault (devi poter leggere il secret della password local admin VM):
```bash
az keyvault secret show --vault-name fabmas-kv1 --name winproto01-localadmin --query id -o tsv
```

Se fallisce: assegnare (a MI di auto01 o SP usata) ruolo **Key Vault Secrets User** sul vault.

### 8a) (Una tantum) Creare il secret `winproto01-localadmin` se manca

Se ricevi `SecretNotFound`, puoi creare il secret senza mettere la password in chiaro negli argomenti della CLI.

> Importante: **non usare la variabile Bash `PWD`** per la password (è riservata alla “current directory” e può finire nel prompt). Usa un nome tipo `VM_LOCALADMIN_PW`.

```bash
umask 077

read -s -p "Inserisci password localadmin VM: " VM_LOCALADMIN_PW; echo

TMPFILE="$(mktemp)"
printf '%s' "$VM_LOCALADMIN_PW" > "$TMPFILE"
unset VM_LOCALADMIN_PW

az keyvault secret set \
  --vault-name fabmas-kv1 \
  --name winproto01-localadmin \
  --file "$TMPFILE" \
  --output none

rm -f "$TMPFILE"
unset TMPFILE
```

Se `az keyvault secret set` fallisce per autorizzazione: serve permesso **set** sul vault (RBAC tipico: **Key Vault Secrets Officer**; “Secrets User” basta solo per leggere).

---

## 9) Esecuzione manuale (senza Rundeck, per test)

Terraform (job 1):
```bash
# Una tantum: crea il container backend se non esiste (usa Entra ID, non access key)
az storage container create \
  --account-name fabmastorageaccount01 \
  --name tfstate \
  --auth-mode login \
  --public-access off

terraform -chdir=autodeploy/terraform init -input=false \
  -backend-config="resource_group_name=RG-Automation" \
  -backend-config="storage_account_name=fabmastorageaccount01" \
  -backend-config="container_name=tfstate" \
  -backend-config="key=autodeploy/windows-prototype.tfstate" \
  -backend-config="use_azuread_auth=true" \
  -backend-config="subscription_id=$AZ_SUBSCRIPTION_ID" \
  -backend-config="tenant_id=$AZ_TENANT_ID"

terraform -chdir=autodeploy/terraform validate
terraform -chdir=autodeploy/terraform plan -out tfplan
terraform -chdir=autodeploy/terraform apply -auto-approve tfplan

terraform -chdir=autodeploy/terraform output
```

Ansible (job 2):
```bash
cd autodeploy/ansible

# Se usi vault:
# ansible-vault encrypt vars/vault.yml
# export ANSIBLE_VAULT_PASSWORD_FILE=/path/to/vault-pass.sh

ansible-playbook -i inventory/terraform.yml playbooks/join-domain.yml -v
```
