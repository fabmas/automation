# Note di sicurezza (Key Vault / Ansible Vault / Rundeck)

## Principi
- **Terraform owns infra state**: risorse Azure, NIC/NSG/VM.
- **Ansible/DSC own guest state**: DNS client, domain join, reboot, validazioni.

## Separazione Resource Group
- Shared services (VNet, DC01, auto01, Key Vault, Storage state) in `RG-Automation`.
- Workload (VM Windows prototype e future) in `RG-AutoDeploy`.

## Key Vault
- Tenere in `fabmas-kv1`:
  - password local admin VM (bootstrap WinRM)
  - eventuale password `fabmas\\joiner` (se non si usa Ansible Vault)
- Preferire accesso con Managed Identity o Service Principal con **least privilege**.
- Abilitare auditing/diagnostic settings verso Log Analytics (se disponibile).

## Terraform state
- State remoto cifrato sullo Storage Account.
- Container privato, RBAC sul data plane strettamente limitato.
- Evitare output Terraform che espongono segreti.

## Ansible Vault
- Proteggere `ansible/vars/vault.yml` con `ansible-vault encrypt`.
- La vault password non va mai in chiaro in repo: usare Rundeck Key Storage e `ANSIBLE_VAULT_PASSWORD_FILE`.

## Rundeck
- Salvare credenziali in **Key Storage** (non come option plain text).
- Log: evitare di stampare variabili sensibili; usare mascheramento/secure options.
- Separare Job 1 (Terraform) e Job 2 (Ansible) con permessi RBAC distinti.

## WinRM
- Esporre WinRM **solo su rete privata** (no public IP).
- NSG inbound 5985 consentito solo da auto01 (`10.0.0.5/32`).
- Per hardening futuro: passare a WinRM HTTPS con certificato da Key Vault e `winrm_listener { protocol = "Https" }`.

## Link utili
- Resource Group workload (portal): https://portal.azure.com/#@MngEnvMCAP655724.onmicrosoft.com/resource/subscriptions/9af59c0f-7661-48ec-ac0d-fc61688f01ea/resourceGroups/RG-AutoDeploy/overview
